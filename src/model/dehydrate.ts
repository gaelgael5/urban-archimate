import type {
  HydratedModel,
  Model,
  ModelView,
  ViewNode
} from '../contract/types.ts';

/**
 * Returns the model without any `data`, ready to write: hydrated
 * references become their paths again and the `types` list (a
 * hydration artifact) is dropped. Key order is deterministic.
 */
export function dehydrateModel(model: HydratedModel): Model {

  const result: Model = { id: model.id, regles: '', graphique: '' };

  if (model.nom !== undefined) {
    result.nom = model.nom;
  }

  if (model.description !== undefined) {
    result.description = model.description;
  }

  result.regles = model.regles.chemin;
  result.graphique = model.graphique.chemin;

  if (model.documents) {
    result.documents = model.documents.map((doc) => doc.chemin);
  }

  if (model.elements) {
    result.elements = [ ...model.elements ];
  }

  if (model.relationships) {
    result.relationships = [ ...model.relationships ];
  }

  if (model.vues) {
    result.vues = model.vues.map(cloneView);
  }

  return result;
}

/**
 * Keeps the model clean before saving, in place:
 *
 * - a node that designates a key that is no longer retained is dropped;
 * - a connection that designates a dropped relationship or node is dropped;
 * - a document none of whose objects is retained is dropped.
 */
export function cleanHydratedModel(model: HydratedModel): void {

  const retained = new Set([
    ...(model.elements || []),
    ...(model.relationships || [])
  ]);

  for (const vue of model.vues || []) {
    vue.noeuds = cleanNodes(vue.noeuds, model.elements || []);

    const nodeIds = new Set<string>();
    const collect = (noeuds: ViewNode[] | undefined) => {
      for (const noeud of noeuds || []) {
        nodeIds.add(noeud.id);
        collect(noeud.enfants);
      }
    };
    collect(vue.noeuds);

    vue.connexions = (vue.connexions || []).filter((connexion) =>
      (model.relationships || []).includes(connexion.relationship) &&
      nodeIds.has(connexion.de) &&
      nodeIds.has(connexion.vers));
  }

  if (model.documents) {
    model.documents = model.documents.filter(
      (doc) => retained.has(doc.data.cle));
  }
}

function cleanNodes(
    noeuds: ViewNode[] | undefined,
    elements: string[]
): ViewNode[] {

  return (noeuds || [])
    .filter((noeud) => !noeud.element || elements.includes(noeud.element))
    .map((noeud) => {
      if (noeud.enfants) {
        return { ...noeud, enfants: cleanNodes(noeud.enfants, elements) };
      }

      return noeud;
    });
}

function cloneView(vue: ModelView): ModelView {
  const copy: ModelView = { id: vue.id };

  if (vue.nom !== undefined) {
    copy.nom = vue.nom;
  }

  if (vue.point_de_vue !== undefined) {
    copy.point_de_vue = vue.point_de_vue;
  }

  if (vue.noeuds !== undefined) {
    copy.noeuds = vue.noeuds.map(cloneNode);
  }

  if (vue.connexions !== undefined) {
    copy.connexions = vue.connexions.map((connexion) => ({ ...connexion }));
  }

  return copy;
}

function cloneNode(noeud: ViewNode): ViewNode {
  const copy: ViewNode = { ...noeud };

  if (noeud.enfants !== undefined) {
    copy.enfants = noeud.enfants.map(cloneNode);
  }

  return copy;
}
