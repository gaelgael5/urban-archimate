import inherits from 'inherits-browser';

import { notationPalette } from '../util/ColorUtil';
import {
  isObject,
  assign
} from 'min-dash';

import {
  query as domQuery
} from 'min-dom';

import {
  append as svgAppend,
  attr as svgAttr,
  create as svgCreate,
  classes as svgClasses
} from 'tiny-svg';

import BaseRenderer from 'diagram-js/lib/draw/BaseRenderer';

import {
  getLabel
} from '../features/label-editing/LabelUtil';

import {
  is,
  isAny,
  getPictoRef,
  getFigureRef,
  NOTE,
  CONTAINER,
  JUNCTION_AND,
  JUNCTION_OR,
} from '../util/ModelUtil';

import { ARCHIMATE_CONNECTION, ARCHIMATE_NODE } from '../metamodel/Concept';

import {
  getRectPath,
  BORDER_ASPECT_MAP,
} from './ArchimateRendererUtil';

import { Ids } from 'ids';

var RENDERER_IDS = new Ids();

import { logger } from "../util/Logger";
import { createLine } from 'diagram-js/lib/util/RenderUtil';
import { RELATIONSHIP_ACCESS_READ, RELATIONSHIP_ACCESS_READWRITE, RELATIONSHIP_ACCESS_WRITE } from '../metamodel/Concept';

export const DEFAULT_NOTE_COLOR_RGBA = {r: '255', g: '255', b: '255', a: '100'};

// stroke, text and blank colors come from the notation palette (inside
// ArchimateRenderer)
const DEFAULT_STROKE_WIDTH = 1,
  DEFAULT_FILL_COLOR = 'grey',
  // border of an element block and width of its layer band
  NODE_STROKE_WIDTH = 1.2,
  LAYER_BAND_WIDTH = 4;

export default function ArchimateRenderer(
    config, eventBus, styles, pathMap,
    canvas, textRenderer, notationConfig, priority) {

  BaseRenderer.call(this, eventBus, priority);

  // colors of the notation strokes, labels and hollow marks: the theme
  // notation palette
  var notation = notationPalette(notationConfig);
  var DEFAULT_STROKE_COLOR = notation.relation,
    DEFAULT_TEXT_COLOR = notation.texte,
    DEFAULT_LINE_COLOR = notation.trait,
    DEFAULT_BLANK_COLOR = notation.fond;

  var computeStyle = styles.computeStyle;

  // markers //////////

  var markers = {};

  var rendererId = RENDERER_IDS.next();

  function marker(type, color) {
    var id = type + '-' + color + '-' + rendererId;

    if (!markers[id]) {
      createMarker(id, type, color);
    }

    return 'url(#' + id + ')';
  }

  function addMarker(id, options) {
    var attrs = assign({
      strokeWidth: DEFAULT_STROKE_WIDTH,
      strokeLinecap: 'round',
      strokeDasharray: 'none'
    }, options.attrs);

    var ref = options.ref || { x: 0, y: 0 };

    var scale = options.scale || 1;

    // fix for safari / chrome / firefox bug not correctly
    // resetting stroke dash array
    if (attrs.strokeDasharray === 'none') {
      attrs.strokeDasharray = [ 10000, 1 ];
    }

    var marker = svgCreate('marker');

    svgAttr(options.element, attrs);

    svgAppend(marker, options.element);

    svgAttr(marker, {
      id: id,
      viewBox: '0 0 20 20',
      refX: ref.x,
      refY: ref.y,
      markerWidth: 20 * scale,
      markerHeight: 20 * scale,
      orient: 'auto'
    });

    var defs = domQuery('defs', canvas._svg);

    if (!defs) {
      defs = svgCreate('defs');
      svgAppend(canvas._svg, defs);
    }

    svgAppend(defs, marker);

    markers[id] = marker;
  }

  function createMarker(id, type, color) {

    if (type === 'diamond-filled-start') {
      var associationStart = svgCreate('path');
      svgAttr(associationStart, { d: 'M 10 5 L 0 10 L 10 15 L 20 10 Z' });

      addMarker(id, {
        element: associationStart,
        attrs: {
          fill: color,
          stroke: color,
          strokeWidth: 1.5
        },
        ref: { x: -1, y: 10 },
        scale: 0.9
      });
    } else if (type === 'diamond-blank-start') {
      associationStart = svgCreate('path');
      svgAttr(associationStart, { d: 'M 10 5 L 0 10 L 10 15 L 20 10 Z' }); //M 11 5 L 1 10 L 11 15 L 21 10 Z

      addMarker(id, {
        element: associationStart,
        attrs: {
          fill: DEFAULT_BLANK_COLOR,
          stroke: color,
          strokeWidth: 1.5
        },
        ref: { x: -1, y: 10 },
        scale: 0.9
      });
    } else if (type === 'opened-start') {
      associationStart = svgCreate('path');
      svgAttr(associationStart, { d: 'M 11 5 L 1 10 L 11 15' });

      addMarker(id, {
        element: associationStart,
        attrs: {
          fill: 'none',
          stroke: color,
          strokeWidth: 1.5
        },
        ref: { x: 0, y: 10 },
        scale: 0.9
      });
    } else if (type === 'opened-end') {
      var openedEnd = svgCreate('path');
      svgAttr(openedEnd, { d: 'M 1 5 L 11 10 L 1 15' });

      addMarker(id, {
        element: openedEnd,
        attrs: {
          fill: 'none',
          stroke: color,
          strokeWidth: 1.5
        },
        ref: { x: 12, y: 10 },
        scale: 0.9
      });
    } else if (type === 'half-opened-end') {
      openedEnd = svgCreate('path');
      svgAttr(openedEnd, { d: 'M 1 5 L 11 10' });

      addMarker(id, {
        element: openedEnd,
        attrs: {
          fill: 'none',
          stroke: color,
          strokeWidth: 1.5
        },
        ref: { x: 12, y: 10 },
        scale: 0.9
      });
    } else if (type === 'closed-filled-end') {
      var closedFilledEnd = svgCreate('path');
      svgAttr(closedFilledEnd, { d: 'M 1 5 L 11 10 L 1 15 Z' }); // larger arrowhead { d: 'M 1 3 L 11 10 L 1 17' });

      addMarker(id, {
        element: closedFilledEnd,
        attrs: {
          fill: color,
          stroke: 'none'
        },
        ref: { x: 11, y: 10 },
        scale: 1
      });
    } else if (type === 'closed-blank-end') {
      var closedBlankEnd = svgCreate('path');
      svgAttr(closedBlankEnd, { d: 'M 1 5 L 11 10 L 1 15 Z' });

      addMarker(id, {
        element: closedBlankEnd,
        attrs: {
          fill: DEFAULT_BLANK_COLOR,
          stroke: color,
        },
        ref: { x: 11, y: 10 },
        scale: 1
      });
    } else if (type === 'dot-start') {
      var dotEnd = svgCreate('circle');
      svgAttr(dotEnd, { cx: 3, cy: 3, r: 3 });

      addMarker(id, {
        element: dotEnd,
        attrs: {
          fill: color,
          stroke: 'none'
        },
        ref: { x: 0, y: 3 },
        scale: 1
      });
    }
  }

  function drawCircle(parentGfx, width, height, offset, attrs) {

    if (isObject(offset)) {
      attrs = offset;
      offset = 0;
    }

    offset = offset || 0;

    attrs = computeStyle(attrs, {
      stroke: DEFAULT_STROKE_COLOR,
      strokeWidth: DEFAULT_STROKE_WIDTH,
      fill: DEFAULT_FILL_COLOR
    });

    if (attrs.fill === 'none') {
      delete attrs.fillOpacity;
    }

    var cx = width / 2,
        cy = height / 2;

    var circle = svgCreate('circle');
    svgAttr(circle, {
      cx: cx,
      cy: cy,
      r: Math.round((width + height) / 4 - offset)
    });
    svgAttr(circle, attrs);

    svgAppend(parentGfx, circle);

    return circle;
  }

  function drawRect(parentGfx, width, height, r, offset, attrs) {

    if (isObject(offset)) {
      attrs = offset;
      offset = 0;
    }

    offset = offset || 0;

    attrs = computeStyle(attrs, {
      stroke: DEFAULT_STROKE_COLOR,
      strokeWidth: DEFAULT_STROKE_WIDTH,
      fill: DEFAULT_FILL_COLOR
    });

    var rect = svgCreate('rect');
    svgAttr(rect, {
      x: offset,
      y: offset,
      width: width - offset * 2,
      height: height - offset * 2,
      rx: r,
      ry: r
    });
    svgAttr(rect, attrs);

    svgAppend(parentGfx, rect);

    return rect;
  }

  function drawLine(p, waypoints, attrs) {

    var newAttrs = computeStyle(attrs, [ 'no-fill' ], {
      stroke: DEFAULT_STROKE_COLOR,
      strokeWidth: DEFAULT_STROKE_WIDTH,
      fill: DEFAULT_FILL_COLOR
    });

    var line = createLine(waypoints, newAttrs);

    svgAppend(p, line);

    return line;
  }

  function drawPath(parentGfx, d, attrs) {
    attrs = computeStyle(attrs, [ 'no-fill' ], {
      strokeWidth: DEFAULT_STROKE_WIDTH,
      stroke: DEFAULT_STROKE_COLOR
    });

    var path = svgCreate('path');
    svgAttr(path, { d: d });
    svgAttr(path, attrs);

    svgAppend(parentGfx, path);

    return path;
  }


  function renderLabel(parentGfx, label, options) {

    options = assign({
      size: {
        width: 100
      }
    }, options);

    var text = textRenderer.createText(label || '', options);

    svgClasses(text).add('djs-label');

    svgAppend(parentGfx, text);

    return text;
  }

  function renderEmbeddedLabel(parentGfx, element, align, fontWeight, fontSize) {

    var newBox = { height: element.height, width: element.width };

    return renderLabel(parentGfx, getLabel(element), {
      box: element, //newBox,
      align: align,
      padding: 5,
      style: {
        fill: DEFAULT_TEXT_COLOR,
        // fontSize: fontSize // || DEFAULT_TEXT_SIZE
        // semibold, like the node titles of Ossie Studio diagrams
        fontWeight: fontWeight == 'bold' ? '700' : '600'
      },
    });
  }

  function renderExternalLabel(parentGfx, element) {

    var box = {
      width: 90,
      height: 30,
      x: element.width / 2 + element.x,
      y: element.height / 2 + element.y
    };

    return renderLabel(parentGfx, getLabel(element), {
      box: box,
      fitBox: true,
      style: assign(
        {},
        textRenderer.getExternalStyle(),
        {
          fill: DEFAULT_TEXT_COLOR
        }
      )
    });
  }

  function renderArchimateConnection(parentGfx, connection, attrs) {
    attrs = assign({
          stroke: connection.style.lineColor,
          strokeLinecap: 'none', //'round',
          strokeLinejoin: 'round',
          fill: 'none'
        }, attrs);

    return drawLine(parentGfx, connection.waypoints, attrs);
  }


  function renderArchimateShape(parentGfx, shape) {
    logger.log({ parentGfx, shape });

    var elementType = shape.type,
      // the layer is drawn as a « line » color (Ossie Studio RailMap palette)
      lineColor = notation.couches.get(shape.layer),
      borderRadius = BORDER_ASPECT_MAP.get(shape.aspect);

    // a white block with a crisp border, like the diagram nodes of Ossie
    // Studio (raw-app-block / raw-graph-node)
    var attrs = {
      fill: shape.style.fillColor,
      stroke: shape.style.lineColor,
      strokeWidth: NODE_STROKE_WIDTH
    };

    var figure = drawRect(parentGfx, shape.width, shape.height, borderRadius, attrs);

    // the layer band: the left strip of the block, LAYER_BAND_WIDTH wide,
    // straight along the edge and following the rounded corners of a
    // behavior element (filled region of the rounded rectangle with x ≤ band)
    if (lineColor) {
      var band = svgCreate('path');

      svgAttr(band, {
        d: layerBandPath(shape.height, borderRadius || 0, LAYER_BAND_WIDTH),
        fill: lineColor,
        stroke: 'none'
      });
      svgClasses(band).add('ua-bande-couche');
      svgAppend(parentGfx, band);
    }

    var align = shape.style.textAlignment+'-'+shape.style.textPosition, // || 'center-middle',
      fontWeight = shape.style.fontStyle;

    renderEmbeddedLabel(parentGfx, shape, align, fontWeight);

    var pictoRef = getPictoRef(elementType);

    // an element without a pictogram still renders (shape + label)
    if (pictoRef && pathMap.pathMap[pictoRef]) {
      var pathData = pathMap.getScaledPath(pictoRef, {
        xScaleFactor: 1,
        yScaleFactor: 1,
        containerWidth: shape.width,
        containerHeight: shape.height,
        position: {
          mx: ((shape.width - 22) / shape.width),
          my: ((2) /shape.height)
        }
      });

      // the pictogram takes the line color of its layer
      drawPath(parentGfx, pathData, {
        strokeWidth: 1,
        fill: shape.style.fillColor,
        stroke: lineColor || DEFAULT_STROKE_COLOR
      });
    }

    return figure;
  }

  function renderJunction(parentGfx, shape) {

    var circle = svgCreate('circle');
    var radius = Math.min(shape.width, shape.height) / 2;

    svgAttr(circle, {
      cx: shape.width / 2,
      cy: shape.height / 2,
      r: Math.max(radius - 1, 2),
      stroke: shape.style.lineColor || DEFAULT_LINE_COLOR,
      strokeWidth: DEFAULT_STROKE_WIDTH,

      // And junction: filled; Or junction: open
      fill: shape.type === JUNCTION_OR ? DEFAULT_BLANK_COLOR : (shape.style.lineColor || DEFAULT_LINE_COLOR)
    });

    svgAppend(parentGfx, circle);

    return circle;
  }

  function renderContainer(parentGfx, shape) {

    var figure = drawRect(parentGfx, shape.width, shape.height, 0, {
      stroke: shape.style.lineColor || DEFAULT_LINE_COLOR,
      strokeWidth: 1,
      strokeDasharray: '6,3',
      fill: 'none',
      pointerEvents: 'none'
    });

    renderEmbeddedLabel(
      parentGfx, shape, 'left-top', shape.style.fontStyle);

    return figure;
  }

  this.handlers = {
    'archimate:Node': function(parentGfx, shape) {

      if (shape.type === JUNCTION_AND || shape.type === JUNCTION_OR) {
        return renderJunction(parentGfx, shape);
      }

      if (shape.type === CONTAINER) {
        return renderContainer(parentGfx, shape);
      }

      if (shape.type === NOTE) {
        logger.log(shape);

        var figureRef = getFigureRef(NOTE);
  
        var pathData = pathMap.getScaledPath(figureRef, {
          xScaleFactor: 1,
          yScaleFactor: 1,
          containerWidth: shape.width,
          containerHeight: shape.height,
          position: {
            mx: 0.0,
            my: 0.0
          }
        });
  
        var figure = drawPath(parentGfx, pathData, {
          strokeWidth: DEFAULT_STROKE_WIDTH,
          fill: shape.style.fillColor,
          stroke: shape.style.lineColor
        });
  
        var align = shape.style.textAlignment+'-'+shape.style.textPosition, // || 'left-top',
        fontWeight = shape.style.fontStyle;
  
        renderEmbeddedLabel(parentGfx, shape, align, fontWeight);
    
        return figure;

      } else {

        return renderArchimateShape(parentGfx, shape);
      }
    },

    'archimate:Group': function(parentGfx, element) {
      logger.log(element);

      var figure = drawRect(parentGfx, element.width, element.height, 0, {
        stroke: DEFAULT_LINE_COLOR,
        strokeWidth: 1,
        strokeDasharray: '3,3',
        fill: 'none',
        pointerEvents: 'none'
      });

      var align = element.style.textAlignment+'-'+element.style.textPosition, // || 'center-middle',
      fontWeight = element.style.fontStyle;

      renderEmbeddedLabel(parentGfx, element, align, fontWeight);

      return figure;
    },

    'label': function(parentGfx, element) {
      logger.log(element);
     
      return renderExternalLabel(parentGfx, element);
    },

    'Line': function(parentGfx, connection) {
      var attrs = {
            strokeDasharray: '9,3,3,3',//'20,5,5,5,5,5',
            // stroke: toRgbaString(BLACK_SHADOW_RGBA)
          };

      return renderArchimateConnection(parentGfx, connection, attrs);
    },

    'Access': function(parentGfx, connection) {
      var color = connection.style.lineColor;
      var attrs = {
            strokeDasharray: '2, 2',
          };

      if (connection.typeOption === RELATIONSHIP_ACCESS_WRITE || 
          connection.typeOption === RELATIONSHIP_ACCESS_READWRITE) {
        attrs.markerEnd = marker('opened-end', color);
      }

      if (connection.typeOption === RELATIONSHIP_ACCESS_READ || 
          connection.typeOption === RELATIONSHIP_ACCESS_READWRITE) {
        attrs.markerStart = marker('opened-start', color);
      }

      return renderArchimateConnection(parentGfx, connection, attrs);
    },

    'Aggregation': function(parentGfx, connection) {
      var color = connection.style.lineColor;
      var attrs = {
            markerStart: marker('diamond-blank-start', color)
          };

      return renderArchimateConnection(parentGfx, connection, attrs);
    },

    'Assignment': function(parentGfx, connection) {
      var color = connection.style.lineColor;
      var attrs = {
            markerStart: marker('dot-start', color),
            markerEnd: marker('closed-filled-end', color)
          };

      return renderArchimateConnection(parentGfx, connection, attrs);
    },

    'Association': function(parentGfx, connection) {
      var color = connection.style.lineColor;
      var attrs = {};

      if (connection.typeOption) {
        attrs.markerEnd = marker('half-opened-end', color);
      }

      return renderArchimateConnection(parentGfx, connection, attrs);
    },

    'Composition': function(parentGfx, connection) {
      var color = connection.style.lineColor;
      var attrs = {
            markerStart: marker('diamond-filled-start', color)
          };

      return renderArchimateConnection(parentGfx, connection, attrs);
    },

    'Flow': function(parentGfx, connection) {
      var color = connection.style.lineColor;
      var attrs = {
            strokeDasharray: '6, 3',
            markerEnd: marker('closed-filled-end', color)
          };

      return renderArchimateConnection(parentGfx, connection, attrs);
    },

    'Influence': function(parentGfx, connection) {
      var color = connection.style.lineColor;
      var attrs = {
            strokeDasharray: '6, 3',
            markerEnd: marker('opened-end', color)
          };

      // TODO vbo add modifier management
      // connection.typeOption
      
      return renderArchimateConnection(parentGfx, connection, attrs);
    },

    'Realization': function(parentGfx, connection) {
      var color = connection.style.lineColor;
      var attrs = {
            strokeDasharray: '2, 2',
            markerEnd: marker('closed-blank-end', color)
          };

      return renderArchimateConnection(parentGfx, connection, attrs);
    },

    'Serving': function(parentGfx, connection) {
      var color = connection.style.lineColor;
      var attrs = {
            markerEnd: marker('opened-end', color)
          };

      return renderArchimateConnection(parentGfx, connection, attrs);
    },

    'Specialization': function(parentGfx, connection) {
      var color = connection.style.lineColor;
      var attrs = {
            markerEnd: marker('closed-blank-end', color)
          };

      return renderArchimateConnection(parentGfx, connection, attrs);
    },

    'Triggering': function(parentGfx, connection) {
      var color = connection.style.lineColor;
      var attrs = {
            markerEnd: marker('closed-filled-end', color)
          };

      return renderArchimateConnection(parentGfx, connection, attrs);
    },

  };

  // extension API, use at your own risk
  this._drawPath = drawPath;

}


inherits(ArchimateRenderer, BaseRenderer);

ArchimateRenderer.$inject = [
  'config.archimateRenderer',
  'eventBus',
  'styles',
  'pathMap',
  'canvas',
  'textRenderer',
  'config.archimateNotation'
];


ArchimateRenderer.prototype.canRender = function(element) {

  return isAny(element.businessObject, [ARCHIMATE_NODE, ARCHIMATE_CONNECTION]);
};

ArchimateRenderer.prototype.drawConnection = function(parentGfx, element) {
  var type = element.type;
  var h = this.handlers[type];

  if (!h) {
    return BaseRenderer.prototype.drawConnection.apply(this, [ parentGfx, element ]);
  } else {
    return h(parentGfx, element);
  }
};

ArchimateRenderer.prototype.drawShape = function(parentGfx, element) {
  var type;

  if (is(element.businessObject, ARCHIMATE_NODE)) {
    type = ARCHIMATE_NODE;
  } else {
    type = element.type;
  }

  var h = this.handlers[type];
  return h(parentGfx, element);
};

ArchimateRenderer.prototype.getShapePath = function(element) {

  return getRectPath(element);
};


/**
 * Outline of the layer band: the part of a rounded rectangle (left edge at
 * x = 0, corner radius `radius`) lying left of x = `width`. Its outer edge
 * is the block's own edge — straight in the middle, an arc in each corner —
 * so the band hugs the rounded corners instead of stopping short of them.
 */
export function layerBandPath(height, radius, width) {
  if (!radius) {
    return 'M ' + width + ' 0 H 0 V ' + height + ' H ' + width + ' Z';
  }

  var r = Math.min(radius, height / 2),
    b = Math.min(width, r),
    // height of the corner arc above y = r at x = b
    y = r - Math.sqrt(r * r - (r - b) * (r - b));

  return [
    'M', b, y,
    'A', r, r, 0, 0, 0, 0, r,
    'V', height - r,
    'A', r, r, 0, 0, 0, b, height - y,
    'Z'
  ].join(' ');
}

