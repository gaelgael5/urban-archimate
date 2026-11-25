/**
 * Generates examples/tous-elements/modele-hydrate.yaml: a hydrated
 * model whose single view shows every ArchiMate 3.2 element type
 * (all layers, junctions included), every relationship type with its
 * notation, a note, a group frame, nesting and a relative position.
 *
 * Usage: npx vite-node scripts/generate-tous-elements.mjs
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { dump } from 'js-yaml';

import {
  STRATEGY_ELEMENT_MAP,
  BUSINESS_ELEMENT_MAP,
  APPLICATION_ELEMENT_MAP,
  TECHNOLOGY_ELEMENT_MAP,
  PHYSICAL_ELEMENT_MAP,
  MOTIVATION_ELEMENT_MAP,
  IMP_MIG_ELEMENT_MAP,
  OTHER_ELEMENT_MAP
} from '../lib/util/ModelUtil.js';

const ELEMENT_TYPES = [
  ...STRATEGY_ELEMENT_MAP.keys(),
  ...BUSINESS_ELEMENT_MAP.keys(),
  ...APPLICATION_ELEMENT_MAP.keys(),
  ...TECHNOLOGY_ELEMENT_MAP.keys(),
  ...PHYSICAL_ELEMENT_MAP.keys(),
  ...MOTIVATION_ELEMENT_MAP.keys(),
  ...IMP_MIG_ELEMENT_MAP.keys(),
  ...OTHER_ELEMENT_MAP.keys(),
  'AndJunction',
  'OrJunction'
];

const RELATIONSHIP_TYPES = [
  'Composition',
  'Aggregation',
  'Assignment',
  'Realization',
  'Serving',
  'Access',
  'Influence',
  'Triggering',
  'Flow',
  'Specialization',
  'Association'
];

const documents = [];
const elements = [];
const relationships = [];
const noeuds = [];
const connexions = [];
const geomNoeuds = {};
const geomConnexions = {};

const keyOf = (type) => `EL-${ type.toUpperCase() }`;

// -- all element types, on a grid -------------------------------------------

const COLS = 6, STEP_X = 190, STEP_Y = 95, W = 150, H = 60;

ELEMENT_TYPES.forEach((type, index) => {
  const cle = keyOf(type);

  documents.push({
    chemin: `cartographie/objets/${ type.toLowerCase() }/${ cle.toLowerCase() }.yaml`,
    data: { cle, type, nom: type }
  });
  elements.push(cle);

  const nodeId = `N-${ type.toUpperCase() }`;
  noeuds.push({ id: nodeId, element: cle });

  const col = index % COLS, row = Math.floor(index / COLS);

  const junction = type.endsWith('Junction');

  geomNoeuds[ nodeId ] = {
    x: 40 + col * STEP_X + (junction ? 65 : 0),
    y: 40 + row * STEP_Y + (junction ? 22 : 0),
    l: junction ? 15 : W,
    h: junction ? 15 : H
  };
});

const gridBottom = 40 + Math.ceil(ELEMENT_TYPES.length / COLS) * STEP_Y;

// -- every relationship type, between two fresh nodes ------------------------

RELATIONSHIP_TYPES.forEach((type, index) => {
  const cle = `REL-${ type.toUpperCase() }`;

  const proprietes = {};
  if (type === 'Access') { proprietes.acces = 'Write'; }
  if (type === 'Influence') { proprietes.modificateur = '+'; }
  if (type === 'Association') { proprietes.dirigee = 'true'; }

  documents.push({
    chemin: `cartographie/objets/${ type.toLowerCase() }/${ cle.toLowerCase() }.yaml`,
    data: {
      cle,
      type,
      nom: type,
      source: keyOf('ApplicationComponent'),
      cible: keyOf('ApplicationService'),
      ...(Object.keys(proprietes).length ? { proprietes } : {})
    }
  });
  relationships.push(cle);

  // a dedicated pair of nodes for this relationship's demo
  const sourceNode = `N-REL-${ index }-S`;
  const targetNode = `N-REL-${ index }-T`;

  noeuds.push({ id: sourceNode, element: keyOf('ApplicationComponent') });
  noeuds.push({ id: targetNode, element: keyOf('ApplicationService') });

  const y = gridBottom + 60 + index * 90;

  geomNoeuds[ sourceNode ] = { x: 40, y, l: W, h: H };
  geomNoeuds[ targetNode ] = { x: 460, y, l: W, h: H };

  const connexionId = `C-${ type.toUpperCase() }`;
  connexions.push({
    id: connexionId,
    relationship: cle,
    de: sourceNode,
    vers: targetNode
  });

  geomConnexions[ connexionId ] = {
    libelle: { position: 0.5, dx: 0, dy: -10 }
  };
});

// -- junction demo: A triggers (and-junction) both B and C -------------------

const junctionY = gridBottom + 60 + RELATIONSHIP_TYPES.length * 90 + 40;

[
  [ 'REL-VERS-JONCTION', keyOf('BusinessEvent'), keyOf('AndJunction') ],
  [ 'REL-JONCTION-B', keyOf('AndJunction'), keyOf('BusinessProcess') ],
  [ 'REL-JONCTION-C', keyOf('AndJunction'), keyOf('BusinessFunction') ]
].forEach(([ cle, source, cible ]) => {
  documents.push({
    chemin: `cartographie/objets/triggering/${ cle.toLowerCase() }.yaml`,
    data: { cle, type: 'Triggering', nom: '', source, cible }
  });
  relationships.push(cle);
});

noeuds.push({ id: 'N-J-A', element: keyOf('BusinessEvent') });
noeuds.push({ id: 'N-J-AND', element: keyOf('AndJunction') });
noeuds.push({ id: 'N-J-B', element: keyOf('BusinessProcess') });
noeuds.push({ id: 'N-J-C', element: keyOf('BusinessFunction') });

geomNoeuds[ 'N-J-A' ] = { x: 40, y: junctionY, l: W, h: H };
geomNoeuds[ 'N-J-AND' ] = { x: 300, y: junctionY + 22, l: 15, h: 15 };
geomNoeuds[ 'N-J-B' ] = { x: 460, y: junctionY - 50, l: W, h: H };
geomNoeuds[ 'N-J-C' ] = { x: 460, y: junctionY + 50, l: W, h: H };

connexions.push(
  { id: 'C-J-1', relationship: 'REL-VERS-JONCTION', de: 'N-J-A', vers: 'N-J-AND' },
  { id: 'C-J-2', relationship: 'REL-JONCTION-B', de: 'N-J-AND', vers: 'N-J-B' },
  { id: 'C-J-3', relationship: 'REL-JONCTION-C', de: 'N-J-AND', vers: 'N-J-C' });

// -- note, frame, nesting, relative position ---------------------------------

const extrasY = junctionY + 160;

noeuds.push({ id: 'N-NOTE', note: 'Toutes les notations ArchiMate 3.2 de la spécification.' });
geomNoeuds[ 'N-NOTE' ] = { x: 40, y: extrasY, l: 260, h: 70 };

noeuds.push({
  id: 'N-CADRE',
  cadre: 'Cadre de regroupement',
  enfants: [
    { id: 'N-IMBRIQUE-PARENT', element: keyOf('ApplicationComponent'),
      enfants: [ { id: 'N-IMBRIQUE-ENFANT', element: keyOf('ApplicationInterface') } ] }
  ]
});
geomNoeuds[ 'N-CADRE' ] = { x: 360, y: extrasY, l: 420, h: 240 };
geomNoeuds[ 'N-IMBRIQUE-PARENT' ] = { relatif: 'N-CADRE', dx: 30, dy: 40, l: 320, h: 160 };
geomNoeuds[ 'N-IMBRIQUE-ENFANT' ] = { relatif: 'N-IMBRIQUE-PARENT', dx: 20, dy: 60, l: 140, h: 60 };

// -- assemble -----------------------------------------------------------------

const model = {
  id: 'MOD-TOUS-ELEMENTS',
  nom: 'Toutes les notations ArchiMate 3.2',
  description:
    'Vue de contrôle : chaque élément, chaque relation, jonction, note, cadre, imbrication.',
  regles: {
    chemin: 'cartographie/regles/standard.rules.yaml',
    data: {
      lang: 'fr',
      defaut: { name: '$.nom' },
      relationships: [
        { type: 'Access', name: '$.nom', accessType: '$.proprietes.acces' },
        { type: 'Influence', name: '$.nom', modifier: '$.proprietes.modificateur' },
        { type: 'Association', name: '$.nom', isDirected: '$.proprietes.dirigee' }
      ]
    }
  },
  graphique: {
    chemin: 'cartographie/modeles/tous-elements.graphique.yaml',
    data: {
      vues: {
        'VUE-TOUS-ELEMENTS': {
          noeuds: geomNoeuds,
          connexions: geomConnexions
        }
      }
    }
  },
  documents,
  elements,
  relationships,
  vues: [
    {
      id: 'VUE-TOUS-ELEMENTS',
      nom: 'Toutes les notations',
      noeuds,
      connexions
    }
  ]
};

const outDir = join(
  dirname(fileURLToPath(import.meta.url)), '..', 'examples', 'tous-elements');
mkdirSync(outDir, { recursive: true });

const header =
  '# Généré par scripts/generate-tous-elements.mjs — ne pas éditer à la main.\n';

writeFileSync(
  join(outDir, 'modele-hydrate.yaml'),
  header + dump(model, { lineWidth: 100, noRefs: true }));

console.log(
  `écrit examples/tous-elements/modele-hydrate.yaml : ` +
  `${ elements.length } éléments, ${ relationships.length } relations, ` +
  `${ noeuds.length } nœuds`);
