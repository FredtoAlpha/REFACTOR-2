# Suivi des corrections INT → FIN

## Évolutions réalisées
* `ImportScoresManager.js` cible désormais exclusivement les onglets se terminant par `FIN` : chargement, mapping et écriture des scores sont alignés sur ce suffixe et l'interface utilisateur reflète cette bascule.
* `BackendV2.js` ne possède plus de compatibilité explicite avec le mode `INT` : toute requête héritée est désormais traitée comme un mode inconnu, ce qui permet de repérer immédiatement les appels obsolètes sans conserver de code dédié.

## Points de vigilance restants
* Surveiller les journaux Apps Script pour identifier d'éventuels appels persistants à des modes inconnus (anciennement `INT`) et les corriger côté client.
* Mettre à jour la documentation fonctionnelle partagée avec les établissements afin de rappeler que seuls les onglets `…FIN` sont désormais créés et maintenus.
