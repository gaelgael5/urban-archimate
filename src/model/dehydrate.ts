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
