// ========== CODE SERVEUR GOOGLE APPS SCRIPT POUR LES GROUPES ==========

// Fonction pour obtenir l'interface HTML des groupes
function getGroupsInterface() {
  try {
    // Charger le template HTML principal
    const template = HtmlService.createTemplateFromFile('groupsInterface');
    
    // Évaluer et retourner le HTML
    return template.evaluate().getContent();
  } catch (error) {
    console.error('Erreur getGroupsInterface:', error);
    throw new Error('Impossible de charger l\'interface des groupes');
  }
}

// Fonction include pour inclure d'autres fichiers HTML
function include(filename) {
  try {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  } catch (error) {
    console.error('Erreur include:', error);
    return '';
  }
}

// Obtenir le nombre de groupes
function getGroupsCount() {
  try {
    const cache = CacheService.getScriptCache();
    const groupsData = cache.get('GROUPS_DATA');
    
    if (groupsData) {
      const groups = JSON.parse(groupsData);
      return Object.keys(groups).length;
    }
    
    // Si pas de cache, vérifier dans la feuille
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const groupsSheet = ss.getSheetByName('GROUPES');
    
    if (!groupsSheet) {
      return 0;
    }
    
    // Compter les groupes non vides
    const data = groupsSheet.getDataRange().getValues();
    const headers = data[0];
    let count = 0;
    
    for (let i = 1; i < headers.length; i++) {
      if (headers[i] && headers[i].toString().trim() !== '') {
        count++;
      }
    }
    
    return count;
  } catch (error) {
    console.error('Erreur getGroupsCount:', error);
    return 0;
  }
}

// Sauvegarder les groupes
function saveGroups(groupsData) {
  try {
    // ✅ VALIDATION COMPLÈTE DES DONNÉES
    if (!groupsData) {
      throw new Error('Données de groupes manquantes');
    }

    if (!groupsData.groups) {
      throw new Error('Propriété groups manquante dans les données');
    }

    if (!Array.isArray(groupsData.groups)) {
      throw new Error('La propriété groups doit être un tableau');
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let groupsSheet = ss.getSheetByName('GROUPES');

    // Créer la feuille si elle n'existe pas
    if (!groupsSheet) {
      groupsSheet = ss.insertSheet('GROUPES');
      groupsSheet.setTabColor('#9333ea'); // Couleur violette
    }

    // Effacer le contenu existant
    groupsSheet.clear();

    // Préparer les données pour l'écriture
    const allStudents = [];
    const headers = ['ID', 'Nom', 'Prénom', 'Sexe', 'Classe'];

    // Valider et filtrer les groupes AVANT d'ajouter les headers
    const validGroups = groupsData.groups.filter((group, index) => {
      if (!group || typeof group !== 'object') {
        Logger.log(`⚠️ Groupe ${index} invalide (pas un objet), ignoré`);
        return false;
      }

      if (!group.name) {
        Logger.log(`⚠️ Groupe ${index} sans nom, ignoré`);
        return false;
      }

      if (!Array.isArray(group.students)) {
        Logger.log(`⚠️ Groupe ${index} (${group.name}) n'a pas de tableau students, ignoré`);
        return false;
      }

      return true;
    });

    // Ajouter les headers uniquement pour les groupes valides
    validGroups.forEach(group => {
      headers.push(group.name);
    });

    // Mettre à jour groupsData.groups pour utiliser seulement les groupes valides
    groupsData.groups = validGroups;
    
    // Collecter tous les élèves uniques
    const studentMap = new Map();

    groupsData.groups.forEach((group, groupIndex) => {
      // ✅ Validation de group.students
      if (!group || typeof group !== 'object') {
        Logger.log(`⚠️ Groupe ${groupIndex} invalide, ignoré`);
        return;
      }

      if (!Array.isArray(group.students)) {
        Logger.log(`⚠️ Groupe ${groupIndex} (${group.name}) n'a pas de tableau students, ignoré`);
        return;
      }

      group.students.forEach(studentId => {
        if (!studentId) {
          Logger.log(`⚠️ ID élève vide dans groupe ${group.name}, ignoré`);
          return;
        }

        if (!studentMap.has(studentId)) {
          studentMap.set(studentId, {
            id: studentId,
            groups: new Array(groupsData.groups.length).fill('')
          });
        }
        studentMap.get(studentId).groups[groupIndex] = 'X';
      });
    });
    
    // Récupérer les infos des élèves depuis ELEVES
    const elevesSheet = ss.getSheetByName('ELEVES');
    if (elevesSheet) {
      const elevesData = elevesSheet.getDataRange().getValues();
      if (elevesData.length > 0) {
        const elevesHeaders = elevesData[0];

        const requiredColumns = [
          { key: 'id', name: 'ID_ELEVE' },
          { key: 'nom', name: 'NOM' },
          { key: 'prenom', name: 'PRENOM' },
          { key: 'sexe', name: 'SEXE' },
          { key: 'classe', name: 'CLASSE' }
        ];

        const columnIndexes = {};
        const missingColumns = [];

        requiredColumns.forEach(column => {
          const index = elevesHeaders.indexOf(column.name);
          if (index === -1) {
            missingColumns.push(column.name);
          } else {
            columnIndexes[column.key] = index;
          }
        });

        if (missingColumns.length > 0) {
          const message = `Colonnes manquantes dans ELEVES: ${missingColumns.join(', ')}`;
          console.error(`Erreur saveGroups: ${message}`);
          throw new Error(message);
        }

        for (let i = 1; i < elevesData.length; i++) {
          const id = elevesData[i][columnIndexes.id];
          if (studentMap.has(id)) {
            const student = studentMap.get(id);
            student.nom = elevesData[i][columnIndexes.nom] || '';
            student.prenom = elevesData[i][columnIndexes.prenom] || '';
            student.sexe = elevesData[i][columnIndexes.sexe] || '';
            student.classe = elevesData[i][columnIndexes.classe] || '';
          }
        }
      }
    }
    
    // Construire le tableau de données
    const dataRows = [headers];
    
    studentMap.forEach((student, id) => {
      const row = [
        id,
        student.nom || '',
        student.prenom || '',
        student.sexe || '',
        student.classe || ''
      ];
      row.push(...student.groups);
      dataRows.push(row);
    });
    
    // Écrire les données
    if (dataRows.length > 1) {
      groupsSheet.getRange(1, 1, dataRows.length, dataRows[0].length).setValues(dataRows);
      
      // Formater l'en-tête
      const headerRange = groupsSheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground('#f3f4f6');
      headerRange.setFontWeight('bold');
      
      // Ajuster les colonnes
      groupsSheet.autoResizeColumns(1, headers.length);
      
      // Figer la première ligne et les 5 premières colonnes
      groupsSheet.setFrozenRows(1);
      groupsSheet.setFrozenColumns(5);
    }
    
    // Sauvegarder aussi dans le cache
    const cache = CacheService.getScriptCache();
    cache.put('GROUPS_DATA', JSON.stringify(groupsData), 3600); // 1 heure
    
    // Ajouter les métadonnées
    const metaSheet = ss.getSheetByName('GROUPES_META') || ss.insertSheet('GROUPES_META');
    metaSheet.clear();
    metaSheet.getRange(1, 1, 1, 4).setValues([['Type', 'Date', 'Config', 'Timestamp']]);
    metaSheet.getRange(2, 1, 1, 4).setValues([[
      groupsData.type,
      new Date().toLocaleDateString('fr-FR'),
      JSON.stringify(groupsData.config),
      groupsData.timestamp
    ]]);
    metaSheet.hideSheet();
    
    return true;
  } catch (error) {
    console.error('Erreur saveGroups:', error);
    throw new Error('Erreur lors de la sauvegarde des groupes: ' + error.message);
  }
}

// Obtenir tous les groupes
function getAllGroups() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const groupsSheet = ss.getSheetByName('GROUPES');
    
    if (!groupsSheet) {
      return {};
    }
    
    const data = groupsSheet.getDataRange().getValues();
    if (data.length < 2) {
      return {};
    }
    
    const headers = data[0];
    const groups = {};
    
    // Parser les groupes (colonnes après les 5 premières)
    for (let col = 5; col < headers.length; col++) {
      const groupName = headers[col];
      if (!groupName) continue;
      
      groups[groupName] = {
        name: groupName,
        students: [],
        type: 'unknown'
      };
      
      // Collecter les élèves du groupe
      for (let row = 1; row < data.length; row++) {
        if (data[row][col] === 'X') {
          groups[groupName].students.push({
            id: data[row][0],
            nom: data[row][1],
            prenom: data[row][2],
            sexe: data[row][3],
            classe: data[row][4]
          });
        }
      }
    }
    
    // Récupérer le type depuis les métadonnées
    const metaSheet = ss.getSheetByName('GROUPES_META');
    if (metaSheet) {
      const metaData = metaSheet.getRange(2, 1, 1, 1).getValue();
      Object.values(groups).forEach(group => {
        group.type = metaData || 'unknown';
      });
    }
    
    return groups;
  } catch (error) {
    console.error('Erreur getAllGroups:', error);
    return {};
  }
}

// Supprimer tous les groupes
function deleteAllGroups() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Supprimer la feuille GROUPES
    const groupsSheet = ss.getSheetByName('GROUPES');
    if (groupsSheet) {
      ss.deleteSheet(groupsSheet);
    }
    
    // Supprimer la feuille GROUPES_META
    const metaSheet = ss.getSheetByName('GROUPES_META');
    if (metaSheet) {
      ss.deleteSheet(metaSheet);
    }
    
    // Vider le cache
    const cache = CacheService.getScriptCache();
    cache.remove('GROUPS_DATA');
    
    return true;
  } catch (error) {
    console.error('Erreur deleteAllGroups:', error);
    throw new Error('Erreur lors de la suppression des groupes: ' + error.message);
  }
}

// Obtenir les classes disponibles
function getAvailableClasses() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const classes = new Set();
    
    // Chercher dans les onglets INT
    const sheets = ss.getSheets();
    const intSheets = sheets.filter(sheet => sheet.getName().endsWith('INT'));
    
    if (intSheets.length > 0) {
      const latestSheet = intSheets[intSheets.length - 1];
      const data = latestSheet.getDataRange().getValues();

      if (data.length > 1) {
        const headers = data[0];
        const classeCol = headers.indexOf('CLASSE');

        if (classeCol === -1) {
          console.error(`Erreur getAvailableClasses: colonne CLASSE introuvable dans ${latestSheet.getName()}`);
        } else {
          for (let i = 1; i < data.length; i++) {
            const classe = data[i][classeCol];
            if (classe) {
              classes.add(classe.toString());
            }
          }
        }
      }
    }
    
    // Si pas de classes trouvées, utiliser des valeurs par défaut
    if (classes.size === 0) {
      ['501', '502', '503', '504', '505', '506'].forEach(c => classes.add(c));
    }
    
    return Array.from(classes).sort();
  } catch (error) {
    console.error('Erreur getAvailableClasses:', error);
    return ['501', '502', '503', '504', '505', '506'];
  }
}

// Fonction pour créer automatiquement la structure de démonstration
function createGroupsDemoData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Créer quelques groupes de démonstration
    const demoGroups = {
      type: 'language',
      groups: [
        {
          name: 'ESP - Groupe 1',
          students: ['eleve1', 'eleve5', 'eleve9']
        },
        {
          name: 'ESP - Groupe 2',
          students: ['eleve2', 'eleve6', 'eleve10']
        },
        {
          name: 'ITA - Groupe 1',
          students: ['eleve3', 'eleve7', 'eleve11']
        },
        {
          name: 'ITA - Groupe 2',
          students: ['eleve4', 'eleve8', 'eleve12']
        }
      ],
      config: {
        language: 'ESP',
        classes: ['501', '502', '503']
      },
      timestamp: new Date().toISOString()
    };
    
    // Sauvegarder les groupes de démonstration
    saveGroups(demoGroups);
    
    return true;
  } catch (error) {
    console.error('Erreur createGroupsDemoData :', error);
    return false;
  }
}   // <-- FIN de createGroupsDemoData()


// ========== PATCHES SERVEUR POUR LA GESTION DES SCORES ==========

// 2. PATCH: Sauvegarder les scores dans les colonnes U et V
function saveScoresToSheet(className, scores) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = className.replace(/INT$/i, '') + 'INT';
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      throw new Error(`Onglet ${sheetName} non trouvé`);
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // Vérifier/ajouter les en-têtes pour les scores
    if (!headers[20] || headers[20] !== 'SCORE F') {
      sheet.getRange(1, 21).setValue('SCORE F');
    }
    if (!headers[21] || headers[21] !== 'SCORE M') {
      sheet.getRange(1, 22).setValue('SCORE M');
    }
    
    // Valider les colonnes NOM/PRENOM
    const nomCol = headers.indexOf('NOM');
    const prenomCol = headers.indexOf('PRENOM');

    if (nomCol === -1 || prenomCol === -1) {
      throw new Error(`Colonnes NOM/PRENOM introuvables dans ${sheetName}`);
    }

    // Mettre à jour les scores pour chaque élève
    scores.forEach(score => {
      // Normaliser les valeurs de recherche
      const scoreNomNormalized = (score.nom || '').toString().trim().toUpperCase();
      const scorePrenomNormalized = (score.prenom || '').toString().trim().toUpperCase();

      // Trouver l'élève par nom et prénom
      for (let i = 1; i < data.length; i++) {
        const nomNormalized = (data[i][nomCol] || '').toString().trim().toUpperCase();
        const prenomNormalized = (data[i][prenomCol] || '').toString().trim().toUpperCase();

        if (nomNormalized === scoreNomNormalized &&
            prenomNormalized === scorePrenomNormalized) {
          // Mettre à jour les scores avec validation
          const validScoreF = Math.max(0, Math.min(4, parseInt(score.scoreF, 10) || 0));
          const validScoreM = Math.max(0, Math.min(4, parseInt(score.scoreM, 10) || 0));

          sheet.getRange(i + 1, 21).setValue(validScoreF || '');
          sheet.getRange(i + 1, 22).setValue(validScoreM || '');
          break;
        }
      }
    });
    
    // Formater les colonnes de scores
    const scoreRange = sheet.getRange(2, 21, sheet.getLastRow() - 1, 2);
    scoreRange.setHorizontalAlignment('center');
    scoreRange.setBackground('#f0f9ff'); // Bleu clair
    
    return true;
  } catch (error) {
    console.error('Erreur saveScoresToSheet:', error);
    throw error;
  }
}

// 4. PATCH: Importer les scores depuis un fichier CSV
function importScoresFromCSV(csvData) {
  try {
    const lines = csvData.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    // Vérifier les colonnes requises
    const requiredColumns = ['Classe', 'Nom', 'Prénom', 'Score F', 'Score M'];
    const missingColumns = requiredColumns.filter(col => !headers.includes(col));
    
    if (missingColumns.length > 0) {
      throw new Error(`Colonnes manquantes : ${missingColumns.join(', ')}`);
    }
    
    // Parser les scores
    const scoresByClass = {};
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length < headers.length) continue;
      
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });
      
      const className = row['Classe'];
      if (!scoresByClass[className]) {
        scoresByClass[className] = [];
      }
      
      scoresByClass[className].push({
        nom: row['Nom'],
        prenom: row['Prénom'],
        scoreF: parseInt(row['Score F']) || 0,
        scoreM: parseInt(row['Score M']) || 0
      });
    }
    
    // Sauvegarder les scores dans chaque classe
    let totalUpdated = 0;
    Object.entries(scoresByClass).forEach(([className, scores]) => {
      try {
        saveScoresToSheet(className, scores);
        totalUpdated += scores.length;
      } catch (error) {
        console.error(`Erreur pour la classe ${className}:`, error);
      }
    });
    
    return {
      success: true,
      message: `${totalUpdated} scores importés avec succès`,
      details: scoresByClass
    };
  } catch (error) {
    console.error('Erreur importScoresFromCSV:', error);
    throw error;
  }
}

// 5. PATCH: Générer un template CSV pour l'import des scores
function generateScoreTemplate() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const students = getStudentsForGroups();
    
    // Créer le CSV
    let csv = 'Classe,Nom,Prénom,Score F,Score M\n';
    
    students.forEach(student => {
      csv += `"${student.classe}","${student.nom}","${student.prenom}","",""\n`;
    });
    
    return csv;
  } catch (error) {
    console.error('Erreur generateScoreTemplate:', error);
    throw error;
  }
}

// 6. PATCH: Statistiques des scores par classe
function getScoreStatistics() {
  try {
    const students = getStudentsForGroups();
    const stats = {};
    
    students.forEach(student => {
      const className = student.classe;
      if (!stats[className]) {
        stats[className] = {
          total: 0,
          scoreF: {1: 0, 2: 0, 3: 0, 4: 0, 0: 0},
          scoreM: {1: 0, 2: 0, 3: 0, 4: 0, 0: 0},
          avgF: 0,
          avgM: 0
        };
      }
      
      stats[className].total++;
      stats[className].scoreF[student.scores.F || 0]++;
      stats[className].scoreM[student.scores.M || 0]++;
    });
    
    // Calculer les moyennes
    Object.keys(stats).forEach(className => {
      let sumF = 0, sumM = 0, countF = 0, countM = 0;
      
      [1, 2, 3, 4].forEach(score => {
        sumF += score * stats[className].scoreF[score];
        countF += stats[className].scoreF[score];
        sumM += score * stats[className].scoreM[score];
        countM += stats[className].scoreM[score];
      });
      
      stats[className].avgF = countF > 0 ? (sumF / countF).toFixed(2) : 0;
      stats[className].avgM = countM > 0 ? (sumM / countM).toFixed(2) : 0;
    });
    
    return stats;
  } catch (error) {
    console.error('Erreur getScoreStatistics:', error);
    return {};
  }
}

/* ====================================================================
   CLASSES INT DISPONIBLES POUR L’INTERFACE
   --------------------------------------------------------------------
   - getINTClasses()            → renvoie ["6°1", "6°2", …] (sans “INT”)
   - getINTClassesForInterface  → alias conservé pour le front‑end
   ==================================================================== */

/**
 * Parcourt le classeur et renvoie la liste des classes pour
 * lesquelles il existe un onglet nommé « …INT ».
 *
 * Exemple : un onglet “6°1INT” ⇒ la chaîne “6°1” sera renvoyée.
 */
function getINTClasses() {
  try {
    const ss      = SpreadsheetApp.getActiveSpreadsheet();
    const classes = ss.getSheets()
                      .map(s => s.getName())
                      .filter(n => n.endsWith('INT'))   // ne garder que les onglets INT
                      .map(n => n.replace(/INT$/, ''))  // retirer “INT” pour l’affichage
                      .sort();

    // Valeurs de secours si aucune classe trouvée
    return classes.length ? classes
                          : ['501', '502', '503', '504', '505', '506'];
  } catch (err) {
    console.error('Erreur getINTClasses :', err);
    // Valeurs par défaut en cas de problème
    return ['501', '502', '503', '504', '505', '506'];
  }
}

/**
 * Alias conservé pour les appels existants côté front‑end
 * (`google.script.run.getINTClassesForInterface()`).
 */
function getINTClassesForInterface() {
  return getINTClasses();
 }

 // ========== FONCTION DE DEBUG POUR LES CLASSES INT ==========
// À ajouter dans le code serveur Google Apps Script

function debugINTClasses() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = ss.getSheets();
    
    console.log('=== DEBUG CLASSES INT ===');
    console.log('Nombre total d\'onglets:', sheets.length);
    
    sheets.forEach(sheet => {
      const name = sheet.getName();
      console.log('Onglet:', name, '- Se termine par INT?', name.endsWith('INT'));
    });
    
    const intSheets = sheets.filter(sheet => sheet.getName().endsWith('INT'));
    console.log('Onglets INT trouvés:', intSheets.length);
    
    const classes = intSheets.map(sheet => sheet.getName().replace('INT', ''));
    console.log('Classes extraites:', classes);
    
    return {
      totalSheets: sheets.length,
      sheetNames: sheets.map(s => s.getName()),
      intSheets: intSheets.map(s => s.getName()),
      classes: classes
    };
  } catch (error) {
    console.error('Erreur debugINTClasses:', error);
    return { error: error.toString() };
  }
}

// Corriger getStudentsForGroups pour retourner les classes INT correctement
function getStudentsForGroups() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const students = [];
    
    // Chercher tous les onglets se terminant par INT
    const sheets = ss.getSheets();
    const intSheets = sheets.filter(sheet => sheet.getName().endsWith('INT'));
    
    console.log('Onglets INT trouvés:', intSheets.map(s => s.getName()));
    
    if (intSheets.length === 0) {
      console.log('Aucun onglet INT trouvé, recherche alternative...');
      
      // Alternative : chercher des onglets avec pattern de classe
      const classPattern = /^[0-9]°[0-9]/; // Pattern pour 6°1, 5°2, etc.
      const classSheets = sheets.filter(sheet => classPattern.test(sheet.getName()));
      
      if (classSheets.length > 0) {
        console.log('Onglets de classe trouvés:', classSheets.map(s => s.getName()));
        
        classSheets.forEach(sheet => {
          const className = sheet.getName();
          const data = sheet.getDataRange().getValues();
          
          if (data.length > 1) {
            const headers = data[0];
            
                      // Indices des colonnes avec aliases
          const lv2Aliases = ['LV2', 'LV1', 'LANGUE2', 'L2', 'LANGUE'];
          const indices = {
            nom: headers.indexOf('NOM'),
            prenom: headers.indexOf('PRENOM'),
            sexe: headers.indexOf('SEXE'),
            lv2: headers.findIndex(h => lv2Aliases.includes(h.toString().toUpperCase())),
            com: headers.indexOf('COM'),
            tra: headers.indexOf('TRA'),
            part: headers.indexOf('PART'),
            scoreF: headers.indexOf('SCORE F') !== -1 ? headers.indexOf('SCORE F') : 20,
            scoreM: headers.indexOf('SCORE M') !== -1 ? headers.indexOf('SCORE M') : 21
          };
            
            // Lire les élèves
            for (let i = 1; i < data.length; i++) {
              const row = data[i];
              if (row[indices.nom]) {
                              students.push({
                id: `${className}_${i}`,
                nom: row[indices.nom] || '',
                prenom: row[indices.prenom] || '',
                sexe: row[indices.sexe] || '',
                classe: nettoyerNomClasse(className),  // ← CORRECTION : nettoyer le nom de classe
                lv2: row[indices.lv2] || '',  // ← CORRECTION : assigner à lv2 au lieu de lv1
                com: parseFloat(row[indices.com]) || 0,
                tra: parseFloat(row[indices.tra]) || 0,
                part: parseFloat(row[indices.part]) || 0,
                scores: {
                  F: parseInt(row[indices.scoreF]) || 0,
                  M: parseInt(row[indices.scoreM]) || 0
                }
              });
              }
            }
          }
        });
      }
    } else {
      // Parcourir chaque onglet INT
      intSheets.forEach(sheet => {
        const className = sheet.getName();
        const data = sheet.getDataRange().getValues();
        
        if (data.length > 1) {
          const headers = data[0];
          
          // Indices des colonnes avec aliases
          const lv2Aliases = ['LV2', 'LV1', 'LANGUE2', 'L2', 'LANGUE'];
          const indices = {
            nom: headers.indexOf('NOM'),
            prenom: headers.indexOf('PRENOM'),
            sexe: headers.indexOf('SEXE'),
            lv2: headers.findIndex(h => lv2Aliases.includes(h.toString().toUpperCase())),
            com: headers.indexOf('COM'),
            tra: headers.indexOf('TRA'),
            part: headers.indexOf('PART'),
            scoreF: headers.indexOf('SCORE F') !== -1 ? headers.indexOf('SCORE F') : 20,
            scoreM: headers.indexOf('SCORE M') !== -1 ? headers.indexOf('SCORE M') : 21
          };

          // Lire les élèves
          for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (row[indices.nom]) {
              students.push({
                id: `${className}_${i}`,
                nom: row[indices.nom] || '',
                prenom: row[indices.prenom] || '',
                sexe: row[indices.sexe] || '',
                classe: nettoyerNomClasse(className.replace('INT', '')),
                lv2: row[indices.lv2] || '',
                com: parseFloat(row[indices.com]) || 0,
                tra: parseFloat(row[indices.tra]) || 0,
                part: parseFloat(row[indices.part]) || 0,
                scores: {
                  F: Math.max(0, Math.min(4, parseInt(row[indices.scoreF], 10) || 0)),
                  M: Math.max(0, Math.min(4, parseInt(row[indices.scoreM], 10) || 0))
                }
              });
            }
          }
        }
      });
    }
    
    console.log('Total élèves trouvés:', students.length);
    return students;
  } catch (error) {
    console.error('Erreur getStudentsForGroups:', error);
    throw error;
  }
}

// ========== FONCTION DE NETTOYAGE DES NOMS DE CLASSES ==========
function nettoyerNomClasse(nomClasse) {
  if (!nomClasse) return '';
  
  let nomNettoye = nomClasse.toString()
    .replace(/Â°/g, '°')  // Corriger "6Â°4" → "6°4"
    .replace(/°/g, '°')   // Normaliser le caractère degré
    .replace(/\s+/g, ' ') // Normaliser les espaces
    .trim();
  
  // Log pour debug
  if (nomClasse !== nomNettoye) {
    console.log(`Classe corrigée: "${nomClasse}" → "${nomNettoye}"`);
  }
  
  return nomNettoye;
}

// ========== AJOUT : Fonction generateGroupsOnServer attendue par le frontend ========== //
function generateGroupsOnServer(params) {
  try {
    console.log('Génération des groupes avec params:', params);

    // CORRECTION : Utiliser getStudentsFromFINClasses au lieu de getStudentsForGroups
    const filteredStudents = getStudentsFromFINClasses(params.selectedClasses);

    console.log(`📊 Élèves chargés depuis FIN (${params.selectedClasses.join(', ')}): ${filteredStudents.length}`);
    
    if (params.groupType === 'language') {
      // CORRECTION : Utiliser la même logique de filtrage que le frontend
      const langStudents = filteredStudents.filter(student => {
        // Normaliser la valeur de langue
        const langue = (student.lv2 || '').trim().toUpperCase();  // ← CORRECTION : utiliser lv2
        
        // Logique corrigée pour ESP/ITA
        if (params.selectedLanguage === 'ITA') {
          return langue === 'ITA';
        } else {
          // Pour ESP : inclure ESP explicite ET les valeurs vides (par défaut)
          return langue === 'ESP' || langue === '' || !langue;
        }
      });
      
      console.log(`📊 Élèves filtrés par langue (${params.selectedLanguage}): ${langStudents.length}`);
      console.log('📋 Élèves ESP/ITA trouvés:', langStudents.map(s => `${s.nom} ${s.prenom} (${s.lv2})`));  // ← CORRECTION : afficher lv2
      
      // Trier par score PART
      langStudents.sort((a, b) => (b.part || 0) - (a.part || 0));
      
      // Créer les groupes
      const groups = [];
      for (let i = 0; i < params.numGroups; i++) {
        groups.push({
          name: `${params.selectedLanguage} - Groupe ${i + 1}`,
          students: []
        });
      }
      
      // Répartir en serpentin
      langStudents.forEach((student, index) => {
        const groupIndex = index % params.numGroups;
        groups[groupIndex].students.push(student.id);
      });
      
      console.log('✅ Groupes créés:', groups.map(g => `${g.name}: ${g.students.length} élèves`));
      return { groups: groups };
    } else if (params.groupType === 'needs') {
      // Calculer les scores composites
      filteredStudents.forEach(student => {
        if (params.selectedSubject === 'Both') {
          student.compositeScore = ((student.scores?.M || 0) + (student.scores?.F || 0)) / 2;
        } else if (params.selectedSubject === 'Maths') {
          student.compositeScore = student.scores?.M || 0;
        } else {
          student.compositeScore = student.scores?.F || 0;
        }
      });
      // Trier par score
      filteredStudents.sort((a, b) => b.compositeScore - a.compositeScore);
      const groups = [];
      for (let i = 0; i < params.numLevelGroups; i++) {
        groups.push({
          name: `Groupe ${i + 1}`,
          students: []
        });
      }
      if (params.selectedDistributionType === 'homogeneous') {
        // Groupes homogènes
        const groupSize = Math.ceil(filteredStudents.length / params.numLevelGroups);
        filteredStudents.forEach((student, index) => {
          const groupIndex = Math.floor(index / groupSize);
          if (groupIndex < params.numLevelGroups) {
            groups[groupIndex].students.push(student.id);
          }
        });
      } else {
        // Groupes hétérogènes avec équilibrage multi-critères
        console.log('🎯 Algorithme hétérogène avec équilibrage multi-critères activé');

        const totalStudents = filteredStudents.length;
        const targetSize = Math.floor(totalStudents / params.numLevelGroups);
        const remainder = totalStudents % params.numLevelGroups;

        console.log(`📊 Total élèves: ${totalStudents}, Objectif par groupe: ${targetSize}-${targetSize + 1}`);

        // Mélanger aléatoirement pour éviter les biais
        const shuffled = [...filteredStudents].sort(() => Math.random() - 0.5);

        // Calculer les objectifs
        const totalF = shuffled.filter(s => s.sexe === 'F').length;
        const totalM = shuffled.filter(s => s.sexe === 'M').length;
        const targetF = Math.floor(totalF / params.numLevelGroups);
        const targetM = Math.floor(totalM / params.numLevelGroups);

        console.log(`👥 Répartition totale: ${totalF}F / ${totalM}M`);
        console.log(`🎯 Objectif par groupe: ~${targetF}F / ~${targetM}M`);

        // Fonction pour calculer le "besoin" d'un groupe
        function calculateGroupNeed(group, student) {
          const currentStudents = group.students.map(id =>
            filteredStudents.find(s => s.id === id)
          );

          const currentSize = currentStudents.length;
          const currentF = currentStudents.filter(s => s.sexe === 'F').length;
          const currentM = currentStudents.filter(s => s.sexe === 'M').length;

          // Calculer les moyennes actuelles
          const avgScoreF = currentStudents.length > 0
            ? currentStudents.reduce((sum, s) => sum + (s.scores?.F || 2.5), 0) / currentSize
            : 0;
          const avgScoreM = currentStudents.length > 0
            ? currentStudents.reduce((sum, s) => sum + (s.scores?.M || 2.5), 0) / currentSize
            : 0;
          const avgCOM = currentStudents.length > 0
            ? currentStudents.reduce((sum, s) => sum + (s.com || 0), 0) / currentSize
            : 0;

          // Score de besoin basé sur plusieurs critères
          let needScore = 0;

          // 1. Besoin en effectif (poids: 10)
          const maxSize = targetSize + (remainder > 0 ? 1 : 0);
          if (currentSize >= maxSize) {
            needScore -= 1000; // Groupe plein, ne pas ajouter
          } else {
            needScore += (maxSize - currentSize) * 10;
          }

          // 2. Besoin en parité (poids: 8)
          if (student.sexe === 'F') {
            const diffF = targetF - currentF;
            needScore += diffF * 8;
          } else {
            const diffM = targetM - currentM;
            needScore += diffM * 8;
          }

          // 3. Besoin en scores (poids: 5)
          const studentAvgScore = ((student.scores?.F || 2.5) + (student.scores?.M || 2.5)) / 2;
          const groupAvgScore = (avgScoreF + avgScoreM) / 2;
          const globalAvgScore = shuffled.reduce((sum, s) =>
            sum + ((s.scores?.F || 2.5) + (s.scores?.M || 2.5)) / 2, 0
          ) / shuffled.length;

          // Si le groupe a une moyenne inférieure à la cible et l'élève a un bon score, augmenter le besoin
          if (groupAvgScore < globalAvgScore && studentAvgScore > globalAvgScore) {
            needScore += 5;
          } else if (groupAvgScore > globalAvgScore && studentAvgScore < globalAvgScore) {
            needScore += 5;
          }

          // 4. Besoin en COM (poids: 3)
          const globalAvgCOM = shuffled.reduce((sum, s) => sum + (s.com || 0), 0) / shuffled.length;
          if (avgCOM < globalAvgCOM && student.com > globalAvgCOM) {
            needScore += 3;
          } else if (avgCOM > globalAvgCOM && student.com < globalAvgCOM) {
            needScore += 3;
          }

          return needScore;
        }

        // Algorithme glouton : placer chaque élève dans le groupe qui en a le plus besoin
        shuffled.forEach(student => {
          let bestGroupIndex = 0;
          let bestNeedScore = -Infinity;

          for (let i = 0; i < params.numLevelGroups; i++) {
            const needScore = calculateGroupNeed(groups[i], student);
            if (needScore > bestNeedScore) {
              bestNeedScore = needScore;
              bestGroupIndex = i;
            }
          }

          groups[bestGroupIndex].students.push(student.id);
        });

        // Log détaillé des résultats
        console.log('\n📋 RÉSULTATS DE LA RÉPARTITION:');
        groups.forEach((group, idx) => {
          const studentsInGroup = group.students.map(id =>
            filteredStudents.find(s => s.id === id)
          );
          const f = studentsInGroup.filter(s => s.sexe === 'F').length;
          const m = studentsInGroup.filter(s => s.sexe === 'M').length;
          const avgF = studentsInGroup.reduce((sum, s) => sum + (s.scores?.F || 2.5), 0) / studentsInGroup.length;
          const avgM = studentsInGroup.reduce((sum, s) => sum + (s.scores?.M || 2.5), 0) / studentsInGroup.length;
          const avgCOM = studentsInGroup.reduce((sum, s) => sum + (s.com || 0), 0) / studentsInGroup.length;

          console.log(`✅ Groupe ${idx + 1}: ${studentsInGroup.length} élèves (${f}F/${m}M) | Scores: F=${avgF.toFixed(1)} M=${avgM.toFixed(1)} | COM=${avgCOM.toFixed(1)}`);
        });
      }
      return { groups: groups };
    }
  } catch (error) {
    console.error('Erreur generateGroupsOnServer:', error);
    throw error;
  }
}

// ========== PATCH DE SÉPARATION DES SAUVEGARDES GROUPS/INTERFACEV2 ===========

// Nouvelle fonction isolée pour la sauvegarde des groupes
function saveGroups_ISOLATED(groupsData) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    // Utiliser uniquement la feuille GROUPES
    let groupsSheet = ss.getSheetByName('GROUPES');
    if (!groupsSheet) {
      groupsSheet = ss.insertSheet('GROUPES');
      groupsSheet.setTabColor('#9333ea');
    }
    groupsSheet.clear();
    // En-têtes fixes
    const headers = ['Groupe', 'Type', 'EleveID', 'Nom', 'Prenom', 'Sexe', 'Classe', 'Langue'];
    const dataRows = [headers];
    // Remplir les données à partir de groupsData
    groupsData.groups.forEach(group => {
      group.students.forEach(studentId => {
        const studentData = group.studentData?.find(s => s.id === studentId) || {};
        const row = [
          group.name || '',
          groupsData.type || '',
          studentId || '',
          studentData.nom || '',
          studentData.prenom || '',
          studentData.sexe || '',
          studentData.classe || '',
          studentData.lv2 || ''
        ];
        dataRows.push(row);
      });
    });
    if (dataRows.length > 1) {
      groupsSheet.getRange(1, 1, dataRows.length, dataRows[0].length).setValues(dataRows);
      const headerRange = groupsSheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground('#f3f4f6');
      headerRange.setFontWeight('bold');
      groupsSheet.autoResizeColumns(1, headers.length);
      groupsSheet.setFrozenRows(1);
    }
    // Métadonnées dans une feuille séparée
    let metaSheet = ss.getSheetByName('GROUPES_META');
    if (!metaSheet) {
      metaSheet = ss.insertSheet('GROUPES_META');
      metaSheet.hideSheet();
    }
    metaSheet.clear();
    metaSheet.getRange(1, 1, 1, 4).setValues([["Type", "Date", "Config", "Timestamp"]]);
    metaSheet.getRange(2, 1, 1, 4).setValues([[groupsData.type, new Date().toLocaleDateString('fr-FR'), JSON.stringify(groupsData.config), groupsData.timestamp]]);
    // Cache séparé
    const cache = CacheService.getScriptCache();
    cache.put('GROUPS_DATA_ONLY', JSON.stringify(groupsData), 3600);
    return true;
  } catch (error) {
    console.error('Erreur saveGroups_ISOLATED:', error);
    throw new Error('Erreur lors de la sauvegarde des groupes: ' + error.message);
  }
}

// Fonction serveur dédiée pour InterfaceV2
function saveCacheDataInterfaceV2(cacheData) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let cacheSheet = ss.getSheetByName('CACHE_INTERFACEV2');
    if (!cacheSheet) {
      cacheSheet = ss.insertSheet('CACHE_INTERFACEV2');
      cacheSheet.hideSheet();
    }
    cacheSheet.clear();
    cacheSheet.getRange(1, 1, 1, 4).setValues([["Date", "Mode", "Disposition", "Source"]]);
    cacheSheet.getRange(2, 1, 1, 4).setValues([[cacheData.date, cacheData.mode, JSON.stringify(cacheData.disposition), 'INTERFACEV2']]);
    return { success: true };
  } catch (error) {
    console.error('Erreur saveCacheDataInterfaceV2:', error);
    return { success: false, error: error.message };
  }
}

function loadCacheDataInterfaceV2() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const cacheSheet = ss.getSheetByName('CACHE_INTERFACEV2');
    if (!cacheSheet) {
      return { success: false, error: 'Aucune sauvegarde InterfaceV2 trouvée' };
    }
    const values = cacheSheet.getRange(2, 1, 1, 4).getValues();
    const data = values.length > 0 ? values[0] : null;

    if (!data || !data[0]) {
      return { success: false, error: 'Aucune donnée trouvée' };
    }

    return {
      success: true,
      data: {
        date: data[0],
        mode: data[1],
        disposition: JSON.parse(data[2]),
        source: data[3]
      }
    };
  } catch (error) {
    console.error('Erreur loadCacheDataInterfaceV2:', error);
    return { success: false, error: error.message };
  }
}

// ========== NOUVELLES FONCTIONS POUR MODULE GROUPES COMPLET ==========

/**
 * Obtenir la liste des classes ayant des onglets avec suffixe FIN
 * @returns {Array<string>} Liste des noms de classes (sans le suffixe FIN)
 */
function getFINClasses() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const classes = ss.getSheets()
      .map(s => s.getName())
      .filter(n => n.endsWith('FIN'))
      .map(n => n.replace(/FIN$/, ''))
      .sort();

    console.log(`📚 ${classes.length} classes FIN trouvées:`, classes);
    return classes.length ? classes : [];
  } catch (error) {
    console.error('Erreur getFINClasses:', error);
    return [];
  }
}

/**
 * Charger les élèves depuis les onglets FIN des classes sélectionnées
 * @param {Array<string>} selectedClasses - Liste des classes à charger
 * @returns {Array<Object>} Liste des élèves
 */
function getStudentsFromFINClasses(selectedClasses) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const students = [];

    selectedClasses.forEach(className => {
      const sheetName = className + 'FIN';
      const sheet = ss.getSheetByName(sheetName);

      if (!sheet) {
        console.warn(`Onglet ${sheetName} non trouvé`);
        return;
      }

      const data = sheet.getDataRange().getValues();
      if (data.length < 2) return;

      const headers = data[0].map(h => h.toString().toUpperCase());

      // Recherche flexible des colonnes
      const indices = {
        id: headers.findIndex(h => ['ID_ELEVE', 'ID', 'UID'].includes(h)),
        nom: headers.indexOf('NOM'),
        prenom: headers.findIndex(h => ['PRENOM', 'PRÉNOM'].includes(h)),
        sexe: headers.indexOf('SEXE'),
        lv2: headers.findIndex(h => ['LV2', 'LV1', 'LANGUE2', 'L2', 'LANGUE'].includes(h)),
        com: headers.indexOf('COM'),
        tra: headers.indexOf('TRA'),
        part: headers.indexOf('PART'),
        abs: headers.indexOf('ABS'),
        scoreF: headers.indexOf('SCORE F'),
        scoreM: headers.indexOf('SCORE M')
      };

      // Lire les élèves
      for (let i = 1; i < data.length; i++) {
        const row = data[i];

        // CORRECTION : Accepter si NOM existe, même si PRENOM est vide
        const nomValue = row[indices.nom] ? row[indices.nom].toString().trim() : '';
        if (!nomValue) continue; // Ignorer seulement si NOM est vraiment vide

        const prenomValue = indices.prenom !== -1 && row[indices.prenom] ? row[indices.prenom].toString().trim() : '';

        // Si PRENOM est vide, essayer de parser NOM (format: "NOM Prénom")
        let nom = nomValue;
        let prenom = prenomValue;

        if (!prenom && nomValue.includes(' ')) {
          // Parser "NOM Prénom" en deux parties
          const parts = nomValue.split(' ');
          nom = parts[0];
          prenom = parts.slice(1).join(' ');
        }

        const studentId = row[indices.id] || `${className}_${i}`;

        // Scores avec valeur par défaut 2.5 si absents
        const scoreF = indices.scoreF !== -1 ? (parseInt(row[indices.scoreF]) || 0) : 0;
        const scoreM = indices.scoreM !== -1 ? (parseInt(row[indices.scoreM]) || 0) : 0;

        // Si score = 0, mettre 2.5 par défaut
        const finalScoreF = scoreF === 0 ? 2.5 : scoreF;
        const finalScoreM = scoreM === 0 ? 2.5 : scoreM;

        students.push({
          id: studentId,
          nom: nom,
          prenom: prenom,
          sexe: row[indices.sexe] || '',
          classe: className,
          lv2: indices.lv2 !== -1 ? (row[indices.lv2] || '') : '',
          com: indices.com !== -1 ? (parseFloat(row[indices.com]) || 0) : 0,
          tra: indices.tra !== -1 ? (parseFloat(row[indices.tra]) || 0) : 0,
          part: indices.part !== -1 ? (parseFloat(row[indices.part]) || 0) : 0,
          abs: indices.abs !== -1 ? (parseFloat(row[indices.abs]) || 0) : 0,
          scores: {
            F: finalScoreF,
            M: finalScoreM
          }
        });
      }
    });

    console.log(`✅ ${students.length} élèves chargés depuis les onglets FIN`);
    return students;
  } catch (error) {
    console.error('Erreur getStudentsFromFINClasses:', error);
    throw error;
  }
}

/**
 * Sauvegarder les groupes dans des onglets avec suffixe GROUPES
 * @param {Object} payload - Données des groupes à sauvegarder
 */
function saveGroupsToSheets(payload) {
  try {
    if (!payload || !payload.groups) {
      throw new Error('Payload invalide');
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const timestamp = new Date().toLocaleString('fr-FR');

    // Pour chaque groupe, créer un onglet
    payload.groups.forEach((group, index) => {
      const sheetName = `${group.name}_GROUPES`;
      let sheet = ss.getSheetByName(sheetName);

      // Créer ou vider l'onglet
      if (sheet) {
        sheet.clear();
      } else {
        sheet = ss.insertSheet(sheetName);
        sheet.setTabColor('#9333ea'); // Violet
      }

      // En-têtes
      const headers = ['ID', 'Nom', 'Prénom', 'Sexe', 'Classe', 'LV2', 'COM', 'TRA', 'PART', 'ABS'];

      if (payload.type === 'needs') {
        headers.push('Score F', 'Score M', 'Moyenne');
      }

      const dataRows = [headers];

      // Remplir avec les données des élèves
      group.students.forEach(student => {
        const row = [
          student.id,
          student.nom,
          student.prenom,
          student.sexe,
          student.classe,
          student.lv2 || '',
          student.com || 0,
          student.tra || 0,
          student.part || 0,
          student.abs || 0
        ];

        if (payload.type === 'needs') {
          const scoreF = student.scores?.F || 0;
          const scoreM = student.scores?.M || 0;
          const avg = ((scoreF + scoreM) / 2).toFixed(1);
          row.push(scoreF, scoreM, avg);
        }

        dataRows.push(row);
      });

      // Écrire les données
      sheet.getRange(1, 1, dataRows.length, dataRows[0].length).setValues(dataRows);

      // Formatage de l'en-tête
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground('#5b21b6');
      headerRange.setFontColor('#ffffff');
      headerRange.setFontWeight('bold');
      headerRange.setHorizontalAlignment('center');

      // Auto-resize
      sheet.autoResizeColumns(1, headers.length);

      // Figer l'en-tête
      sheet.setFrozenRows(1);

      // Ajouter métadonnées en bas
      const metaRow = dataRows.length + 2;
      sheet.getRange(metaRow, 1).setValue(`Type: ${payload.type}`);
      sheet.getRange(metaRow + 1, 1).setValue(`Généré le: ${timestamp}`);
      if (payload.config) {
        sheet.getRange(metaRow + 2, 1).setValue(`Config: ${JSON.stringify(payload.config)}`);
      }
    });

    // Sauvegarder aussi une copie consolidée
    let consolidatedSheet = ss.getSheetByName('GROUPES_CONSOLIDATED');
    if (consolidatedSheet) {
      consolidatedSheet.clear();
    } else {
      consolidatedSheet = ss.insertSheet('GROUPES_CONSOLIDATED');
      consolidatedSheet.setTabColor('#7c3aed');
    }

    const consHeaders = ['Groupe', 'ID', 'Nom', 'Prénom', 'Sexe', 'Classe', 'LV2'];
    const consRows = [consHeaders];

    payload.groups.forEach(group => {
      group.students.forEach(student => {
        consRows.push([
          group.name,
          student.id,
          student.nom,
          student.prenom,
          student.sexe,
          student.classe,
          student.lv2 || ''
        ]);
      });
    });

    consolidatedSheet.getRange(1, 1, consRows.length, consHeaders.length).setValues(consRows);
    const consHeaderRange = consolidatedSheet.getRange(1, 1, 1, consHeaders.length);
    consHeaderRange.setBackground('#5b21b6');
    consHeaderRange.setFontColor('#ffffff');
    consHeaderRange.setFontWeight('bold');
    consolidatedSheet.autoResizeColumns(1, consHeaders.length);
    consolidatedSheet.setFrozenRows(1);

    console.log(`✅ ${payload.groups.length} groupes sauvegardés dans des onglets GROUPES`);
    return true;
  } catch (error) {
    console.error('Erreur saveGroupsToSheets:', error);
    throw error;
  }
}

// ========== FONCTION DE DEBUG POUR TESTER LE CHARGEMENT DES ÉLÈVES ==========
/**
 * Fonction de debug pour tester le chargement des élèves depuis les onglets FIN
 * À appeler depuis Google Apps Script pour diagnostiquer le problème des groupes vides
 */
function debugGroupesModule() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const debug = {
      timestamp: new Date().toISOString(),
      allSheets: [],
      finSheets: [],
      classesFIN: [],
      testStudentsLoad: null,
      errors: []
    };

    // 1. Lister tous les onglets
    const sheets = ss.getSheets();
    debug.allSheets = sheets.map(s => s.getName());
    Logger.log('📋 Tous les onglets:', debug.allSheets);

    // 2. Filtrer les onglets FIN
    debug.finSheets = debug.allSheets.filter(n => n.endsWith('FIN'));
    Logger.log('📚 Onglets FIN:', debug.finSheets);

    // 3. Tester getFINClasses()
    try {
      debug.classesFIN = getFINClasses();
      Logger.log('✅ getFINClasses() retourne:', debug.classesFIN);
    } catch (error) {
      debug.errors.push('Erreur getFINClasses: ' + error.toString());
      Logger.log('❌ Erreur getFINClasses:', error);
    }

    // 4. Tester le chargement des élèves si des classes FIN existent
    if (debug.classesFIN.length > 0) {
      try {
        const testClasses = debug.classesFIN.slice(0, 2); // Tester avec les 2 premières classes
        Logger.log('🧪 Test de chargement pour:', testClasses);

        const students = getStudentsFromFINClasses(testClasses);
        debug.testStudentsLoad = {
          classesTestees: testClasses,
          nombreEleves: students.length,
          premierEleve: students.length > 0 ? students[0] : null,
          exemplesEleves: students.slice(0, 3).map(s => ({
            nom: s.nom,
            prenom: s.prenom,
            classe: s.classe,
            lv2: s.lv2,
            scoreF: s.scores.F,
            scoreM: s.scores.M
          }))
        };
        Logger.log('✅ Élèves chargés:', debug.testStudentsLoad);
      } catch (error) {
        debug.errors.push('Erreur getStudentsFromFINClasses: ' + error.toString());
        Logger.log('❌ Erreur getStudentsFromFINClasses:', error);
      }
    } else {
      debug.errors.push('Aucune classe FIN trouvée pour tester le chargement');
    }

    // 5. Examiner la structure d'un onglet FIN si disponible
    if (debug.finSheets.length > 0) {
      try {
        const firstFINSheet = ss.getSheetByName(debug.finSheets[0]);
        const data = firstFINSheet.getDataRange().getValues();
        const headers = data[0];
        const headersUpper = data[0].map(h => h.toString().toUpperCase());

        // Calculer les indices comme dans getStudentsFromFINClasses
        const indices = {
          id: headersUpper.findIndex(h => ['ID_ELEVE', 'ID', 'UID'].includes(h)),
          nom: headersUpper.indexOf('NOM'),
          prenom: headersUpper.findIndex(h => ['PRENOM', 'PRÉNOM'].includes(h)),
          sexe: headersUpper.indexOf('SEXE'),
          lv2: headersUpper.findIndex(h => ['LV2', 'LV1', 'LANGUE2', 'L2', 'LANGUE'].includes(h)),
          com: headersUpper.indexOf('COM'),
          tra: headersUpper.indexOf('TRA'),
          part: headersUpper.indexOf('PART'),
          abs: headersUpper.indexOf('ABS'),
          scoreF: headersUpper.indexOf('SCORE F'),
          scoreM: headersUpper.indexOf('SCORE M')
        };

        debug.structurePremierOngletFIN = {
          nom: debug.finSheets[0],
          nombreLignes: data.length,
          nombreColonnes: headers.length,
          headersOriginaux: headers,
          headersEnMajuscules: headersUpper,
          indicesTrouves: indices,
          ligne2Existe: data.length > 1,
          exempleLigne2: data.length > 1 ? data[1] : null,
          valeurNomLigne2: data.length > 1 && indices.nom !== -1 ? data[1][indices.nom] : 'N/A',
          valeurPrenomLigne2: data.length > 1 && indices.prenom !== -1 ? data[1][indices.prenom] : 'N/A'
        };

        Logger.log('📊 Structure du premier onglet FIN:');
        Logger.log('   Nom: ' + debug.structurePremierOngletFIN.nom);
        Logger.log('   Lignes: ' + debug.structurePremierOngletFIN.nombreLignes);
        Logger.log('   Colonnes: ' + debug.structurePremierOngletFIN.nombreColonnes);
        Logger.log('   Headers originaux: ' + JSON.stringify(debug.structurePremierOngletFIN.headersOriginaux));
        Logger.log('   Headers en MAJUSCULES: ' + JSON.stringify(debug.structurePremierOngletFIN.headersEnMajuscules));
        Logger.log('   Index NOM: ' + indices.nom);
        Logger.log('   Index PRENOM: ' + indices.prenom);
        Logger.log('   Index SEXE: ' + indices.sexe);
        Logger.log('   Index LV2: ' + indices.lv2);
        Logger.log('   Ligne 2 existe? ' + debug.structurePremierOngletFIN.ligne2Existe);
        if (data.length > 1) {
          Logger.log('   Valeur NOM ligne 2: "' + debug.structurePremierOngletFIN.valeurNomLigne2 + '"');
          Logger.log('   Valeur PRENOM ligne 2: "' + debug.structurePremierOngletFIN.valeurPrenomLigne2 + '"');
          Logger.log('   Ligne 2 complète: ' + JSON.stringify(data[1]));
        }
      } catch (error) {
        debug.errors.push('Erreur lecture structure FIN: ' + error.toString());
        Logger.log('❌ Erreur lecture structure FIN:', error);
      }
    }

    // 6. Afficher le résumé
    Logger.log('='.repeat(60));
    Logger.log('RÉSUMÉ DU DEBUG:');
    Logger.log(`- Nombre total d'onglets: ${debug.allSheets.length}`);
    Logger.log(`- Onglets FIN trouvés: ${debug.finSheets.length}`);
    Logger.log(`- Classes FIN détectées: ${debug.classesFIN.length}`);
    Logger.log(`- Élèves chargés (test): ${debug.testStudentsLoad?.nombreEleves || 0}`);
    Logger.log(`- Erreurs: ${debug.errors.length}`);
    Logger.log('='.repeat(60));

    return debug;
  } catch (error) {
    Logger.log('❌ Erreur fatale debugGroupesModule:', error);
    return { error: error.toString(), stack: error.stack };
  }
}
