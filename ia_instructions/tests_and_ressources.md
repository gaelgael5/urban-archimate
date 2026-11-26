# Ressources de test attribuées

Mémoire des ressources mises à disposition de l'agent (règles d'usage :
skill `test-machine-deployment`). À tenir à jour à chaque attribution ou reprise.

| Ressource | Alias SSH / accès | Nom d'hôte réel | Usage |
|---|---|---|---|
| Machine de test | `test1` (root, via rebond) | `host-test-37` | Suite de tests complète (conteneur `tests`), déploiement du site de démonstration par `dev-deploy.sh` (clone `~/urban-archimate`, branche `dev`), port `8120`. Machine partagée avec d'autres projets : ne toucher qu'à la stack `urban-archimate`. |
| Browserless Chromium | `ws://<ip test1>:3000` (sans jeton) | conteneur `browserless-chromium-chromium-1` sur `host-test-37` | E2E du site déployé (`test/e2e/site-deploye.mjs`, étape 9 de `dev-deploy.sh`). |

Attribuées le 2026-11-26.
