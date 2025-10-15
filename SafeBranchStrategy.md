# Stratégie pour publier une branche « saine »

## Objectif
Produire une branche alternative exempte des conflits actuels en se basant sur l'état d'origine (`b19c9ff`) puis en y réappliquant uniquement les correctifs validés sur la gestion des groupes.

## Étapes recommandées

1. **Créer une nouvelle branche à partir de l'état sain**
   ```bash
   git checkout b19c9ff
   git checkout -b groups-clean
   ```

2. **Réappliquer les correctifs essentiels**
   * Copier les améliorations de `groupsBackend.js` (validation, cache, serpentin) depuis `work`.
   * Reporter uniquement les ajustements confirmés de `BackendV2.js` nécessaires au suffixe `FIN`.
   * Laisser `InterfaceV2.html` et `Phase4UI.html` dans leur version d'origine tant qu'aucune refonte complète n'est validée.
   * Vérifier que `ImportScoresManager.js` se limite aux modes `FIN` et fonctionne avec les nouvelles colonnes détectées dynamiquement.

   Utiliser `git checkout work -- chemin/fichier` pour importer sélectivement les correctifs, puis relire chaque diff avant validation.

3. **Nettoyer et tester**
   ```bash
   npm test # ou l'équivalent Apps Script si disponible
   ```
   Documenter manuellement les tests si aucun script automatisé n'existe.

4. **Finaliser la branche**
   ```bash
   git add groupsBackend.js BackendV2.js ImportScoresManager.js
   git commit -m "Consolider les correctifs groupes sans conflits"
   git push origin groups-clean
   ```

5. **Ouvrir la Pull Request**
   * Comparer `groups-clean` à la branche cible (généralement `main`).
   * Résumer les changements concentrés sur les groupes.
   * Laisser un lien vers `Conflict_Report.md` pour rappeler les divergences évitées.

## Pourquoi cette approche fonctionne
* On redémarre depuis l'empreinte connue `b19c9ff`, ce qui élimine les réécritures massives introduites dans `work`.
* On limite les réintroductions aux fichiers critiques pour la fonctionnalité groupes, ce qui réduit mécaniquement les conflits croisés.
* On conserve une trace documentaire (`Conflict_Report.md` et cette fiche) pour expliquer la divergence et aider à la revue.

## À surveiller
* Toute dépendance résiduelle à `INT` doit être éliminée avant le commit.
* S'assurer que les utilitaires `ModeTabs` restent synchronisés si des textes d'aide sont nécessaires.
* Ajuster le plan si d'autres corrections sont validées par l'équipe avant le merge.
