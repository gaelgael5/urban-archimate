/**
 * The DEMONSTRATION HOST: what Ossie-studio will be for the
 * component, played here by a static page. It owns the files
 * (objects, types, rules, models, graphics), hydrates a model,
 * provides the toolbox and answers the drop and allowedRelations
 * delegates. The component itself never touches these files.
 */

import { load as parseYaml } from 'js-yaml';

import type {
  AllowedRelationType,
  CartographyObject,
  Delegates,
  DropResult,
  HydratedModel,
  Model,
  ToolGroup,
  TypeSchema
} from '../src/contract/types.ts';

// every data file, embedded raw at build time
const files: Record<string, string> = {};

for (const [ path, contents ] of Object.entries(
  import.meta.glob('./donnees/**/*.yaml', {
    query: '?raw',
    import: 'default',
    eager: true
  }) as Record<string, string>)) {

  // './donnees/cartographie/...' -> 'cartographie/...'
  files[ path.replace('./donnees/', '') ] = contents;
}

function read<T>(chemin: string): T {
  const contents = files[ chemin ];

  if (contents === undefined) {
    throw new Error(`fichier inconnu côté hôte : ${ chemin }`);
  }

  return parseYaml(contents) as T;
}

/** The two demo models. */
export const MODELES = [
  'cartographie/modeles/parcours-commande-metier.modele.yaml',
  'cartographie/modeles/boutique-applicatif.modele.yaml'
];

const typePathOf = (slug: string) => `cartographie/types/${ slug }.schema.yaml`;

/** All objects of the space, by key. */
function allObjects(): Map<string, { chemin: string, data: CartographyObject }> {
  const objects = new Map<string, { chemin: string, data: CartographyObject }>();

  for (const chemin of Object.keys(files)) {
    if (chemin.startsWith('cartographie/objets/')) {
      const data = read<CartographyObject>(chemin);
      objects.set(data.cle, { chemin, data });
    }
  }

  return objects;
}

/** Hydrates a model: every reference carries its content in `data`. */
export function hydrate(modelePath: string): HydratedModel {
  const modele = read<Model>(modelePath);

  const documents = (modele.documents || []).map((chemin) => ({
    chemin,
    data: read<CartographyObject>(chemin)
  }));

  const typeSlugs = [ ...new Set(documents.map((doc) => doc.data.type)) ];

  return {
    id: modele.id,
    nom: modele.nom,
    description: modele.description,
    regles: { chemin: modele.regles, data: read(modele.regles) },
    graphique: { chemin: modele.graphique, data: read(modele.graphique) },
    types: typeSlugs.map((slug) => ({
      chemin: typePathOf(slug),
      data: read<TypeSchema>(typePathOf(slug))
    })),
    documents,
    elements: modele.elements,
    relationships: modele.relationships,
    vues: modele.vues
  };
}

// --- toolbox ----------------------------------------------------------

// Couche ArchiMate de chaque type de l'hôte. L'icône pointe sur le token de
// notation de la couche (--ua-notation-<couche>) : rendue dans le shadow DOM
// du composant, elle suit le thème au lieu d'une couleur écrite ici.
const LAYER_OF: Record<string, string> = {
  client: 'metier', vendeur: 'metier', 'processus-de-vente': 'metier',
  'evenement-metier': 'metier', 'service-metier': 'metier',
  'document-metier': 'metier',
  application: 'application', 'service-applicatif': 'application', donnees: 'application',
  serveur: 'technologie'
};

function iconeOf(objet: CartographyObject): string {
  const couche = LAYER_OF[ objet.type ] || 'autre';

  // le bloc blanc et sa bande de couche, comme dans le diagramme
  return '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">' +
    '<rect x="1.5" y="3.5" width="13" height="9" rx="1" ' +
    'style="fill: var(--ua-notation-element); stroke: var(--ua-notation-trait)"/>' +
    `<rect x="1.5" y="3.5" width="3" height="9" style="fill: var(--ua-notation-${ couche })"/></svg>`;
}

const GROUPES: { id: string, libelle: string, types: string[] }[] = [
  { id: 'metier', libelle: 'Objets — Métier',
    types: [ 'client', 'vendeur', 'processus-de-vente', 'evenement-metier',
      'service-metier', 'document-metier' ] },
  { id: 'application', libelle: 'Objets — Application & technologie',
    types: [ 'application', 'service-applicatif', 'donnees', 'serveur' ] },
  { id: 'relations', libelle: 'Relations existantes',
    types: [ 'acces', 'declenchement', 'affectation', 'realisation',
      'service', 'flux' ] }
];

export function toolbox(): ToolGroup[] {
  const objects = allObjects();

  return GROUPES.map((groupe) => ({
    id: groupe.id,
    libelle: groupe.libelle,
    outils: [ ...objects.values() ]
      .filter((objet) => groupe.types.includes(objet.data.type))
      .map((objet) => ({
        cle: objet.data.cle,
        libelle: objet.data.nom || objet.data.cle,
        icone: iconeOf(objet.data)
      }))
  })).filter((groupe) => groupe.outils.length);
}

// --- drop delegate ----------------------------------------------------

export function drop(cle: string): DropResult {
  const objet = allObjects().get(cle);

  if (!objet) {
    throw new Error(`objet inconnu côté hôte : ${ cle }`);
  }

  const regles = read<{ elements?: { type?: string }[], relationships?: { type?: string }[] }>(
    'cartographie/regles/standard.rules.yaml');

  const isRelation = !!(objet.data.source && objet.data.cible);
  const blocs = isRelation ? regles.relationships : regles.elements;

  return {
    objet,
    schemaType: {
      chemin: typePathOf(objet.data.type),
      data: read<TypeSchema>(typePathOf(objet.data.type))
    },
    regles: (blocs || []).find((bloc) => bloc.type === objet.data.type)
  };
}

// --- allowed relations -------------------------------------------------

/** The host's own relationship rules, by (source type, target type). */
const RELATIONS_PERMISES: { de: string[], vers: string[], types: string[] }[] = [
  { de: [ 'processus-de-vente' ], vers: [ 'document-metier' ], types: [ 'acces' ] },
  { de: [ 'application' ], vers: [ 'donnees' ], types: [ 'acces' ] },
  { de: [ 'evenement-metier', 'processus-de-vente' ],
    vers: [ 'processus-de-vente' ], types: [ 'declenchement' ] },
  { de: [ 'client', 'vendeur', 'serveur' ],
    vers: [ 'processus-de-vente', 'application' ], types: [ 'affectation' ] },
  { de: [ 'processus-de-vente' ], vers: [ 'service-metier' ], types: [ 'realisation' ] },
  { de: [ 'application' ], vers: [ 'service-applicatif' ], types: [ 'realisation' ] },
  { de: [ 'service-applicatif' ], vers: [ 'processus-de-vente' ], types: [ 'service' ] },
  { de: [ 'application' ], vers: [ 'application' ], types: [ 'flux' ] }
];

export function allowedRelations(
    cleSource: string,
    cleCible: string
): AllowedRelationType[] {

  const objects = allObjects();
  const source = objects.get(cleSource);
  const cible = objects.get(cleCible);

  if (!source || !cible) {
    return [];
  }

  const types = new Set<string>();

  for (const regle of RELATIONS_PERMISES) {
    if (regle.de.includes(source.data.type) &&
        regle.vers.includes(cible.data.type)) {
      regle.types.forEach((type) => types.add(type));
    }
  }

  return [ ...types ].map((type) => {
    const schema = read<TypeSchema>(typePathOf(type));

    return {
      type,
      archimate: schema[ 'x-archimate' ],
      libelle: schema.title || type,
      schema
    };
  });
}

/** The delegates handed to the component. */
export function delegates(): Delegates {
  return {
    toolbox: () => toolbox(),
    drop: (cle) => drop(cle),
    allowedRelations: (s, c) => allowedRelations(s, c)
  };
}
