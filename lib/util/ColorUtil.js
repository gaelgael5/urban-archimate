import { rgbaToHex, hexToRgba } from 'hex-and-rgba/esm';
import { assign } from 'min-dash';


import {
  LAYER_APPLICATION, LAYER_BUSINESS, LAYER_MOTIVATION, 
  LAYER_STRATEGY, LAYER_IMP_MIG, 
  LAYER_PHYSICAL, LAYER_TECHNOLOGY, LAYER_OTHER
} from '../metamodel/Concept';

// Conventional colors of the ArchiMate specification figures (archimate-js
// defaults). The specification does not standardize colors; the editor no
// longer draws with these, see NOTATION_DEFAULTS.
export const COLOR_LAYER_STRATEGY = '#F5DEAA', // 'rgba(245, 222, 170, 1)'
  COLOR_LAYER_BUSINESS = '#FFFFB5', // 'rgba(255, 255, 181, 1)' 
  COLOR_LAYER_APPLICATION = '#B5FFFF', // 'rgba(181, 255, 255, 1)' 
  COLOR_LAYER_TECHNOLOGY = '#C9E7B7', // 'rgba(201, 231, 183, 1)' 
  COLOR_LAYER_PHYSICAL = '#C9E7B7', // 'rgba(201, 231, 183, 1)' 
  COLOR_LAYER_IMP_MIG = '#FFE0E0', // 'rgba(255, 224, 224,1)' 
  COLOR_LAYER_MOTIVATION = '#CCCCFF', // 'rgba(204, 204, 255, 1)'
  COLOR_LAYER_OTHER = '#E8E8E8'; 

export const COLOR_LAYER_MAP = new Map([
  [LAYER_STRATEGY, COLOR_LAYER_STRATEGY],
  [LAYER_BUSINESS, COLOR_LAYER_BUSINESS],
  [LAYER_APPLICATION, COLOR_LAYER_APPLICATION],
  [LAYER_TECHNOLOGY, COLOR_LAYER_TECHNOLOGY],
  [LAYER_PHYSICAL, COLOR_LAYER_PHYSICAL],
  [LAYER_IMP_MIG, COLOR_LAYER_IMP_MIG],
  [LAYER_MOTIVATION, COLOR_LAYER_MOTIVATION],
  [LAYER_OTHER, COLOR_LAYER_OTHER]
])

export const BLACK_SHADOW = '#00000066', // 'rgba(0, 0, 0, 0.40)'
  DEFAULT_NOTE_COLOR = '#FFFFFF',
  DEFAULT_CONNECTION_COLOR = '#000000';

export function toHex(rgbaColor) {
  return rgbaColor && rgbaToHex(rgbaColor.r, rgbaColor.g, rgbaColor.b, rgbaColor.a/100 );
}

export function toRgba(hexColor) {
  var color = hexToRgba(hexColor);
  if (color) {
    return {r: color[0], g: color[1], b: color[2], a: color[3]*100};
  } else {
    return false
  }
}

/**
 * Notation palette drawn by the editor, in the style of the diagrams of
 * Ossie Studio (« Cartographe » identity): every element is a white block
 * with a crisp `--border-strong` border, like the nodes of its Application
 * view; the layer is a « line » — a 4px band on the left edge and the
 * pictogram — colored from the RailMap line palette of Ossie (Okabe-Ito,
 * readable by color-blind readers), keeping the hue family of the ArchiMate
 * convention where it can (business orange, application blue, technology
 * green). Relations are slate lines (`--muted`), labels night (`--text`).
 *
 * Same values as the `--ua-notation-*` tokens of
 * assets/urban-archimate-ui.css (checked by test/unit/theme.spec.js): the
 * editor reads the tokens at creation and passes them as
 * `config.archimateNotation`; these defaults apply when no theme is
 * reachable.
 */
export const NOTATION_DEFAULTS = {
  strategie: '#D55E00',
  metier: '#E69F00',
  application: '#0072B2',
  technologie: '#009E73',
  physique: '#009E73',
  implementation: '#CC79A7',
  motivation: '#56B4E9',
  autre: '#4F626E',
  element: '#FFFFFF',
  note: '#FFFFFF',
  trait: '#B4C3CC',
  relation: '#4F626E',
  texte: '#0D1C26',
  fond: '#FFFFFF'
};

/**
 * The notation palette for a given configuration (missing entries take
 * their default), with `couches`: layer → line color (band, pictogram).
 */
export function notationPalette(config) {
  var palette = assign({}, NOTATION_DEFAULTS);

  Object.keys(config || {}).forEach(function(key) {
    if (config[key]) {
      palette[key] = config[key];
    }
  });

  palette.couches = new Map([
    [LAYER_STRATEGY, palette.strategie],
    [LAYER_BUSINESS, palette.metier],
    [LAYER_APPLICATION, palette.application],
    [LAYER_TECHNOLOGY, palette.technologie],
    [LAYER_PHYSICAL, palette.physique],
    [LAYER_IMP_MIG, palette.implementation],
    [LAYER_MOTIVATION, palette.motivation],
    [LAYER_OTHER, palette.autre]
  ]);

  return palette;
}
