import type {
  GraphicsFile,
  ModelView,
  NodeGeometry,
  ViewNode
} from '../contract/types.ts';

/** Resolved absolute geometry of a node. */
export interface AbsoluteGeometry {
  x: number;
  y: number;
  width: number;
  height: number;

  /** True when the geometry came from the graphics file. */
  fromGraphics: boolean;
}

/** Default size of a node without geometry. */
export const DEFAULT_NODE_SIZE = { width: 120, height: 55 };

/** Horizontal / vertical step of the fallback layout. */
const FALLBACK_STEP = { x: 160, y: 95 };

/**
 * Resolves the geometry of every node of a view to absolute
 * coordinates: positions may be absolute (`x`/`y`) or relative to
 * another node (`relatif` + `dx`/`dy`), as described in the graphics
 * file. A node without geometry gets a deterministic fallback
 * position.
 */
export function resolveViewGeometry(
    vue: ModelView,
    graphics: GraphicsFile
): Map<string, AbsoluteGeometry> {

  const geometries = (graphics.vues &&
    graphics.vues[ vue.id ] &&
    graphics.vues[ vue.id ].noeuds) || {};

  const resolved = new Map<string, AbsoluteGeometry>();

  const nodeIds: string[] = [];
  const collect = (noeuds: ViewNode[] | undefined) => {
    for (const noeud of noeuds || []) {
      nodeIds.push(noeud.id);
      collect(noeud.enfants);
    }
  };
  collect(vue.noeuds);

  const resolving = new Set<string>();

  const resolveNode = (nodeId: string): AbsoluteGeometry => {
    const already = resolved.get(nodeId);
    if (already) {
      return already;
    }

    if (resolving.has(nodeId)) {
      throw new Error(
        `géométrie circulaire : le nœud « ${ nodeId } » de la vue « ${ vue.id } » dépend de lui-même`);
    }
    resolving.add(nodeId);

    const geometry: NodeGeometry = geometries[ nodeId ] || {};

    const width = geometry.l !== undefined ? geometry.l : DEFAULT_NODE_SIZE.width;
    const height = geometry.h !== undefined ? geometry.h : DEFAULT_NODE_SIZE.height;

    let x: number, y: number;
    let fromGraphics = true;

    if (geometry.relatif) {
      const parent = resolveNode(geometry.relatif);
      x = parent.x + (geometry.dx || 0);
      y = parent.y + (geometry.dy || 0);
    } else if (geometry.x !== undefined || geometry.y !== undefined) {
      x = geometry.x || 0;
      y = geometry.y || 0;
    } else {
      // deterministic fallback: a simple grid in declaration order
      const index = nodeIds.indexOf(nodeId);
      x = 20 + (index % 5) * FALLBACK_STEP.x;
      y = 20 + Math.floor(index / 5) * FALLBACK_STEP.y;
      fromGraphics = false;
    }

    const result = { x, y, width, height, fromGraphics };
    resolved.set(nodeId, result);
    resolving.delete(nodeId);

    return result;
  };

  for (const nodeId of nodeIds) {
    resolveNode(nodeId);
  }

  return resolved;
}
