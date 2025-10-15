/**************************** CONFIGURATION LOCALE *********************************/
const ELEVES_MODULE_CONFIG = {
  TEST_SUFFIX: 'TEST',
  CACHE_SUFFIX: 'CACHE',
  SNAPSHOT_SUFFIX: 'INT',
  STRUCTURE_SHEET: '_STRUCTURE',
  DEFAULT_CAPACITY: 28,
  DEFAULT_MOBILITY: 'LIBRE',
  SHEET_EXCLUSION_PATTERN: /^(?:level|grp|groupe|group|niv(?:eau)?)\b/i
};

/**************************** ALIAS DES COLONNES *********************************/
const ELEVES_ALIAS = {
  id      : ['ID_ELEVE','ID','UID','IDENTIFIANT','NUM ELÈVE'],
  nom     : ['NOM'],
  prenom  : ['PRENOM','PRÉNOM'],
  sexe    : ['SEXE','S'],
  lv2     : ['LV2','LANGUE2','L2'],
  opt     : ['OPT','OPTION'],
  disso   : ['DISSO','DISSOCIÉ','DISSOCIE'],
  asso    : ['ASSO','ASSOCIÉ','ASSOCIE'],
  com     : ['COM'],
  tra     : ['TRA'],
  part    : ['PART'],
  abs     : ['ABS'],
  source  : ['SOURCE','ORIGINE','CLASSE_ORIGINE'],
  dispo   : ['DISPO','PAI','PPRE','PAP','GEVASCO'],
  mobilite: ['MOBILITE','MOB']
};

/**************************** FONCTIONS UTILITAIRES *********************************/
const _eleves_s   = v => String(v || '').trim();
const _eleves_up  = v => _eleves_s(v).toUpperCase();
const _eleves_num = v => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
function _eleves_idx(head, aliases){
  for(let i=0;i<head.length;i++)
    if(aliases.some(a => head[i] === a)) return i;
  return -1;
}
function _eleves_sanitizeForSerialization(obj) {
  if (obj === undefined) return undefined;
  return JSON.parse(JSON.stringify(obj));
}
const ElevesBackend = (function(global) {
  const baseLogger = global.console || { log: () => {}, warn: () => {}, error: () => {} };

  function escapeRegExp(str) { return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function toStringValue(value) { return _eleves_s(value); }
  function toUpperValue(value) { return _eleves_up(value); }
  function toNumberValue(value) { return _eleves_num(value); }
  function sanitize(data) { return _eleves_sanitizeForSerialization(data); }
  function stripSuffix(name, suffix) {
    if (!suffix) return toStringValue(name);
    const regex = new RegExp(`${escapeRegExp(suffix)}$`, 'i');
    return toStringValue(name).replace(regex, '').trim();
  }

  const baseConfig = {
    sheetSuffixes: {
      test: ELEVES_MODULE_CONFIG.TEST_SUFFIX,     // 'TEST'
      cache: ELEVES_MODULE_CONFIG.CACHE_SUFFIX,   // 'CACHE'
      snapshot: ELEVES_MODULE_CONFIG.SNAPSHOT_SUFFIX // 'INT'
    },
    structureSheet: ELEVES_MODULE_CONFIG.STRUCTURE_SHEET,
    defaultCapacity: ELEVES_MODULE_CONFIG.DEFAULT_CAPACITY || 28,
    defaultMobility: ELEVES_MODULE_CONFIG.DEFAULT_MOBILITY || 'LIBRE',
    columnAliases: ELEVES_ALIAS,
    sheetExclusionPattern: ELEVES_MODULE_CONFIG.SHEET_EXCLUSION_PATTERN || null
  };

  /* ----------------------- Domaine ----------------------- */
  function createDomain({ config = baseConfig, logger = baseLogger } = {}) {
    const aliasMap = config.columnAliases;
    const defaultMobility = config.defaultMobility;

    function buildColumnIndex(headerRow) {
      const normalizedHead = Array.isArray(headerRow) ? headerRow.map(toUpperValue) : [];
      const indexes = {};
      Object.keys(aliasMap).forEach(key => {
        const aliases = (aliasMap[key] || []).map(toUpperValue);
        indexes[key] = _eleves_idx(normalizedHead, aliases);
      });
      return indexes;
    }

    function createStudent(row, columns) {
      const idIndex = columns.id;
      if (idIndex === undefined || idIndex === -1) return null;
      const id = toStringValue(row[idIndex]);
      if (!id) return null;

      const valueAt = (field, formatter = toStringValue) => {
        const idx = columns[field];
        if (idx === undefined || idx === -1) return formatter === toNumberValue ? 0 : '';
        return formatter(row[idx]);
      };

      const directMobilite = columns.mobilite !== -1 && columns.mobilite !== undefined
        ? toUpperValue(row[columns.mobilite]) : '';
      const fallbackMobilite = columns.dispo !== -1 && columns.dispo !== undefined
        ? toUpperValue(row[columns.dispo]) : '';

      return {
        id,
        nom: valueAt('nom'),
        prenom: valueAt('prenom'),
        sexe: valueAt('sexe', toUpperValue),
        lv2: valueAt('lv2', toUpperValue),
        opt: valueAt('opt', toUpperValue),
        disso: valueAt('disso', toUpperValue),
        asso: valueAt('asso', toUpperValue),
        scores: {
          COM: valueAt('com', toNumberValue),
          TRA: valueAt('tra', toNumberValue),
          PART: valueAt('part', toNumberValue),
          ABS: valueAt('abs', toNumberValue)
        },
        source: valueAt('source'),
        dispo: valueAt('dispo', toUpperValue),
        mobilite: directMobilite || fallbackMobilite || defaultMobility
      };
    }

    function createClassFromSheet(sheet, { suffix, logger: localLogger = logger } = {}) {
      if (!sheet || !Array.isArray(sheet.values) || sheet.values.length < 2) return null;
      const header = sheet.values[0];
      const columns = buildColumnIndex(header);
      if (columns.id === -1) {
        localLogger?.warn?.(`Feuille ${sheet.name} ignorée: aucune colonne ID reconnue.`);
        return null;
      }
      const students = [];
      for (let r = 1; r < sheet.values.length; r++) {
        const student = createStudent(sheet.values[r], columns);
        if (student) students.push(student);
      }
      if (!students.length) return null;
      return { classe: stripSuffix(sheet.name, suffix), eleves: students };
    }

    function buildClassesData(sheets, { suffix, logger: localLogger = logger } = {}) {
      const classes = [];
      (sheets || []).forEach(sheet => {
        const classe = createClassFromSheet(sheet, { suffix, logger: localLogger });
        if (classe) classes.push(classe);
      });
      return classes;
    }

    function parseStructureRules(values) {
      if (!Array.isArray(values) || values.length < 2) return {};
      const head = values[0].map(toUpperValue);
      const colDest = head.findIndex(h => h.includes('DEST'));
      if (colDest === -1) {
        logger?.warn?.('❌ Pas de colonne CLASSE_DEST dans _STRUCTURE');
        return {};
      }
      const colEff = head.findIndex(h => h.includes('EFFECTIF'));
      const colOptions = head.findIndex(h => h.includes('OPTION'));
      const rules = {};
      for (let r = 1; r < values.length; r++) {
        const dest = toStringValue(values[r][colDest]);
        if (!dest) continue;

        let capacity = config.defaultCapacity;
        if (colEff !== -1 && values[r][colEff] !== '' && values[r][colEff] != null) {
          const parsed = parseInt(values[r][colEff], 10);
          if (!Number.isNaN(parsed)) capacity = parsed;
        }
        const quotas = {};
        if (colOptions !== -1 && values[r][colOptions] !== '' && values[r][colOptions] != null) {
          String(values[r][colOptions]).replace(/^'/, '')
            .split(',').map(s => s.trim()).filter(Boolean)
            .forEach(pair => {
              const [opt, val = '0'] = pair.split('=').map(x => toUpperValue(x));
              if (opt) {
                const parsed = parseInt(val, 10);
                quotas[opt] = Number.isNaN(parsed) ? 0 : parsed;
              }
            });
        }
        rules[dest] = { capacity, quotas };
      }
      return rules;
    }

    return {
      buildColumnIndex,
      createStudent,
      createClassFromSheet,
      buildClassesData,
      parseStructureRules,
      sanitize,
      stripSuffix
    };
  }

  /* ----------------------- Accès données ----------------------- */
  function createDataAccess({ SpreadsheetApp, logger = baseLogger, config = baseConfig } = {}) {
    const hasSpreadsheet = SpreadsheetApp && typeof SpreadsheetApp.getActiveSpreadsheet === 'function';
    function getSpreadsheet() {
      if (!hasSpreadsheet) return null;
      try { return SpreadsheetApp.getActiveSpreadsheet(); }
      catch (err) { logger?.error?.('Erreur lors de la récupération du classeur actif', err); return null; }
    }

    function getClassSheetsForSuffix(suffix, { includeValues = true, includeHidden = false } = {}) {
      const spreadsheet = getSpreadsheet();
      if (!spreadsheet || typeof spreadsheet.getSheets !== 'function') return [];
      const suffixUpper = _eleves_up(suffix);
      const exclusionPattern = config.sheetExclusionPattern;
      const structureName = config.structureSheet;

      return spreadsheet.getSheets().reduce((acc, sh) => {
        const name = sh?.getName?.() || '';
        if (name === structureName) return acc;                    // exclure _STRUCTURE
        if (!_eleves_up(name).endsWith(suffixUpper)) return acc;   // filtrer le suffixe
        if (exclusionPattern && exclusionPattern.test(name)) return acc;
        if (!includeHidden && sh.isSheetHidden()) return acc;

        const entry = { name };
        if (includeValues) {
          try {
            const dataRange = sh.getDataRange?.();
            entry.values = dataRange?.getValues?.() || [];
          } catch (err) {
            logger?.error?.(`Erreur lors de la lecture de la feuille ${name}`, err);
            entry.values = [];
          }
        }
        acc.push(entry);
        return acc;
      }, []);
    }

    function getStructureSheetValues() {
      const spreadsheet = getSpreadsheet();
      if (!spreadsheet || typeof spreadsheet.getSheetByName !== 'function') return null;
      try {
        const sheet = spreadsheet.getSheetByName(config.structureSheet);
        if (!sheet) return null;
        const range = sheet.getDataRange?.();
        if (!range || typeof range.getValues !== 'function') return [];
        return range.getValues();
      } catch (err) {
        logger?.error?.('Erreur lors de la lecture de _STRUCTURE', err);
        return null;
      }
    }

    return { getClassSheetsForSuffix, getStructureSheetValues };
  }

  /* ----------------------- Service ----------------------- */
  function createService({
    config = baseConfig,
    domain = createDomain({ config }),
    dataAccess = createDataAccess(),
    logger = baseLogger
  } = {}) {

    // <<< SUFFIX MAP MISE À JOUR >>>
    const suffixMap = new Map([
      ['TEST', 'TEST'],
      ['CACHE', 'CACHE'],
      ['INT', 'INT'],
      ['SNAPSHOT', 'INT'],
      ['WIP', 'WIP'],      // conservé
      ['PREVIOUS', null],  // cas particulier
      ['FIN', 'FIN'],      // nouveau mode finalisées
      ['FINAL', 'FIN']     // alias vers FIN
    ]);

    function resolveSuffix(mode) {
      const normalized = _eleves_up(mode || '');
      if (suffixMap.has(normalized)) return suffixMap.get(normalized);
      if (normalized) logger?.warn?.(`Mode inconnu: ${mode}, utilisation de ${config.sheetSuffixes.test} par défaut`);
      return config.sheetSuffixes.test;
    }

    function getElevesData() { return getElevesDataForMode('TEST'); }

    function getElevesDataForMode(mode) {
      const norm = _eleves_up(mode || 'TEST');

      // <<< MODE PREVIOUS : regex plus robuste >>>
      if (norm === 'PREVIOUS') {
        const previousClassPattern = /^\d+°\d+$/; // accepte "6°1", "5°2", "10°3", etc.
        try {
          const ss = SpreadsheetApp.getActiveSpreadsheet();
          const sheets = ss.getSheets();
          const previous = [];
          const exclusionPattern = config.sheetExclusionPattern;
          const structureName = config.structureSheet;

          sheets.forEach(sh => {
            const name = sh.getName();
            if (name === structureName) return;
            if (exclusionPattern && exclusionPattern.test(name)) return;
            // inclut cachés pour PREVIOUS
            if (!previousClassPattern.test(String(name).trim())) return;
            try {
              const values = sh.getDataRange().getValues();
              if (values && values.length > 1) previous.push({ name, values });
            } catch (_) {}
          });

          const classes = domain.buildClassesData(
            previous.map(p => ({ name: p.name, values: p.values })),
            { suffix: '', logger }
          );
          const serialized = domain.sanitize(classes) || [];
          logger?.log?.(`✅ ${serialized.length} classes trouvées pour PREVIOUS`);
          return serialized;
        } catch (error) {
          logger?.error?.('Erreur PREVIOUS', error);
          return [];
        }
      }

      // autres modes via suffix
      const suffix = resolveSuffix(norm);
      logger?.log?.(`📊 Chargement données: mode=${norm} (suffixe: ${suffix})`);

      try {
        const sheets = dataAccess.getClassSheetsForSuffix(suffix, {
          includeValues: true,
          // <<< inclure les onglets cachés pour TEST, WIP, CACHE et FIN >>>
          includeHidden: (norm === 'TEST' || norm === 'WIP' || norm === 'CACHE' || norm === 'FIN')
        });
        const classes = domain.buildClassesData(sheets, { suffix, logger });
        const serialized = domain.sanitize(classes) || [];
        logger?.log?.(`✅ ${serialized.length} classes trouvées pour mode ${norm}`);
        return serialized;
      } catch (error) {
        logger?.error?.('Erreur dans getElevesDataForMode', error);
        return [];
      }
    }

    function getStructureRules() {
      try {
        const values = dataAccess.getStructureSheetValues();
        if (!values) { logger?.warn?.('❌ Onglet _STRUCTURE absent'); return {}; }
        const rules = domain.parseStructureRules(values);
        const serialized = domain.sanitize(rules) || {};
        logger?.log?.('✅ rules (DEST-only) :', JSON.stringify(serialized, null, 2));
        return serialized;
      } catch (error) {
        logger?.error?.('💥 Erreur getStructureRules', error);
        return {};
      }
    }

    return {
      getElevesData,
      getElevesDataForMode,
      getStructureRules,
      resolveSuffix
    };
  }

  const api = {
    config: baseConfig,
    utils: { escapeRegExp, toStringValue, toUpperValue, toNumberValue, sanitize, stripSuffix },
    createDomain,
    createDataAccess,
    createService
  };

  global.ElevesBackend = api;
  return api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
const __elevesBackendLogger = (typeof console !== 'undefined' ? console : { log: () => {}, warn: () => {}, error: () => {} });
const __elevesBackendDomain = ElevesBackend.createDomain({ config: ElevesBackend.config, logger: __elevesBackendLogger });
const __elevesBackendDataAccess = ElevesBackend.createDataAccess({
  SpreadsheetApp: typeof SpreadsheetApp !== 'undefined' ? SpreadsheetApp : null,
  logger: __elevesBackendLogger,
  config: ElevesBackend.config
});
const __elevesBackendService = ElevesBackend.createService({
  config: ElevesBackend.config,
  domain: __elevesBackendDomain,
  dataAccess: __elevesBackendDataAccess,
  logger: __elevesBackendLogger
});
/************************ API Lecture simple *********************************/
function getElevesData(){ return __elevesBackendService.getElevesData(); }
function getElevesDataForMode(mode) { return __elevesBackendService.getElevesDataForMode(mode); }
function getStructureRules() { return __elevesBackendService.getStructureRules(); }

/******************** updateStructureRules ***********************/
function updateStructureRules(newRules) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName(ELEVES_MODULE_CONFIG.STRUCTURE_SHEET);
    if (!sh) {
      sh = ss.insertSheet(ELEVES_MODULE_CONFIG.STRUCTURE_SHEET);
      sh.getRange(1, 1, 1, 4).setValues([["", "CLASSE_DEST", "EFFECTIF", "OPTIONS"]]);
      sh.getRange(1, 1, 1, 4).setBackground('#5b21b6').setFontColor('#ffffff').setFontWeight('bold');
    }
    const data = sh.getDataRange().getValues();
    const header = data[0].map(h => _eleves_up(h));
    let colClasse=-1, colEffectif=-1, colOptions=-1;
    for (let i = 0; i < header.length; i++) {
      if (header[i].includes('CLASSE') && header[i].includes('DEST')) colClasse = i;
      if (header[i].includes('EFFECTIF')) colEffectif = i;
      if (header[i].includes('OPTIONS')) colOptions = i;
    }
    if (colClasse === -1 || colEffectif === -1 || colOptions === -1) {
      return {success: false, error: "Colonnes requises non trouvées dans _STRUCTURE"};
    }
    const classMap = {};
    for (let i = 1; i < data.length; i++) {
      const classe = _eleves_s(data[i][colClasse]);
      if (classe) classMap[classe] = i;
    }
    Object.keys(newRules).forEach(classe => {
      const rule = newRules[classe];
      const quotasStr = Object.entries(rule.quotas || {}).map(([k, v]) => `${k}=${v}`).join(', ');
      if (classMap[classe]) {
        const row = classMap[classe];
        sh.getRange(row + 1, colEffectif + 1).setValue(rule.capacity);
        sh.getRange(row + 1, colOptions + 1).setValue(quotasStr);
      } else {
        const newRow = sh.getLastRow() + 1;
        sh.getRange(newRow, colClasse + 1).setValue(classe);
        sh.getRange(newRow, colEffectif + 1).setValue(rule.capacity);
        sh.getRange(newRow, colOptions + 1).setValue(quotasStr);
      }
    });
    try {
      const timestamp = new Date();
      const user = Session.getActiveUser().getEmail();
      console.log(`Règles _STRUCTURE mises à jour par ${user} à ${timestamp}`);
    } catch(_) {}
    return {success: true, message: "Règles mises à jour avec succès"};
  } catch (e) {
    console.error('Erreur dans updateStructureRules:', e);
    return {success: false, error: e.toString()};
  }
}

/******************** Utilitaires d'indexage *************************/
function buildStudentIndex_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  const domain = __elevesBackendDomain;
  const index = {};
  let header = null;

  sheets.forEach(sh => {
    const name = sh.getName();
    // ✅ Optimisation : ne lire que les onglets TEST, CACHE, ou FIN (ignorer backups, INT, etc.)
    if (!/TEST$|CACHE$|FIN$/i.test(name)) return;
    if (/INT$/i.test(name)) return; // on ignore les *INT
    const data = sh.getDataRange().getValues();
    if (data.length < 2) return;
    const columns = domain.buildColumnIndex(data[0]);
    const colId = columns.id;
    if (colId === -1) return;
    if (!header) header = data[0];
    for (let r = 1; r < data.length; r++) {
      const id = _eleves_s(data[r][colId]);
      if (id) index[id] = data[r];
    }
  });
  return { header, rows:index };
}

/******************** Sauvegardes DRY (générique) *************************/
/**
 * Sauvegarde générique des classes dans des onglets <classe><suffix>
 * options: { suffix, backup, hideSheet, lightFormat, withLock, meta:{version} }
 */
function saveElevesGeneric(classMap, options = {}) {
  const {
    suffix,
    backup = false,
    hideSheet = false,
    lightFormat = false,
    withLock = true,
    meta = { version: '2.0' }
  } = options;

  if (!classMap || typeof classMap !== 'object') return { success: false, message: '❌ classMap invalide ou manquant' };
  if (Object.keys(classMap).length === 0) return { success: false, message: '⚠️ Aucune classe à sauvegarder' };

  const LOCK_KEY = `SAVE_${suffix}_LOCK`;
  const LOCK_TIMEOUT = 300000;
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const acquire = () => {
    if (!withLock) return () => {};
    const lock = LockService.getScriptLock();
    try { lock.waitLock(30000); } catch(_) { return () => {}; }
    PropertiesService.getDocumentProperties().setProperty(
      LOCK_KEY, JSON.stringify({ user: Session.getActiveUser().getEmail(), timestamp: Date.now() })
    );
    return () => {
      try {
        PropertiesService.getDocumentProperties().deleteProperty(LOCK_KEY);
        LockService.getScriptLock().releaseLock();
      } catch(_) {}
    };
  };

  const release = acquire();
  const releaseSafely = () => { try { release(); } catch(_){} };

  let header, rows;
  try {
    const idx = buildStudentIndex_();
    header = idx.header; rows = idx.rows;
    if (!header) throw new Error('Aucune feuille avec colonne ID trouvée.');
  } catch (err) {
    releaseSafely();
    return { success: false, message: `❌ Indexation impossible: ${err.message}` };
  }

  const currentSheetCount = ss.getSheets().length;
  const maxSheets = 200;
  const sheetsNeeded = Object.keys(classMap).length;
  if (currentSheetCount + sheetsNeeded > maxSheets) {
    releaseSafely();
    return { success: false, message: `❌ Trop d'onglets (${currentSheetCount}/${maxSheets}).` };
  }

  const savedSheets = [];
  const errors = [];

  Object.keys(classMap).forEach(classe => {
    try {
      const ids = classMap[classe] || [];
      if (!Array.isArray(ids)) { errors.push(`⚠️ ${classe}: IDs non valides`); return; }

      let rowData = ids.map(id => rows[id] || [id]);
      const maxCols = Math.max(header.length, ...rowData.map(r => r.length));
      rowData = rowData.map(r => (r.length < maxCols) ? r.concat(Array(maxCols - r.length).fill('')) : r.slice(0, maxCols));
      const hdr = (header.length < maxCols) ? header.concat(Array(maxCols - header.length).fill('')) : header.slice(0, maxCols);

      const sheetName = classe + suffix;
      let sh = ss.getSheetByName(sheetName);
      if (sh) {
        if (backup) {
          const BACKUP_SUFFIX = `${suffix}_BACKUP`;
          const backupName = classe + BACKUP_SUFFIX;
          const old = ss.getSheetByName(backupName);
          if (old) ss.deleteSheet(old);
          const b = sh.copyTo(ss);
          b.setName(backupName);
          b.hideSheet();
        }
        sh.clear();
      } else {
        sh = ss.insertSheet(sheetName);
      }

      sh.getRange(1, 1, 1, maxCols).setValues([hdr]);
      if (rowData.length) sh.getRange(2, 1, rowData.length, maxCols).setValues(rowData);

      const metadata = {
        timestamp: new Date().toISOString(),
        version: meta.version || '2.0',
        eleveCount: ids.length,
        checksum: generateChecksum(ids)
      };
      sh.getRange(1, maxCols + 1).setValue(metadata.timestamp);
      sh.getRange(1, maxCols + 2).setValue(metadata.version);
      sh.getRange(1, maxCols + 3).setValue(metadata.eleveCount);
      sh.getRange(1, maxCols + 4).setValue(metadata.checksum);

      if (hideSheet) sh.hideSheet();
      if (!lightFormat) {
        const headerRange = sh.getRange(1, 1, 1, maxCols);
        headerRange.setBackground('#5b21b6').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');
        if (rowData.length) {
          const range = sh.getRange(2, 1, rowData.length, maxCols);
          sh.setRowHeights(2, rowData.length, 25);
          range.setBorder(true, true, true, true, true, true, '#e0e0e0', SpreadsheetApp.BorderStyle.SOLID);
        }
        sh.setFrozenRows(1);
      }

      savedSheets.push(classe);
    } catch (err) {
      errors.push(`❌ ${classe}: ${err.message}`);
    }
  });

  const successCount = savedSheets.length;
  const total = Object.keys(classMap).length;
  const result = (successCount === 0)
    ? { success: false, message: '❌ Aucune classe sauvegardée', errors }
    : (successCount < total)
      ? { success: true, partial: true, message: `⚠️ ${successCount}/${total} classes sauvegardées`, savedSheets, errors }
      : { success: true, message: `✅ ${successCount} onglet(s) ${suffix} mis à jour`, savedSheets };

  logSaveOperation(`saveElevesGeneric(${suffix})`, result);
  releaseSafely();
  return result;
}

function saveElevesCache(classMap) {
  return saveElevesGeneric(classMap, {
    suffix: 'CACHE', backup: false, hideSheet: false, lightFormat: true, withLock: true, meta: { version: '2.0' }
  });
}
function saveElevesSnapshot(classMap) {
  return saveElevesGeneric(classMap, {
    suffix: ELEVES_MODULE_CONFIG.SNAPSHOT_SUFFIX || 'INT', backup: false, hideSheet: true, lightFormat: false, withLock: false, meta: { version: '2.0' }
  });
}
function saveElevesWIP(disposition) {
  return saveElevesGeneric(disposition, {
    suffix: 'WIP', backup: false, hideSheet: true, lightFormat: true, withLock: false, meta: { version: 'WIP' }
  });
}

/******************** Restauration / Infos *************************/
function restoreBySuffix(suffix) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets().filter(sh => sh.getName().endsWith(suffix));
  const result = [];
  sheets.forEach(sh => {
    const name = sh.getName();
    const classe = name.replace(new RegExp(suffix + '$', 'i'), '');
    const data = sh.getDataRange().getValues();
    if (data.length < 2) return;
    const head = data[0].map(c => String(c));
    const eleves = [];
    for (let r = 1; r < data.length; r++) {
      const row = data[r];
      if (!row[0]) continue;
      const eleve = {};
      head.forEach((col, i) => { eleve[col] = row[i]; });
      eleves.push(eleve);
    }
    result.push({ classe, eleves });
  });
  return result;
}
function restoreElevesCache(){ return restoreBySuffix('CACHE'); }

function getSuffixInfo(suffix) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets().filter(sh => sh.getName().endsWith(suffix));
  let lastDate = null;
  sheets.forEach(sh => {
    const data = sh.getDataRange().getValues();
    if (data.length && data[0].length > 0) {
      const dateCell = data[0][data[0].length - 1];
      if (dateCell) {
        const d = new Date(dateCell);
        if (!isNaN(d) && (!lastDate || d > lastDate)) lastDate = d;
      }
    }
  });
  return lastDate ? { exists:true, date: lastDate.toISOString() } : { exists:false };
}
function getCacheInfo(){ return getSuffixInfo('CACHE'); }
function getWIPInfo(){ return getSuffixInfo('WIP'); }

/******************** Autres utilitaires *************************/
function getEleveById_(id) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const idStr  = _eleves_s(id);
  if (!idStr) return null;
  const domain = __elevesBackendDomain;

  for (const sh of ss.getSheets()) {
    const name = sh.getName();
    if (/INT$/i.test(name)) continue;
    const data = sh.getDataRange().getValues();
    if (!data.length) continue;
    const columns = domain.buildColumnIndex(data[0]);
    const colId = columns.id;
    if (colId === -1) continue;
    for (let r = 1; r < data.length; r++) {
      if (_eleves_s(data[r][colId]) === idStr) {
        const student = domain.createStudent(data[r], columns);
        if (student) return domain.sanitize(student);
      }
    }
  }
  return null;
}

function getElevesStats(){
  try {
    const groups = getElevesData();
    if(!groups || groups.length === 0) return { global: {COM: 0, TRA: 0, PART: 0}, parClasse: [] };

    const realClasses = groups.filter(grp => {
      const className = String(grp.classe || '').trim();
      return !className.match(/^(?:level[\s_-]?|niv(?:eau)?[\s_-]?|grp(?:oupe)?[\s_-]?|groupe[\s_-]?|group[\s_-]?|niveau[\s_-]?)/i) &&
             className.length > 0;
    });

    const g = {COM: 0, TRA: 0, PART: 0, count: 0};
    const list = [];
    realClasses.forEach(grp => {
      if (!grp.eleves || grp.eleves.length === 0) return;
      const s = {COM: 0, TRA: 0, PART: 0};
      grp.eleves.forEach(e => {
        if (e.scores) { s.COM += e.scores.COM || 0; s.TRA += e.scores.TRA || 0; s.PART += e.scores.PART || 0; }
      });
      const n = grp.eleves.length;
      list.push({ classe: grp.classe, COM: Math.round(s.COM / n * 100) / 100, TRA: Math.round(s.TRA / n * 100) / 100, PART: Math.round(s.PART / n * 100) / 100 });
      g.COM += s.COM; g.TRA += s.TRA; g.PART += s.PART; g.count += n;
    });

    const globalStats = g.count > 0 ? {
      COM: Math.round(g.COM / g.count * 100) / 100,
      TRA: Math.round(g.TRA / g.count * 100) / 100,
      PART: Math.round(g.PART / g.count * 100) / 100
    } : {COM: 0, TRA: 0, PART: 0};

    return _eleves_sanitizeForSerialization({ global: globalStats, parClasse: list });
  } catch (e) {
    console.error('Erreur dans getElevesStats:', e);
    return {global: {COM: 0, TRA: 0, PART: 0}, parClasse: []};
  }
}

function getINTScores() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = ss.getSheets();
    const intSheets = sheets.filter(sheet => /INT$/i.test(sheet.getName()));
    if (intSheets.length === 0) return { success: false, error: 'Aucun fichier INT trouvé' };

    const scores = [];
    intSheets.forEach(sheet => {
      const data = sheet.getDataRange().getValues();
      if (data.length < 2) return;
      const headers = data[0].map(h => String(h || '').toUpperCase());
      const idCol = headers.findIndex(h => h === 'ID' || h === 'ID_ELEVE');
      const mathCol = headers.findIndex(h => h === 'MATH' || h === 'MATHEMATIQUES');
      const frCol = headers.findIndex(h => h === 'FR' || h === 'FRANCAIS' || h === 'FRANÇAIS');
      if (idCol === -1) return;

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const id = String(row[idCol] || '').trim();
        if (!id) continue;
        const score = { id, MATH: null, FR: null, source: sheet.getName() };

        if (mathCol !== -1 && row[mathCol] !== undefined && row[mathCol] !== '') {
          const mathScore = parseFloat(row[mathCol]);
          if (!isNaN(mathScore) && mathScore >= 0 && mathScore <= 20) score.MATH = mathScore > 4 ? (mathScore / 5) : mathScore;
        }
        if (frCol !== -1 && row[frCol] !== undefined && row[frCol] !== '') {
          const frScore = parseFloat(row[frCol]);
          if (!isNaN(frScore) && frScore >= 0 && frScore <= 20) score.FR = frScore > 4 ? (frScore / 5) : frScore;
        }
        if (score.MATH !== null || score.FR !== null) scores.push(score);
      }
    });

    return { success: true, scores, count: scores.length, sources: intSheets.map(s => s.getName()) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/******************** Optimisation (inchangé, version courte) *************************/
// (tu peux garder tes fonctions d'optimisation avancées si tu les utilises réellement)
// ... createRandomSolution, evaluateSolutionAdvanced, selectParent, crossover, mutate, etc.
// (Par souci de concision, je ne les recolle pas ici ; reprends tes versions si besoin.)

/*************************** include() pour templates *******************************/
// Fonction include pour inclure d'autres fichiers HTML dans les templates
function include(filename) {
  try {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  } catch (error) {
    console.error('Erreur include:', error);
    return '';
  }
}

/*************************** doGet *******************************/
function doGet(e) {
  // ✅ CORRECTION : Utiliser createTemplateFromFile pour évaluer les <?!= include() ?>
  const template = HtmlService.createTemplateFromFile('InterfaceV2');
  return template.evaluate()
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .setTitle('Répartition Classes - Interface Compacte avec Swaps');
}

/************************* Fonctions de test **************************/
function testGetStructureRules() { const rules = getStructureRules(); console.log('Règles depuis _STRUCTURE:', JSON.stringify(rules, null, 2)); return rules; }
function testGetElevesDataV2() {
  const result = getElevesData(); console.log('Résultat getElevesData:', JSON.stringify(result, null, 2));
  if (result.length > 0) { console.log('\nRésumé:'); result.forEach(group => { console.log(`- ${group.classe}: ${group.eleves.length} élèves`); }); }
  return result;
}

/**
 * Fonction attendue par l'interface V2 pour charger les classes et règles
 * @param {string} mode - 'TEST', 'CACHE', 'INT', 'FIN', 'PREVIOUS'
 */
function getClassesData(mode) {
  try {
    const data = getElevesDataForMode(mode);
    const rules = getStructureRules();
    return { success: true, data, rules };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/******************** FINALISATION – créer onglets <classe>FIN ********************/

/**
 * Formate un onglet FIN avec mise en forme professionnelle et moyennes
 * @param {Sheet} sheet - L'onglet à formater
 * @param {Array} rowData - Les données des élèves
 * @param {Array} header - L'en-tête des colonnes
 */
function formatFinSheet(sheet, rowData, header) {
  try {
    const numRows = rowData.length;
    if (numRows === 0) return;

    // ========== 1. LARGEURS DES COLONNES ==========
    sheet.setColumnWidth(4, 240);   // D: NOM & PRENOM
    sheet.setColumnWidth(5, 70);    // E: SEXE
    sheet.setColumnWidth(6, 90);    // F: LV2
    sheet.setColumnWidth(7, 110);   // G: OPT
    sheet.setColumnWidth(8, 75);    // H: COM
    sheet.setColumnWidth(9, 75);    // I: TRA
    sheet.setColumnWidth(10, 75);   // J: PART
    sheet.setColumnWidth(11, 75);   // K: ABS
    sheet.setColumnWidth(12, 90);   // L: DISPO
    sheet.setColumnWidth(13, 80);   // M: ASSO
    sheet.setColumnWidth(14, 80);   // N: DISSO
    sheet.setColumnWidth(15, 130);  // O: SOURCE

    // ========== 2. EN-TÊTE (ligne 1) - Violet foncé + Blanc gras + Capitales ==========
    const headerRange = sheet.getRange(1, 1, 1, header.length);
    headerRange
      .setBackground('#5b21b6')
      .setFontColor('#ffffff')
      .setFontWeight('bold')
      .setFontSize(11)
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');

    // Mettre en capitales
    const headerValues = header.map(h => String(h).toUpperCase());
    sheet.getRange(1, 1, 1, header.length).setValues([headerValues]);

    // ========== 3. FORMATAGE COLONNE D (NOM & PRENOM) - Gras 14pt ==========
    if (numRows > 0) {
      const namesRange = sheet.getRange(2, 4, numRows, 1);
      namesRange.setFontWeight('bold').setFontSize(14);
    }

    // ========== 4. FORMATAGE COLONNE E (SEXE) - F=rose, M=bleu ==========
    if (numRows > 0) {
      for (let r = 0; r < numRows; r++) {
        const sexeValue = String(rowData[r][4] || '').toUpperCase().trim(); // colonne 5 = index 4
        const sexeCell = sheet.getRange(r + 2, 5);

        sexeCell.setFontWeight('bold').setFontColor('#000000');

        if (sexeValue === 'F') {
          // F = Fond rose
          sexeCell.setBackground('#fce7f3');
        } else if (sexeValue === 'M') {
          // M = Fond bleu
          sexeCell.setBackground('#dbeafe');
        }
      }
    }

    // ========== 5. FORMATAGE COLONNE F (LV2) - ITA=vert, ESP=orange, autres=noir+blanc ==========
    if (numRows > 0) {
      for (let r = 0; r < numRows; r++) {
        const lv2Value = String(rowData[r][5] || '').toUpperCase().trim(); // colonne 6 = index 5
        const lv2Cell = sheet.getRange(r + 2, 6);

        if (lv2Value === 'ITA' || lv2Value === 'ITALIEN') {
          // ITA = Vert
          lv2Cell.setBackground('#86efac').setFontWeight('bold').setFontColor('#000000');
        } else if (lv2Value === 'ESP' || lv2Value === 'ESPAGNOL') {
          // ESP = Orange
          lv2Cell.setBackground('#fb923c').setFontWeight('bold').setFontColor('#000000');
        } else if (lv2Value) {
          // Autres langues = Fond noir + texte blanc
          lv2Cell.setBackground('#000000').setFontWeight('bold').setFontColor('#ffffff');
        }
      }
    }

    // ========== 6. FORMATAGE COLONNE G (OPT) - CHAV=violet, autres=gris ==========
    if (numRows > 0) {
      for (let r = 0; r < numRows; r++) {
        const optValue = String(rowData[r][6] || '').toUpperCase().trim(); // colonne 7 = index 6
        const optCell = sheet.getRange(r + 2, 7);

        if (optValue === 'CHAV') {
          // CHAV = Fond violet + texte blanc
          optCell.setBackground('#5b21b6').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');
        } else if (optValue) {
          // Autres options = Fond gris + texte noir
          optCell.setBackground('#d1d5db').setFontColor('#000000').setFontWeight('bold').setHorizontalAlignment('center');
        }
      }
    }

    // ========== 7. FORMATAGE COLONNE M (ASSO) - Gras noir + Fond bleu SI REMPLI ==========
    if (numRows > 0) {
      for (let r = 0; r < numRows; r++) {
        const assoValue = String(rowData[r][12] || '').trim(); // colonne 13 = index 12
        const assoCell = sheet.getRange(r + 2, 13);

        // Toujours mettre en gras noir
        assoCell.setFontWeight('bold').setFontColor('#000000');

        if (assoValue) {
          // Fond bleu uniquement si rempli
          assoCell.setBackground('#3b82f6').setFontColor('#ffffff');
        }
      }
    }

    // ========== 8. FORMATAGE COLONNE N (DISSO) - Blanc gras sur bleu UNIQUEMENT SI REMPLI ==========
    if (numRows > 0) {
      for (let r = 0; r < numRows; r++) {
        const dissoValue = String(rowData[r][13] || '').trim(); // colonne 14 = index 13
        const dissoCell = sheet.getRange(r + 2, 14);

        if (dissoValue) {
          // Uniquement colorier si la cellule est remplie
          dissoCell.setBackground('#3b82f6').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');
        }
      }
    }

    // ========== 9. FORMATAGE CONDITIONNEL DES SCORES (colonnes H, I, J, K) ==========
    if (numRows > 0) {
      const scoreColumns = [8, 9, 10, 11]; // H, I, J, K

      for (let col of scoreColumns) {
        for (let r = 0; r < numRows; r++) {
          const scoreValue = rowData[r][col - 1]; // index = col - 1
          const scoreCell = sheet.getRange(r + 2, col);
          scoreCell.setHorizontalAlignment('center').setFontWeight('bold');

          if (scoreValue === 1 || scoreValue === '1') {
            // Score 1 = Rouge + Blanc gras
            scoreCell.setBackground('#dc2626').setFontColor('#ffffff');
          } else if (scoreValue === 2 || scoreValue === '2') {
            // Score 2 = Jaune CLAIR + Noir gras
            scoreCell.setBackground('#fde047').setFontColor('#000000');
          } else if (scoreValue === 3 || scoreValue === '3') {
            // Score 3 = Vert clair + Noir gras
            scoreCell.setBackground('#86efac').setFontColor('#000000');
          } else if (scoreValue === 4 || scoreValue === '4') {
            // Score 4 = Vert foncé + Blanc gras
            scoreCell.setBackground('#16a34a').setFontColor('#ffffff');
          }
        }
      }
    }

    // ========== 10. CENTRAGE DES COLONNES E à O (sauf D) ==========
    if (numRows > 0) {
      const centerCols = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14]; // E à N
      centerCols.forEach(col => {
        sheet.getRange(2, col, numRows, 1).setHorizontalAlignment('center');
      });
    }

    // ========== 11. BORDURES POUR TOUTES LES DONNÉES ==========
    if (numRows > 0) {
      const dataRange = sheet.getRange(2, 1, numRows, header.length);
      dataRange.setBorder(true, true, true, true, true, true, '#d1d5db', SpreadsheetApp.BorderStyle.SOLID);
    }

    // ========== 12. MOYENNES DYNAMIQUES AVEC FORMULES ==========
    // Position : 2 lignes après le dernier élève
    const avgRow = numRows + 4; // +2 pour l'en-tête, +2 lignes vides

    // Écrire "MOYENNE" dans la colonne D
    sheet.getRange(avgRow, 4).setValue('MOYENNE').setFontWeight('bold').setFontSize(12).setHorizontalAlignment('right');

    // Créer des formules AVERAGE pour les colonnes H, I, J, K
    const firstDataRow = 2;
    const lastDataRow = numRows + 1;

    // Formule pour COM (colonne H)
    sheet.getRange(avgRow, 8).setFormula(`=AVERAGE(H${firstDataRow}:H${lastDataRow})`);
    // Formule pour TRA (colonne I)
    sheet.getRange(avgRow, 9).setFormula(`=AVERAGE(I${firstDataRow}:I${lastDataRow})`);
    // Formule pour PART (colonne J)
    sheet.getRange(avgRow, 10).setFormula(`=AVERAGE(J${firstDataRow}:J${lastDataRow})`);
    // Formule pour ABS (colonne K)
    sheet.getRange(avgRow, 11).setFormula(`=AVERAGE(K${firstDataRow}:K${lastDataRow})`);

    // Formater la ligne des moyennes (fond gris clair + gras + centré)
    const avgRange = sheet.getRange(avgRow, 4, 1, 8); // D à K
    avgRange
      .setBackground('#f3f4f6')
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setFontSize(11)
      .setNumberFormat('0.00')
      .setBorder(true, true, true, true, false, false, '#9ca3af', SpreadsheetApp.BorderStyle.SOLID);

    // ========== 13. FIGER L'EN-TÊTE ==========
    sheet.setFrozenRows(1);

    console.log(`✅ Formatage FIN appliqué : ${numRows} élèves, moyennes DYNAMIQUES ligne ${avgRow}`);

  } catch (error) {
    console.error('❌ Erreur dans formatFinSheet:', error);
  }
}

/**
 * Construit un index des classes d'origine à partir de l'onglet CONSOLIDATION.
 * @returns {Object} Un objet mappant ID_ELEVE -> SOURCE.
 */
function buildSourceIndexFromConsolidation() {
  const sourceIndex = {};
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const consolidationSheet = ss.getSheetByName('CONSOLIDATION');
    if (!consolidationSheet) {
      console.warn('Onglet CONSOLIDATION introuvable. La source ne sera pas corrigée.');
      return sourceIndex;
    }

    const data = consolidationSheet.getDataRange().getValues();
    const header = data[0].map(h => h.toString().toUpperCase().trim());
    
    const idCol = header.indexOf('ID_ELEVE');
    const sourceCol = header.indexOf('SOURCE');

    if (idCol === -1 || sourceCol === -1) {
      console.warn('Colonnes ID_ELEVE ou SOURCE introuvables dans CONSOLIDATION.');
      return sourceIndex;
    }

    for (let i = 1; i < data.length; i++) {
      const id = data[i][idCol] ? data[i][idCol].toString().trim() : null;
      const source = data[i][sourceCol] ? data[i][sourceCol].toString().trim() : null;
      if (id && source) {
        sourceIndex[id] = source;
      }
    }
    console.log('Index de source créé depuis CONSOLIDATION pour ' + Object.keys(sourceIndex).length + ' élèves.');
  } catch (e) {
    console.error('Erreur lors de la création de l\'index de source depuis CONSOLIDATION:', e);
  }
  return sourceIndex;
}

/**
 * Finalise les classes en créant les onglets définitifs visibles <classe>FIN
 * @param {Object} disposition - mapping {classe: [id1, id2, ...]}
 * @param {string} mode - source ('TEST','CACHE','WIP','INT','FIN' ...)
 */
function finalizeClasses(disposition, mode) {
  try {
    if (!disposition || typeof disposition !== 'object') return { success: false, error: 'Disposition invalide' };

    const sourceIndex = buildSourceIndexFromConsolidation();
    const targetMode = (mode || 'TEST').toUpperCase();
    console.log('💾 Finalisation depuis le mode: ' + targetMode);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const header = [
      'ID_ELEVE','NOM','PRENOM','NOM & PRENOM','SEXE','LV2','OPT','COM','TRA','PART','ABS',
      'DISPO','ASSO','DISSO','SOURCE','FIXE','CLASSE_FINALE','CLASSE DEF','','MOBILITE','SCORE F','SCORE M','GROUP'
    ];

    const elevesData = getElevesDataForMode(targetMode);
    const elevesIndex = {};
    elevesData.forEach(grp => { grp.eleves.forEach(e => { elevesIndex[e.id] = e; }); });

    Object.keys(disposition).forEach(classe => {
      const eleveIds = disposition[classe] || [];
      const rowData = eleveIds.map(id => {
        const e = elevesIndex[id];
        if (!e) {
          return [ id,'','',id,'','','', '', '', '', '', '', '', '', sourceIndex[id] || '', '', classe, classe, '', 'LIBRE', '', '', '' ];
        }
        let lv2 = (e.lv2 || '').toString().trim().toUpperCase();
        const finalSource = sourceIndex[id] || e.source || '';
        return [
          e.id, e.nom || '', e.prenom || '', (e.nom || '') + ' ' + (e.prenom || ''),
          e.sexe || '', lv2, e.opt || '', e.scores?.COM ?? '', e.scores?.TRA ?? '', e.scores?.PART ?? '', e.scores?.ABS ?? '',
          e.dispo || '', e.asso || '', e.disso || '', finalSource, '',
          classe, classe, '', e.mobilite || 'LIBRE', '', '', ''
        ];
      });
      if (rowData.length === 0) rowData.push(Array(header.length).fill(''));

      const sheetName = classe + 'FIN';
      let sh = ss.getSheetByName(sheetName);
      if (sh) sh.clear(); else sh = ss.insertSheet(sheetName);

      sh.getRange(1, 1, 1, header.length).setValues([header]);
      if (rowData.length > 0) {
        sh.getRange(2, 1, rowData.length, header.length).setValues(rowData);
      }

      // ✅ FORMATAGE PROFESSIONNEL AVEC MOYENNES
      formatFinSheet(sh, rowData, header);

      // Cacher les colonnes non utilisées (A, B, C, P+)
      const hiddenCols = [1, 2, 3, 16, 17, 18, 19, 20, 21, 22, 23];
      hiddenCols.forEach(idx => {
        try {
          if (idx <= header.length) sh.hideColumns(idx, 1);
        } catch(e) {}
      });
    });

    console.log('✅ Classes finalisées en <classe>FIN');
    return { success: true, message: '✅ ' + Object.keys(disposition).length + ' classe(s) finalisée(s)' };
  } catch (e) {
    console.error('❌ Erreur dans finalizeClasses:', e);
    return { success: false, error: e.toString() };
  }
}

/******************** Logging + checksum *************************/
function generateChecksum(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return '';
  const concatenated = ids.slice().sort().join('|');
  let hash = 0;
  for (let i = 0; i < concatenated.length; i++) {
    const char = concatenated.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}
function logSaveOperation(operation, details) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let logSheet = ss.getSheetByName('_SAVE_LOG');
    if (!logSheet) {
      logSheet = ss.insertSheet('_SAVE_LOG');
      logSheet.appendRow(['Timestamp', 'User', 'Operation', 'Status', 'Details']);
      logSheet.hideSheet();
    }
    const timestamp = new Date().toISOString();
    const user = Session.getActiveUser().getEmail();
    logSheet.appendRow([
      timestamp,
      user,
      operation,
      details.success ? 'SUCCESS' : 'FAILURE',
      JSON.stringify(details)
    ]);
  } catch (err) { /* on n'empêche pas l'opération si le log échoue */ }
}

/******************** Sécurité admin – stub ********************/
/** Vérifie un mot de passe admin (remplace par ta logique sécurisée) */
function verifierMotDePasseAdmin(password) {
  const SECRET = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD') || 'changeme';
  var ok = (String(password || '') === String(SECRET));
  return { success: ok };
}
