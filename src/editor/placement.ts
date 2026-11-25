/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Placing host objects on the current view: the drop delegate flow.
 *
 * The component never creates objects: it asks the host (drop
 * delegate) and places what the host returns. Notes and group frames
 * are view-only tools and never reach the host.
 */

import type {
  CartographyObject,
  DropResult,
  HydratedModel,
  ModelView
} from '../contract/types.ts';

import {
  archimateIdOf,
  indexRules,
  schemasOf,
  translateObject
} from '../rules/engine.ts';

export interface PlacementContext {
  viewer: any;
  hydrated: HydratedModel;
  vue: ModelView;
  view: any; // archimate:View moddle element
}

/** Error raised when an existing relation cannot be placed. */
export class PlacementError extends Error {

  constructor(message: string) {
    super(message);
    this.name = 'PlacementError';
  }
}

let nodeSeq = 0;

/** Ids already used by the live view (nodes and connections). */
function liveIds(view: any): Set<string> {
  const existing = new Set<string>();

  const walk = (elements: any[]) => {
    for (const element of elements || []) {
      if (element.hostNodeId !== undefined) {
        existing.add(element.hostNodeId);
      }
      if (element.hostConnexionId !== undefined) {
        existing.add(element.hostConnexionId);
      }
      walk(element.nodes);
    }
  };
  walk(view.viewElements);

  return existing;
}

function nextNodeId(view: any): string {
  const existing = liveIds(view);

  let id;
  do {
    id = `N${ ++nodeSeq }`;
  } while (existing.has(id));

  return id;
}

function nextConnectionId(view: any): string {
  const existing = liveIds(view);

  let id;
  do {
    id = `C${ ++nodeSeq }`;
  } while (existing.has(id));

  return id;
}

/** Merges what the drop delegate returned into the hydrated model. */
export function absorbDropResult(
    hydrated: HydratedModel,
    result: DropResult
): CartographyObject {

  const objet = result.objet.data;

  if (result.schemaType) {
    const types = hydrated.types || (hydrated.types = []);

    if (!types.some((t) => t.chemin === result.schemaType!.chemin)) {
      types.push(result.schemaType);
    }
  }

  if (result.regles) {
    const rules = hydrated.regles.data;
    const isRelationship = !!(objet.source && objet.cible);
    const blocks = isRelationship
      ? (rules.relationships || (rules.relationships = []))
      : (rules.elements || (rules.elements = []));

    if (result.regles.type && !blocks.some((b) => b.type === result.regles!.type)) {
      blocks.push(result.regles);
    }
  }

  const documents = hydrated.documents || (hydrated.documents = []);

  if (!documents.some((doc) => doc.data.cle === objet.cle)) {
    documents.push(result.objet);
  }

  // the retained keys (elements / relationships) are derived from the
  // live diagram at save time, so that undo / redo stays exact

  return objet;
}

/** Finds (one of) the node(s) of the view that places the given key. */
export function findNodeOfKey(view: any, cle: string): any {
  let found: any = null;

  const walk = (elements: any[]) => {
    for (const element of elements || []) {
      if (found) {
        return;
      }

      if (element.hostKey === cle && element.hostConnexionId === undefined) {
        found = element;
        return;
      }

      walk(element.nodes);
    }
  };

  walk(view.viewElements);

  return found;
}

/**
 * Places an element object (returned by the drop delegate) on the
 * view at the given position. Returns the created diagram shape.
 */
export function placeElement(
    context: PlacementContext,
    objet: CartographyObject,
    position: { x: number, y: number }
): any {

  const { viewer, hydrated, vue, view } = context;

  const moddle = viewer._moddle;
  const index = indexRules(hydrated.regles.data);
  const schemasByType = schemasOf(hydrated);

  const translated = translateObject(objet, false, index, schemasByType);

  // the ArchiMate concept (reuse it when the object is already placed
  // in another view)
  const conceptId = archimateIdOf(objet.cle);

  let concept = viewer._elementsById && viewer._elementsById[ conceptId ];

  if (!concept) {
    concept = moddle.create('archimate:BaseElement', {
      id: conceptId,
      type: translated.archimateType,
      name: translated.name
    });

    if (translated.documentation) {
      concept.documentation = translated.documentation;
    }

    const model = view.$parent.$parent.$parent; // view < diagrams < views < model
    const elementsNode = model.elementsNode;
    elementsNode.get('baseElements').push(concept);
    concept.$parent = elementsNode;

    if (viewer._elementsById) {
      viewer._elementsById[ conceptId ] = concept;
    }
  }

  // the view node (semantic attachment handled by NodeUpdater on
  // shape.create; the document form is derived from the live view at
  // save time)
  const hostNodeId = nextNodeId(view);

  const node = moddle.create('archimate:Node', {
    id: `n-${ vue.id }-${ hostNodeId }`,
    type: 'Element',
    elementRef: concept
  });

  node.hostNodeId = hostNodeId;
  node.hostKey = objet.cle;

  const elementFactory = viewer.get('elementFactory');
  const modeling = viewer.get('modeling');
  const canvas = viewer.get('canvas');

  const shape = elementFactory.createShape({
    type: translated.archimateType,
    businessObject: node,
    width: 120,
    height: 55
  });

  shape.name = translated.name;

  // NodeUpdater reuses this concept instead of creating a fresh one
  shape.newElementRef = concept;

  return modeling.createShape(shape, position, canvas.getRootElement());
}

/**
 * Places an existing relation (returned by the drop delegate): both
 * of its ends must already be in the view, otherwise the placement is
 * refused naming the missing end.
 */
export function placeExistingRelation(
    context: PlacementContext,
    objet: CartographyObject
): any {

  const { viewer, hydrated, vue, view } = context;

  const sourceNode = findNodeOfKey(view, objet.source!);
  const targetNode = findNodeOfKey(view, objet.cible!);

  if (!sourceNode) {
    throw new PlacementError(
      `la relation « ${ objet.cle } » ne peut pas être posée : ` +
      `sa source « ${ objet.source } » n'est pas dans la vue`);
  }

  if (!targetNode) {
    throw new PlacementError(
      `la relation « ${ objet.cle } » ne peut pas être posée : ` +
      `sa cible « ${ objet.cible } » n'est pas dans la vue`);
  }

  const moddle = viewer._moddle;
  const index = indexRules(hydrated.regles.data);
  const schemasByType = schemasOf(hydrated);

  const translated = translateObject(objet, true, index, schemasByType);

  const relationshipId = archimateIdOf(objet.cle);

  let relationship = viewer._elementsById && viewer._elementsById[ relationshipId ];

  if (!relationship) {
    relationship = moddle.create('archimate:Relationship', {
      id: relationshipId,
      type: translated.archimateType,
      name: translated.name,
      source: viewer._elementsById[ archimateIdOf(objet.source!) ],
      target: viewer._elementsById[ archimateIdOf(objet.cible!) ],
      ...translated.attributes
    });

    const model = view.$parent.$parent.$parent;
    const relationshipsNode = model.relationshipsNode;
    relationshipsNode.get('relationships').push(relationship);
    relationship.$parent = relationshipsNode;

    if (viewer._elementsById) {
      viewer._elementsById[ relationshipId ] = relationship;
    }
  }

  const hostConnexionId = nextConnectionId(view);

  const registry = viewer.get('elementRegistry');
  const modeling = viewer.get('modeling');

  const sourceShape = registry.get(sourceNode.id);
  const targetShape = registry.get(targetNode.id);

  const connection = modeling.connect(sourceShape, targetShape, {
    type: translated.archimateType,
    relationshipRef: relationship
  });

  connection.businessObject.hostConnexionId = hostConnexionId;
  connection.businessObject.hostKey = objet.cle;

  // the generic connection updater rewrote the relationship from the
  // drawn connection: restore what the host object says
  relationship.name = translated.name;
  Object.assign(relationship, translated.attributes);

  return connection;
}

/** Places a note (view-only; never calls the host). */
export function placeNote(
    context: PlacementContext,
    position: { x: number, y: number },
    texte = ''
): any {

  return placeViewOnly(context, position, { note: texte }, 'Label', {
    width: 150,
    height: 70
  });
}

/** Places a group frame (view-only; never calls the host). */
export function placeFrame(
    context: PlacementContext,
    position: { x: number, y: number },
    libelle = 'Cadre'
): any {

  return placeViewOnly(context, position, { cadre: libelle }, 'Container', {
    width: 300,
    height: 200
  });
}

function placeViewOnly(
    context: PlacementContext,
    position: { x: number, y: number },
    attributes: { note?: string, cadre?: string },
    type: string,
    size: { width: number, height: number }
): any {

  const { viewer, vue, view } = context;

  const moddle = viewer._moddle;
  const hostNodeId = nextNodeId(view);

  const node = moddle.create('archimate:Node', {
    id: `n-${ vue.id }-${ hostNodeId }`,
    type,
    label: attributes.note !== undefined ? attributes.note : attributes.cadre
  });

  node.hostNodeId = hostNodeId;

  const elementFactory = viewer.get('elementFactory');
  const modeling = viewer.get('modeling');
  const canvas = viewer.get('canvas');

  const shape = elementFactory.createShape({
    type,
    businessObject: node,
    ...size
  });

  return modeling.createShape(shape, position, canvas.getRootElement());
}
