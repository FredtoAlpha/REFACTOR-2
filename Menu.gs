// =====================
// Menu.js — Version nettoyée et centralisée
// =====================

/**
 * Crée le menu principal de l'application lors de l'ouverture du classeur
 * Vérifie également si le système a été initialisé
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  const config = getConfig();
  
  // Créer le menu principal
  ui.createMenu('Répartition')
    // Administration (protégé)
    .addSubMenu(ui.createMenu('Administration')
      .addItem('Initialiser Système', 'ouvrirInitialisation')
      .addItem('Configuration Complète', 'ouvrirConfigurationComplete')
      .addItem('Générer NOM_PRENOM et ID_ELEVE', 'genererNomPrenomEtID')
      .addItem('Générer Données Test', 'ouvrirGenerationDonnees')
      .addItem('Analyser Données', 'analyserDonnees')
      .addSeparator()
      .addItem('Corriger Notation Scientifique', 'corrigerNotationScientifique')
      .addItem('Forcer Format Texte', 'forcerFormatTexte'))
    
    // Console principale
    .addItem('🖥️ Ouvrir Console de Répartition', 'ouvrirConsole')

    // Recompter
    .addItem('📊 COMPTER ONGLETS SOURCES', 'compterEffectifsOptionsEtLangues')
    .addItem('📊 COMPTER ONGLETS TEST', 'compterEffectifsOptionsEtLanguesTest')
    
    // Préparation Données
    .addSubMenu(ui.createMenu('Préparation Données')
      .addItem('Consolider Sources', 'consoliderDonnees')
      .addItem('Vérifier Données', 'verifierDonnees')
      // Suppression de l'accès à "Configurer Structure"
      .addItem('Ajouter listes déroulantes', 'ajouterListesDeroulantes')
      .addSeparator()
      .addSubMenu(ui.createMenu('Gestion Professeurs')
        .addItem('Créer feuilles professeurs', 'creerFeuillesProfesseurs')
        .addItem('Collecter données professeurs', 'collecterDonneesProfesseurs'))
      // .addItem('Créer classeurs par matière', 'creerClasseursMatières') // TODO: Fonction à implémenter
      )
    
    // Phases de Répartition
    .addSubMenu(ui.createMenu('Répartition')
      .addItem('Répartir Options, Codes, Parité', 'executerPhases1a3')
      .addItem('Phase 4: Optimisation', 'executerPhase4'))
      // .addItem('Phase 5: Finalisation', 'executerPhase5')) // TODO: Fonction à implémenter
    
    // Création Onglets
    .addSubMenu(ui.createMenu('Création Onglets')
      .addItem('Créer onglet d\'accueil', 'creerOngletPresentation'))
      // .addItem('Créer onglets définitifs', 'creerOngletsDEF') // TODO: Fonction à implémenter
      // .addItem('Afficher Statistiques DEF', 'afficherStatistiquesDEF')) // TODO: Fonction à implémenter

    //Finalisation
.addSubMenu(ui.createMenu('Finalisation')
  .addItem("📥 Déplacer / Échanger un élève", "ouvrirInterfaceDeplacement")
  .addItem("🚀 Lancer Optimisation (V11)", "showOptimisationSidebar")
  .addItem("✅ Lancer Finalisation (Phase 5)", "showFinalisationSidebar")
  .addSeparator()
  // .addItem("🔄 Tableau de Bord Drag & Drop", "showDashboard")  // TODO: Fonction à implémenter
  .addItem("📊 Interface de Répartition", "ouvrirInterfaceRepartition"))  // NOUVELLE LIGNE


    // À propos
    // .addItem('ℹ️ À propos', 'afficherAPropos') // TODO: Fonction à implémenter
    
    .addToUi();
  
  // Si le fichier n'a pas encore été initialisé, proposer de le faire
  const structureSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.STRUCTURE);
  if (!structureSheet) {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      "Ce classeur n'a pas encore été initialisé. Utilisez le menu Administration > Initialiser Système pour commencer.",
      "🚀 Bienvenue dans Répartition V8",
      30
    );
  }
  
// … fin de votre onOpen(), juste avant la fermeture de l’accolade }

// Contrôle du renommage automatique du classeur
// Désactivé pour éviter tout changement de nom
// if (config.AUTO_RENAME) {
//   const niveau = config.NIVEAU || "5e";
//   SpreadsheetApp.getActiveSpreadsheet().rename(`Répartition ${niveau} - V8`);
// }
}

/**
 * Ouvre l'interface de configuration complète
 * Cette fonction est appelée depuis le menu Administration > Configuration Complète
 */
function ouvrirConfigurationComplete() {
  // Vérifier le mot de passe d'administration
  if (!verifierMotDePasse("Configuration complète")) return;
  
  const html = HtmlService.createHtmlOutputFromFile('ConfigurationComplete.html')
    .setWidth(800)
    .setHeight(600)
    .setTitle('Configuration Complète du Système');
  
  SpreadsheetApp.getUi().showModalDialog(html, 'Configuration Complète');
}
/**
 * Ouvre l'interface de répartition en plein écran dans un nouvel onglet
 */
function ouvrirInterfaceRepartition() {
  // ✅ Obtenir l'URL du déploiement actuel automatiquement
  const webAppUrl = ScriptApp.getService().getUrl();

  if (!webAppUrl) {
    SpreadsheetApp.getUi().alert(
      'Erreur',
      'L\'application web n\'est pas encore déployée.\n\n' +
      'Pour déployer:\n' +
      '1. Extensions > Apps Script\n' +
      '2. Déployer > Nouveau déploiement\n' +
      '3. Type: Application Web\n' +
      '4. Copier l\'URL de déploiement',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return;
  }

  const html = `
    <div style="text-align: center; padding: 50px; font-family: Arial, sans-serif;">
      <h2>🚀 Ouverture de l'interface en plein écran...</h2>
      <a href="${webAppUrl}" target="_blank"
         style="display: inline-block; padding: 15px 30px; background: #5b21b6;
                color: white; text-decoration: none; border-radius: 8px;
                font-size: 18px; font-weight: bold;">
        Ouvrir l'interface en plein écran
      </a>
    </div>
    <script>
      window.open('${webAppUrl}', '_blank');
      setTimeout(() => google.script.host.close(), 2000);
    </script>
  `;

  const htmlOutput = HtmlService.createHtmlOutput(html)
    .setWidth(500)
    .setHeight(250);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Lancement');
}