/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  ConnectionGeometry,
  GraphicsFile,
  NodeGeometry,
  ViewGraphics
} from '../contract/types.ts';

/**
 * Rebuilds the graphics file from the current moddle view trees. Only
 * coordinates go in there. The shape of the input graphics is
 * preserved where it still applies: a node stored relative to another
 * stays relative (with recomputed offsets), anchors and label
 * positions are kept for connections that still exist.
 */
export function saveGraphics(
    inputGraphics: GraphicsFile,
    viewsByVueId: Map<string, any>
): GraphicsFile {

  const vues: Record<string, ViewGraphics> = {};

  for (const [ vueId, view ] of viewsByVueId) {
    const inputVue = (inputGraphics.vues && inputGraphics.vues[ vueId ]) || {};

    const noeuds: Record<string, NodeGeometry> = {};
    const connexions: Record<string, ConnectionGeometry> = {};

    const absolute = new Map<string, { x: number, y: number }>();

    const collectNode = (node: any) => {
      absolute.set(node.hostNodeId, { x: node.x, y: node.y });

      for (const child of node.nodes || []) {
        collectNode(child);
      }
    };

    const nodes: any[] = [];
    const connections: any[] = [];

    for (const viewElement of view.viewElements || []) {
      if (viewElement.hostConnexionId !== undefined) {
        connections.push(viewElement);
      } else {
        nodes.push(viewElement);
        collectNode(viewElement);
      }
    }

    const writeNode = (node: any) => {
      const inputGeometry =
        (inputVue.noeuds && inputVue.noeuds[ node.hostNodeId ]) || {};

      const parentRef = inputGeometry.relatif;
      const parentPosition = parentRef ? absolute.get(parentRef) : undefined;

      if (parentRef && parentPosition) {
        noeuds[ node.hostNodeId ] = {
          relatif: parentRef,
          dx: node.x - parentPosition.x,
          dy: node.y - parentPosition.y,
          l: node.w,
          h: node.h
        };
      } else {
        noeuds[ node.hostNodeId ] = {
          x: node.x,
          y: node.y,
          l: node.w,
          h: node.h
        };
      }

      for (const child of node.nodes || []) {
        writeNode(child);
      }
    };

    for (const node of nodes) {
      writeNode(node);
    }

    for (const connection of connections) {
      const inputGeometry =
        (inputVue.connexions && inputVue.connexions[ connection.hostConnexionId ]) || {};

      const geometry: ConnectionGeometry = {};

      if (inputGeometry.ancre_source) {
        geometry.ancre_source = inputGeometry.ancre_source;
      }

      if (inputGeometry.ancre_cible) {
        geometry.ancre_cible = inputGeometry.ancre_cible;
      }

      const waypoints = (connection.waypointsNode &&
        connection.waypointsNode.waypoints) || [];

      // the first and last waypoints are the docking points on the
      // shapes; only the intermediate bendpoints go in the file
      const intermediate = waypoints.slice(1, -1)
        .map((waypoint: any) => ({ x: waypoint.x, y: waypoint.y }));

      if (intermediate.length) {
        geometry.points = intermediate;
      }

      if (inputGeometry.libelle) {
        geometry.libelle = { ...inputGeometry.libelle };
      }

      connexions[ connection.hostConnexionId ] = geometry;
    }

    const vueGraphics: ViewGraphics = {};

    if (Object.keys(noeuds).length) {
      vueGraphics.noeuds = noeuds;
    }

    if (Object.keys(connexions).length) {
      vueGraphics.connexions = connexions;
    }

    vues[ vueId ] = vueGraphics;
  }

  return { vues };
}
