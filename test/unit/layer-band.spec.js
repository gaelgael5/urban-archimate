import { describe, it, expect } from 'vitest';

import { layerBandPath } from '../../lib/draw/ArchimateRenderer.js';

describe('bande de couche', () => {

  it('élément à angles vifs : bande rectangulaire sur toute la hauteur', () => {
    expect(layerBandPath(60, 0, 4)).toBe('M 4 0 H 0 V 60 H 4 Z');
  });

  it('élément arrondi : la bande épouse les deux arrondis', () => {
    const d = layerBandPath(60, 10, 4);

    // part du point de l'arrondi haut à x = 4 (y = 10 - √(100 - 36) = 2),
    // suit l'arc jusqu'au bord, descend droit, suit l'arc du bas
    expect(d).toBe('M 4 2 A 10 10 0 0 0 0 10 V 50 A 10 10 0 0 0 4 58 Z');
  });
});
