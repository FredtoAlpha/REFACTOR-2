# Modes de travail et suffixes d'onglets

## États historiques
- **TEST** : feuilles de travail temporaires générées à partir de la consolidation.
- **CACHE** : sauvegardes intermédiaires explicites (bouton « Sauvegarder ») conservées et visibles.
- **WIP** : brouillons auto-sauvegardés toutes les 30 s dans des onglets cachés `…WIP`. Ce mode a été supprimé ; les sauvegardes de travail passent désormais uniquement par `CACHE`.
- **INT** : (supprimé) anciens instantanés cachés. Toute nouvelle sauvegarde doit viser directement les onglets finals `…FIN`.
- **FIN** : classes finalisées, formatées pour communication officielle.

## Comportement actuel
- Le bouton « Brouillon » disparaît. La sauvegarde passe par le cache manuel (`saveElevesCache`) ou via la finalisation (`finalizeClasses`).
- Toute demande `saveElevesWIP` est redirigée vers `saveElevesCache` pour compatibilité.
- Les anciennes lectures `getINTScores` ou `getINTClasses*` ne sont plus exposées côté client ; utiliser explicitement `getFinalScores` et `getFinalClasses*`.
- Les gestionnaires de progression affichent désormais un message neutre (« Sauvegarde des classes en cours… »), quelle que soit la source.

## Conséquences pour les utilisateurs
- Plus d'onglets `…WIP` ou `…INT` créés automatiquement dans le classeur.
- Les modules d'import de notes et de groupes exploitent maintenant les onglets finals `…FIN`, déjà produits par la finalisation.
- Les journaux et diagnostics signalent les suffixes inconnus (`console.warn`) afin d'identifier rapidement les scripts hérités à mettre à jour.
