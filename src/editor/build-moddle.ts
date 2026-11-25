/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Builds the in-memory ArchiMate model read by the engine taken over
 * from archimate-js: the moddle tree that `BaseViewer.importModel`
 * renders. No XML involved: the rules output feeds the moddle objects
 * directly.
 */

import type { HydratedModel, ModelView, ViewNode } from '../contract/types.ts';

import type { ArchimateModelIR } from '../rules/engine.ts';
import { archimateIdOf } from '../rules/engine.ts';

import { resolveViewGeometry } from '../model/geometry.ts';

export interface BuiltModel {

  /** The archimate:Model moddle element. */
  model: any;

  /** Every moddle element with an id, by id (for id claiming). */
  elementsById: Record<string, any>;

  /** The archimate:View moddle elements, by view id of the document. */
  viewsByVueId: Map<string, any>;
}

/** Internal moddle id of a view node. */
export function internalNodeId(vueId: string, nodeId: string): string {
  return `n-${ vueId }-${ nodeId }`;
}

/** Internal moddle id of a view connection. */
export function internalConnectionId(vueId: string, connexionId: string): string {
  return `c-${ vueId }-${ connexionId }`;
}

/**
 * Builds the moddle tree for a hydrated model whose rules produced
 * `ir`. Each view element carries `hostNodeId` (the node id of the
 * model document) and, for element nodes, `hostKey` (the object key),
 * so the save path can go back to the document form.
 */
export function buildModdleModel(
    moddle: any,
    hydrated: HydratedModel,
    ir: ArchimateModelIR
): BuiltModel {

  const elementsById: Record<string, any> = {};

  const track = (element: any) => {
    if (element.id) {
      elementsById[ element.id ] = element;
    }

    return element;
  };

  // base elements and relationships ----------------------------------------

  const conceptByKey = new Map<string, any>();

  const baseElements = ir.elements.map((element) => {
    const moddleElement = track(moddle.create('archimate:BaseElement', {
      id: element.id,
      type: element.archimateType,
      name: element.name
    }));

    if (element.documentation) {
      moddleElement.documentation = element.documentation;
    }

    conceptByKey.set(element.cle, moddleElement);

    return moddleElement;
  });

  const elementsNode = moddle.create('archimate:Elements', {
    baseElements
  });
  baseElements.forEach((element: any) => { element.$parent = elementsNode; });

  const relationships = ir.relationships.map((relationship) => {
    const attrs: Record<string, unknown> = {
      id: relationship.id,
      type: relationship.archimateType,
      name: relationship.name,
      source: elementsById[ relationship.source ],
      target: elementsById[ relationship.target ],
      ...relationship.attributes
    };

    const moddleRelationship = track(
      moddle.create('archimate:Relationship', attrs));

    if (relationship.documentation) {
      moddleRelationship.documentation = relationship.documentation;
    }

    conceptByKey.set(relationship.cle, moddleRelationship);

    return moddleRelationship;
  });

  const relationshipsNode = moddle.create('archimate:Relationships', {
    relationships
  });
  relationships.forEach((relationship: any) => {
    relationship.$parent = relationshipsNode;
  });

  // property definitions ----------------------------------------------------

  const propertyDefinitions = ir.propertyDefinitions.map((definition) =>
    track(moddle.create('archimate:PropertyDefinition', {
      id: definition.id,
      name: definition.name,
      type: definition.type
    })));

  const propertyDefinitionsNode = moddle.create('archimate:PropertyDefinitions', {
    propertyDefinitions
  });

  // views --------------------------------------------------------------------

  const viewsByVueId = new Map<string, any>();

  const viewsList = (hydrated.vues || []).map((vue) => {
    const view = buildView(moddle, hydrated, vue, conceptByKey, track);
    viewsByVueId.set(vue.id, view);

    return view;
  });

  const diagrams = moddle.create('archimate:Diagrams', { viewsList });
  const views = moddle.create('archimate:Views', { diagrams });

  // model ----------------------------------------------------------------------

  const model = moddle.create('archimate:Model', {
    id: ir.id,
    name: ir.name,
    documentation: ir.documentation,
    elementsNode,
    relationshipsNode,
    views,
    propertyDefinitionsNode
  });

  track(model);

  elementsNode.$parent = model;
  relationshipsNode.$parent = model;
  propertyDefinitionsNode.$parent = model;
  views.$parent = model;
  diagrams.$parent = views;
  viewsList.forEach((view: any) => { view.$parent = diagrams; });

  return { model, elementsById, viewsByVueId };
}

function buildView(
    moddle: any,
    hydrated: HydratedModel,
    vue: ModelView,
    conceptByKey: Map<string, any>,
    track: (element: any) => any
): any {

  const geometry = resolveViewGeometry(vue, hydrated.graphique.data);

  const view = track(moddle.create('archimate:View', {
    id: `v-${ vue.id }`,
    name: vue.nom || vue.id
  }));

  view.hostVueId = vue.id;

  if (vue.point_de_vue) {
    view.hostViewpoint = vue.point_de_vue;
  }

  const viewElements: any[] = [];
  const nodeByDocumentId = new Map<string, any>();

  const buildNode = (noeud: ViewNode, parent: any): any => {
    const resolved = geometry.get(noeud.id);

    const attrs: Record<string, unknown> = {
      id: internalNodeId(vue.id, noeud.id),
      x: resolved ? resolved.x : 0,
      y: resolved ? resolved.y : 0,
      w: resolved ? resolved.width : 120,
      h: resolved ? resolved.height : 55
    };

    if (noeud.element) {
      attrs.type = 'Element';
      attrs.elementRef = conceptByKey.get(noeud.element);
    } else if (noeud.note !== undefined) {
      attrs.type = 'Label';
      attrs.label = noeud.note;
    } else {
      // group frame — view-only container
      attrs.type = 'Container';
      attrs.label = noeud.cadre || '';
    }

    const node = track(moddle.create('archimate:Node', attrs));

    node.hostNodeId = noeud.id;

    if (noeud.element) {
      node.hostKey = noeud.element;
    }

    node.$parent = parent;

    const children = (noeud.enfants || []).map(
      (enfant) => buildNode(enfant, node));

    if (children.length) {
      node.nodes = children;
    }

    return node;
  };

  for (const noeud of vue.noeuds || []) {
    const node = buildNode(noeud, view);
    viewElements.push(node);
    collectNodes(node, nodeByDocumentId, vue.id);
  }

  const connectionGeometries = (hydrated.graphique.data.vues &&
    hydrated.graphique.data.vues[ vue.id ] &&
    hydrated.graphique.data.vues[ vue.id ].connexions) || {};

  for (const connexion of vue.connexions || []) {
    const sourceNode = nodeByDocumentId.get(connexion.de);
    const targetNode = nodeByDocumentId.get(connexion.vers);

    if (!sourceNode || !targetNode) {
      continue; // the loader refuses such models; defensive here
    }

    const relationshipRef = conceptByKey.get(connexion.relationship);

    const connection = track(moddle.create('archimate:Connection', {
      id: internalConnectionId(vue.id, connexion.id),
      type: 'Relationship',
      relationshipRef,
      source: sourceNode,
      target: targetNode
    }));

    connection.hostConnexionId = connexion.id;
    connection.hostKey = connexion.relationship;
    connection.$parent = view;

    const points = (connectionGeometries[ connexion.id ] &&
      connectionGeometries[ connexion.id ].points) || [];

    const waypoints = [
      centerOf(sourceNode),
      ...points.map((point) => ({ x: point.x, y: point.y })),
      centerOf(targetNode)
    ].map((point) => moddle.create('archimate:Waypoint', point));

    const waypointsNode = moddle.create('archimate:Waypoints', { waypoints });
    waypointsNode.$parent = connection;
    waypoints.forEach((waypoint: any) => { waypoint.$parent = waypointsNode; });

    connection.waypointsNode = waypointsNode;

    viewElements.push(connection);
  }

  if (viewElements.length) {
    view.viewElements = viewElements;
  }

  return view;
}

function collectNodes(
    node: any,
    byDocumentId: Map<string, any>,
    vueId: string
): void {

  byDocumentId.set(node.hostNodeId, node);

  for (const child of node.nodes || []) {
    collectNodes(child, byDocumentId, vueId);
  }
}

function centerOf(node: any): { x: number, y: number } {
  return {
    x: Math.round(node.x + node.w / 2),
    y: Math.round(node.y + node.h / 2)
  };
}

/** Re-exported for the save path. */
export { archimateIdOf };
