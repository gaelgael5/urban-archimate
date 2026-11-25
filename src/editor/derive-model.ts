/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Derives the document form (model views, retained keys, documents)
 * from the LIVE state of the diagram's semantic tree. The command
 * stack is the single source of truth: posing, drawing, removing,
 * undo and redo all end up here, so the saved model always matches
 * what is on screen.
 */

import type {
  HydratedModel,
  Model,
  ModelView,
  ViewConnection,
  ViewNode
} from '../contract/types.ts';

/** Snapshot of the retained keys as loaded (before any editing). */
export interface LoadSnapshot {

  elements: string[];
  relationships: string[];

  /** Keys that had at least one node/connection in the loaded views. */
  placedElements: Set<string>;
  placedRelationships: Set<string>;
}

export function snapshotOf(hydrated: HydratedModel): LoadSnapshot {
  const placedElements = new Set<string>();
  const placedRelationships = new Set<string>();

  const collect = (noeuds: ViewNode[] | undefined) => {
    for (const noeud of noeuds || []) {
      if (noeud.element) {
        placedElements.add(noeud.element);
      }
      collect(noeud.enfants);
    }
  };

  for (const vue of hydrated.vues || []) {
    collect(vue.noeuds);

    for (const connexion of vue.connexions || []) {
      placedRelationships.add(connexion.relationship);
    }
  }

  return {
    elements: [ ...(hydrated.elements || []) ],
    relationships: [ ...(hydrated.relationships || []) ],
    placedElements,
    placedRelationships
  };
}

interface DerivedViews {
  vues: ModelView[];
  placedElements: Set<string>;
  placedRelationships: Set<string>;
}

/** Rebuilds the views (document form) from the live moddle views. */
export function deriveViews(
    hydrated: HydratedModel,
    viewsByVueId: Map<string, any>
): DerivedViews {

  const vues: ModelView[] = [];
  const placedElements = new Set<string>();
  const placedRelationships = new Set<string>();

  for (const vueSource of hydrated.vues || []) {
    const view = viewsByVueId.get(vueSource.id);

    const vue: ModelView = { id: vueSource.id };

    if (vueSource.nom !== undefined) {
      vue.nom = vueSource.nom;
    }

    if (vueSource.point_de_vue !== undefined) {
      vue.point_de_vue = vueSource.point_de_vue;
    }

    const noeuds: ViewNode[] = [];
    const connexions: ViewConnection[] = [];

    const deriveNode = (bo: any): ViewNode => {
      const noeud: ViewNode = { id: bo.hostNodeId };

      if (bo.hostKey) {
        noeud.element = bo.hostKey;
        placedElements.add(bo.hostKey);
      } else if (bo.type === 'Container') {
        noeud.cadre = bo.label || '';
      } else {
        noeud.note = bo.label || '';
      }

      const enfants = (bo.nodes || []).map(deriveNode);

      if (enfants.length) {
        noeud.enfants = enfants;
      }

      return noeud;
    };

    for (const viewElement of (view && view.viewElements) || []) {
      if (viewElement.hostConnexionId !== undefined) {
        const source = viewElement.source;
        const target = viewElement.target;

        if (!source || !target) {
          continue;
        }

        connexions.push({
          id: viewElement.hostConnexionId,
          relationship: viewElement.hostKey,
          de: source.hostNodeId,
          vers: target.hostNodeId
        });

        placedRelationships.add(viewElement.hostKey);
      } else {
        noeuds.push(deriveNode(viewElement));
      }
    }

    if (noeuds.length) {
      vue.noeuds = noeuds;
    }

    if (connexions.length) {
      vue.connexions = connexions;
    }

    vues.push(vue);
  }

  return { vues, placedElements, placedRelationships };
}

/**
 * Derives the saved model: a key loaded as retained stays retained
 * unless all of its placements were removed; a key placed during the
 * session joins the retained keys; a document whose object is no
 * longer retained is dropped.
 */
export function deriveModel(
    hydrated: HydratedModel,
    snapshot: LoadSnapshot,
    derived: DerivedViews
): Model {

  const keepRetained = (
      original: string[],
      placedAtLoad: Set<string>,
      placedNow: Set<string>
  ): string[] => {

    const kept = original.filter((cle) =>
      placedNow.has(cle) || !placedAtLoad.has(cle));

    for (const cle of placedNow) {
      if (!kept.includes(cle)) {
        kept.push(cle);
      }
    }

    return kept;
  };

  const elements = keepRetained(
    snapshot.elements, snapshot.placedElements, derived.placedElements);

  const relationships = keepRetained(
    snapshot.relationships, snapshot.placedRelationships,
    derived.placedRelationships);

  const retained = new Set([ ...elements, ...relationships ]);

  const model: Model = { id: hydrated.id, regles: '', graphique: '' };

  if (hydrated.nom !== undefined) {
    model.nom = hydrated.nom;
  }

  if (hydrated.description !== undefined) {
    model.description = hydrated.description;
  }

  model.regles = hydrated.regles.chemin;
  model.graphique = hydrated.graphique.chemin;

  if (hydrated.documents) {
    model.documents = hydrated.documents
      .filter((doc) => retained.has(doc.data.cle))
      .map((doc) => doc.chemin);
  }

  if (elements.length || hydrated.elements) {
    model.elements = elements;
  }

  if (relationships.length || hydrated.relationships) {
    model.relationships = relationships;
  }

  model.vues = derived.vues;

  return model;
}
