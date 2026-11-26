# Journal des changements

Versionnage sémantique. Le paquet est publié sur PyPI
(`pip install urban-archimate==x.y.z`) à chaque étiquette `vx.y.z`.

## 0.1.3 — 26 novembre 2026

- Les panneaux latéraux se masquent entièrement : boîte à outils à
  gauche, panneau des propriétés à droite ; une icône flottante de
  chaque côté du dessin les ramène.
- L'hôte peut brancher sa propre grille de propriétés : l'attribut
  `no-properties` du composant (option `propertyPanel: false` de
  l'éditeur) coupe le panneau intégré, la sélection restant publiée
  par l'événement `selection` ; le panneau ne revient que le temps de
  saisir une nouvelle relation.
- Barre de zoom en bas à droite du dessin : moins, pourcentage
  cliquable (retour à 100 %), plus, ajustement à la fenêtre ;
  disponible aussi en lecture seule.

## 0.1.2 — 26 novembre 2026

- Jonction : le composant accepte le type `Junction` de l'hôte avec
  son attribut `proprietes.jonction` (`And` / `Or`, absente = `And`),
  résolu en jonction « et » / « ou » au rendu, à la pose et à
  l'export Open Group (`AndJunction` / `OrJunction`, valide XSD 3.1) ;
  clé de règle `junctionType` ; contrat documenté et exemple
  `tous-elements` sous cette forme.
- Un objet dont le type est déjà un type ArchiMate ne déclenche plus
  l'avertissement « schéma non fourni ».
- Site de démonstration : la vue « Parcours de commande » passe par une
  jonction « ou » (livraison ou retrait en boutique), et la boîte à
  outils gagne un groupe « Jonctions » (une « et », une « ou ») à poser
  et relier soi-même.
- Les connexions importées s'ancrent au bord des formes, plus à leur
  centre : les flèches ne traversent plus les blocs ni leurs libellés.
- Boîte à outils : glisser-déposer un outil sur le dessin le pose à
  l'endroit du dépôt ; le clic puis clic reste disponible, avec un
  message d'aide à l'armement et Échap pour annuler.

## 0.1.1 — 26 novembre 2026

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
