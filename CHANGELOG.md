# Journal des changements

Versionnage sémantique. Le paquet est publié sur PyPI
(`pip install urban-archimate==x.y.z`) à chaque étiquette `vx.y.z`.

## 0.1.1 — non publié

- Notation dans le ton « Cartographe » : blocs blancs, bande de
  couleur de couche (qui épouse les arrondis des éléments de
  comportement), palette par tokens ; icônes de la boîte à outils du
  site alignées sur ces tokens.
- Outillage de test en conteneur (Dockerfile, docker-compose,
  dev-deploy.sh, E2E browserless).

## 0.1.0 — 26 novembre 2026

Première version.

- Reprise d'archimate-js (MIT, Vincent Boulet) sur diagram-js 15,
  avec construction Vite, ESLint, tests navigateur et CI.
- Contrat « modèle YAML hydraté » : types TypeScript, JSON Schema,
  validation nommant l'élément en cause, enregistrement (modèle sans
  data, graphique, nouvelles relations), lecture seule, événements.
- Moteur de règles (bloc du type de l'hôte → x-archimate → defaut) et
  export au format d'échange Open Group, valide contre le XSD 3.1.
- Notation ArchiMate 3.2 complète : tous les éléments de toutes les
  couches, jonctions And/Or, toutes les relations, notes, cadres,
  imbrication, positions relatives.
- Boîte à outils fournie par l'hôte (délégué de pose), grille de
  propriétés pilotée par le schéma du type, liaison via le délégué
  des relations permises, annuler/refaire exacts, gestion des vues.
- Élément personnalisé `<urban-archimate>` (shadow DOM, thème par
  variables CSS) et paquet Python `urban-archimate` avec
  `mount(app, chemin)` pour FastAPI / Starlette.
