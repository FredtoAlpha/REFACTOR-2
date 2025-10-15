# Audit InterfaceV2 & BackendV2

## InterfaceV2.html

### 1. Incohérences FIN vs INT dans l'UI de sauvegarde
* **Localisation :** lignes 2556-2749.
* **Constat :** la barre de progression et les journaux évoquent la création d'onglets « FIN » alors que la fonction `saveWithProgressINT` appelle `saveElevesSnapshot` et affiche un toast confirmant la création d'onglets « INT ». Cette dissonance prête à confusion pour les utilisateurs et complique le support.
* **Impact :** communication confuse sur le type d'onglets générés, risque de mauvaises procédures côté équipes.
* **Recommandation :** harmoniser le libellé (FIN vs INT) dans les en-têtes, étapes et messages d'erreur en fonction de l'action réellement exécutée ou basculer l'appel serveur sur la fonction FIN appropriée.

### 2. Paramètre de mode ignoré lors de l'appel serveur
* **Localisation :** lignes 2727-2734.
* **Constat :** `saveWithProgressINT` transmet `STATE.currentMode` à `saveElevesSnapshot`, mais la fonction côté Apps Script n'accepte qu'un seul argument et ignore donc le mode (cf. BackendV2.js). Le commentaire suggère pourtant que la sauvegarde doit dépendre de la source active.
* **Impact :** impossibilité d'adapter la logique serveur selon le mode courant, risque d'évolutions futures qui supposeraient ce paramètre.
* **Recommandation :** soit supprimer l'argument et clarifier les commentaires, soit faire évoluer l'API Apps Script pour exploiter effectivement le mode fourni.

## BackendV2.js

### 1. Lecture impossible des onglets INT masqués
* **Localisation :** lignes 329-333 et 614-615.
* **Constat :** `saveElevesSnapshot` masque systématiquement les onglets INT (`hideSheet: true`). Cependant, `getElevesDataForMode` n'active `includeHidden` que pour TEST/WIP/CACHE/FIN, pas pour INT/SNAPSHOT. Toute tentative de relire ces snapshots renverra donc une liste vide.
* **Impact :** fonctionnalités de restitution/diagnostic des snapshots INT inopérantes.
* **Recommandation :** inclure les modes INT/SNAPSHOT dans la condition `includeHidden` (ou toujours forcer `includeHidden` lorsque le suffixe cible correspond à un onglet masqué).

### 2. Contournement des dépendances injectées pour le mode PREVIOUS
* **Localisation :** lignes 289-320.
* **Constat :** la branche PREVIOUS accède directement à `SpreadsheetApp` alors que le service reçoit déjà `dataAccess` en dépendance. Cette entorse brise l'injection de dépendances, complexifie les tests unitaires et empêche l'utilisation d'un SpreadsheetApp mock.
* **Impact :** difficultés de test, incohérences potentielles si `createService` est instancié avec un autre dataAccess.
* **Recommandation :** déléguer la récupération des feuilles « précédentes » à `dataAccess` ou accepter `SpreadsheetApp` comme paramètre injecté.

### 3. Absence de verrou lors de la création des snapshots
* **Localisation :** lignes 607-615.
* **Constat :** `saveElevesSnapshot` désactive explicitement le verrou (`withLock: false`). En cas d'utilisation simultanée, deux sauvegardes peuvent interférer (écrasement ou erreurs d'écriture) contrairement à `saveElevesCache` qui verrouille.
* **Impact :** risques de corruption de données lors d'exécutions concurrentes.
* **Recommandation :** réactiver le verrouillage ou justifier/limiter explicitement l'appel concurrent.

