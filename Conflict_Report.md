# Rapport sur les conflits de fusion GitHub

## Pourquoi GitHub remonte des conflits ?
La branche `work` réécrit en profondeur quatre fichiers clés :

- `BackendV2.js`
- `ModeTabs.md`
- `Phase4UI.html`
- `groupsBackend.js`

Sur GitHub, la branche de base a continué d'évoluer en parallèle (corrections rapides côté production). Les mêmes fichiers ont été modifiés côté principal, ce qui fait que Git ne peut plus appliquer automatiquement nos changements volumineux : il ne trouve pas assez de contexte commun pour faire la fusion sans intervention humaine. C'est pour cela que l'interface GitHub annonce des conflits.

## Que faire pour débloquer la situation ?
1. **Récupérer l'état le plus récent de la branche de base**  
   ```bash
   git fetch origin
   git checkout work
   git rebase origin/main    # ou "git merge origin/main"
   ```
2. **Résoudre chaque conflit manuellement**  
   Pour chacun des fichiers signalés, ouvrir l'éditeur, comparer les deux versions (base vs. notre refactor) et décider de ce qui doit être conservé. Les conflits seront balisés par `<<<<<<<`, `=======`, `>>>>>>>`.
3. **Tester rapidement les fonctions sensibles**  
   Une fois les conflits résolus, lancer au minimum les scénarios de création/sauvegarde de groupes ainsi que le chargement Interface V2 pour s'assurer que les régressions sont évitées.
4. **Finaliser**  
   ```bash
   git add BackendV2.js ModeTabs.md Phase4UI.html groupsBackend.js
   git rebase --continue     # ou "git commit" si vous avez fait un merge
   git push --force-with-lease origin work
   ```

### Astuce
Si certaines parties de nos fichiers doivent absolument primer (ex. suppression définitive de `INT`), utiliser les options `git checkout --ours` / `--theirs` section par section pour accélérer la résolution tout en vérifiant l'impact fonctionnel.

## Pourquoi ne pas repartir de zéro ?
Revenir en arrière effacerait l'ensemble des corrections déjà validées (migration vers `FIN`, robustesse sur `groupsBackend`, etc.). L'objectif est donc de **réconcilier** nos évolutions avec celles de la branche principale plutôt que d'abandonner le travail.

