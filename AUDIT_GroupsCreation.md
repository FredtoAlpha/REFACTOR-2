# Audit – Création des groupes

## 1. `saveGroups` – Tableau des élèves désaligné en cas de groupes invalides
- **Localisation :** `groupsBackend.js`, lignes 96-140.
- **Constat :** la fonction alloue `student.groups` avec `groupsData.groups.length` entrées (dont les groupes invalidés), alors que les en-têtes n'ajoutent qu'une colonne par groupe valide. Si un groupe est écarté (nom manquant, objet invalide), les lignes élèves conservent des colonnes vides supplémentaires par rapport à l'entête, ce qui fera échouer `setValues` ou décaler les marqueurs `X`.
- **Impact :** risque d'erreurs « Dimensions des données incompatibles » à l'écriture ou de marquage des élèves sous une mauvaise colonne lors des sauvegardes partielles.
- **Recommandation :** filtrer le tableau initial pour ne conserver que les groupes valides avant de dimensionner `student.groups`, ou construire les colonnes à partir d'un tableau parallèle d'indices valides.

## 2. `getAvailableClasses` – Accès sans garde à la colonne `CLASSE`
- **Localisation :** `groupsBackend.js`, lignes 320-333.
- **Constat :** la fonction lit `headers.indexOf('CLASSE')` sans vérifier le résultat. Si l'entête est absente ou renommée, `classeCol` vaut `-1` et `data[i][-1]` récupère la dernière colonne (ex. score), faussant la liste des classes.
- **Impact :** classes proposées incohérentes, sélection impossible ou mauvaise affectation d'élèves lors de la génération des groupes.
- **Recommandation :** contrôler que l'indice est ≥0 avant d'itérer et journaliser/retourner un message explicite si la colonne manque.

## 3. `getStudentsForGroups` – Indices de colonnes non vérifiés et colonnes codées en dur
- **Localisation :** `groupsBackend.js`, lignes 681-758.
- **Constat :** les indices des colonnes (`NOM`, `LV2`, `PART`, etc.) ne sont jamais validés. Une entête manquante renverra `-1` et les lectures `row[-1]` pointeront vers la dernière cellule. De plus, les colonnes des scores sont forcées aux index 20/21 alors que les onglets FIN évoluent régulièrement.
- **Impact :** données élèves corrompues (langue/score importés depuis la mauvaise colonne) et exceptions difficiles à diagnostiquer selon la configuration du tableur.
- **Recommandation :** vérifier chaque indice avant usage, lever une erreur lisible si absent et dériver dynamiquement les colonnes de scores via `indexOf` plutôt que des positions absolues.

## 4. `generateGroupsOnServer` – Paramètres non validés avant calcul
- **Localisation :** `groupsBackend.js`, lignes 792-860.
- **Constat :** la fonction suppose que `params.selectedClasses`, `params.numGroups`/`numLevelGroups` et `params.selectedLanguage` sont définis. Si l'un est vide ou à zéro, `selectedClasses.includes` provoque une erreur, et `index % params.numGroups` retourne `NaN`, empêchant l'affectation.
- **Impact :** exécution interrompue pour des requêtes incomplètes (ex. aucune classe cochée côté UI), empêchant la création de groupes et laissant l'interface sans réponse.
- **Recommandation :** valider et normaliser les paramètres d'entrée (tableaux non vides, compte strictement positif) avant de filtrer/répartir, puis retourner un message fonctionnel lorsque les prérequis ne sont pas remplis.
