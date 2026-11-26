import { Ajv2020 } from 'ajv/dist/2020.js';

import type {
  GraphicsFile,
  HydratedModel,
  ModelIssue,
  ViewNode
} from '../contract/types.ts';

import hydratedModelSchema from '../../schema/hydrated-model.schema.json' with { type: 'json' };

// la notation connaît les types ArchiMate : un objet dont le type est
// déjà un type ArchiMate n'a pas besoin de schéma fourni par l'hôte
import { FULL_ELEMENT_MAP } from '../../lib/util/ModelUtil.js';

const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true });

const validateShape = ajv.compile(hydratedModelSchema);

/**
 * Validates a hydrated model: JSON Schema first, then the cross
 * controls shared with Ossie-studio. Returns the issues; an empty
 * array means the model is accepted. Issues with `severity: 'warning'`
 * (extra graphics entries) do not refuse the model.
 */
export function validateHydratedModel(
    model: HydratedModel
): { errors: ModelIssue[], warnings: ModelIssue[] } {

  const errors: ModelIssue[] = [];
  const warnings: ModelIssue[] = [];

  if (!validateShape(model)) {
    for (const schemaError of validateShape.errors || []) {
      errors.push({
        code: 'schema',
        message: `${ schemaError.instancePath || '(racine)' } ${ schemaError.message }`,
        element: schemaError.instancePath
      });
    }

    // structural errors first: the cross controls below assume the shape
    return { errors, warnings };
  }

  const documents = model.documents || [];
  const elements = model.elements || [];
  const relationships = model.relationships || [];
  const vues = model.vues || [];

  const objectsByKey = new Map(
    documents.map((doc) => [ doc.data.cle, doc.data ]));

  const retained = new Set([ ...elements, ...relationships ]);

  // (1) a retained key absent from the documents
  for (const cle of retained) {
    if (!objectsByKey.has(cle)) {
      errors.push({
        code: 'cle-retenue-sans-document',
        message: `la clé retenue « ${ cle } » n'apparaît dans aucun document`,
        element: cle
      });
    }
  }

  // duplicate keys across documents
  const seen = new Set<string>();
  for (const doc of documents) {
    if (seen.has(doc.data.cle)) {
      errors.push({
        code: 'cle-en-double',
        message: `la clé « ${ doc.data.cle } » apparaît dans plusieurs documents`,
        element: doc.data.cle
      });
    }
    seen.add(doc.data.cle);
  }

  // (2) a retained relationship whose source or target is not retained
  for (const cle of relationships) {
    const relation = objectsByKey.get(cle);

    if (!relation) {
      continue; // already reported by (1)
    }

    if (!relation.source || !relation.cible) {
      errors.push({
        code: 'relation-sans-extremites',
        message: `la relation « ${ cle } » n'a pas de source et de cible`,
        element: cle
      });
      continue;
    }

    for (const extremite of [ relation.source, relation.cible ]) {
      if (!retained.has(extremite)) {
        errors.push({
          code: 'relation-extremite-non-retenue',
          message: `la relation « ${ cle } » désigne « ${ extremite } », qui n'est pas retenu`,
          element: cle
        });
      }
    }
  }

  // (3) a node or connection that designates a non-retained key or an
  // unknown node
  for (const vue of vues) {
    const nodeIds = new Set<string>();

    const collectNodes = (noeuds: ViewNode[] | undefined) => {
      for (const noeud of noeuds || []) {
        nodeIds.add(noeud.id);
        collectNodes(noeud.enfants);
      }
    };
    collectNodes(vue.noeuds);

    const checkNodes = (noeuds: ViewNode[] | undefined) => {
      for (const noeud of noeuds || []) {
        if (noeud.element && !elements.includes(noeud.element)) {
          errors.push({
            code: 'noeud-cle-non-retenue',
            message: `le nœud « ${ noeud.id } » de la vue « ${ vue.id } » désigne « ${ noeud.element } », qui n'est pas retenu`,
            element: noeud.id
          });
        }
        checkNodes(noeud.enfants);
      }
    };
    checkNodes(vue.noeuds);

    for (const connexion of vue.connexions || []) {
      if (!relationships.includes(connexion.relationship)) {
        errors.push({
          code: 'connexion-cle-non-retenue',
          message: `la connexion « ${ connexion.id } » de la vue « ${ vue.id } » désigne « ${ connexion.relationship } », qui n'est pas retenu`,
          element: connexion.id
        });
      }

      for (const extremite of [ connexion.de, connexion.vers ]) {
        if (!nodeIds.has(extremite)) {
          errors.push({
            code: 'connexion-noeud-inconnu',
            message: `la connexion « ${ connexion.id } » de la vue « ${ vue.id } » désigne le nœud inconnu « ${ extremite } »`,
            element: connexion.id
          });
        }
      }
    }
  }

  // (4) a document with no retained object
  for (const doc of documents) {
    if (!retained.has(doc.data.cle)) {
      errors.push({
        code: 'document-sans-objet-retenu',
        message: `le document « ${ doc.chemin } » ne porte aucun objet retenu`,
        element: doc.chemin
      });
    }
  }

  // (5) a graphics entry without a matching node or connection
  // (ignored and reported)
  collectGraphicsWarnings(model.graphique.data, vues, warnings);

  // every type used by a document has its schema
  const typeSlugs = new Set(
    (model.types || []).map((type) => slugOfTypePath(type.chemin)));

  for (const doc of documents) {
    if (typeSlugs.size && !typeSlugs.has(doc.data.type) &&
        !(FULL_ELEMENT_MAP as Map<string, unknown>).has(doc.data.type) &&
        doc.data.type !== 'Junction') {
      warnings.push({
        code: 'type-sans-schema',
        message: `l'objet « ${ doc.data.cle } » a le type « ${ doc.data.type } », dont le schéma n'est pas fourni`,
        element: doc.data.cle
      });
    }
  }

  return { errors, warnings };
}

function collectGraphicsWarnings(
    graphics: GraphicsFile,
    vues: HydratedModel['vues'],
    warnings: ModelIssue[]
): void {

  const vuesById = new Map((vues || []).map((vue) => [ vue.id, vue ]));

  for (const [ vueId, vueGraphics ] of Object.entries(graphics.vues || {})) {
    const vue = vuesById.get(vueId);

    if (!vue) {
      warnings.push({
        code: 'graphique-vue-inconnue',
        message: `le graphique porte une entrée pour la vue inconnue « ${ vueId } »`,
        element: vueId
      });
      continue;
    }

    const nodeIds = new Set<string>();
    const collect = (noeuds: ViewNode[] | undefined) => {
      for (const noeud of noeuds || []) {
        nodeIds.add(noeud.id);
        collect(noeud.enfants);
      }
    };
    collect(vue.noeuds);

    const connectionIds = new Set(
      (vue.connexions || []).map((connexion) => connexion.id));

    for (const nodeId of Object.keys(vueGraphics.noeuds || {})) {
      if (!nodeIds.has(nodeId)) {
        warnings.push({
          code: 'graphique-noeud-inconnu',
          message: `le graphique de la vue « ${ vueId } » porte une entrée pour le nœud inconnu « ${ nodeId } » (ignorée)`,
          element: nodeId
        });
      }
    }

    for (const connectionId of Object.keys(vueGraphics.connexions || {})) {
      if (!connectionIds.has(connectionId)) {
        warnings.push({
          code: 'graphique-connexion-inconnue',
          message: `le graphique de la vue « ${ vueId } » porte une entrée pour la connexion inconnue « ${ connectionId } » (ignorée)`,
          element: connectionId
        });
      }
    }
  }
}

/** `cartographie/types/application.schema.yaml` → `application` */
function slugOfTypePath(chemin: string): string {
  const base = chemin.split('/').pop() || chemin;

  return base.replace(/\.schema\.ya?ml$/, '');
}
