/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Editing surface of the component:
 *
 * - a minimal context pad: start a connection, remove from the view
 *   (the object itself is never deleted — it belongs to the host);
 * - the connect gesture is intercepted: the relation types between
 *   two objects come from the host (allowedRelations delegate), the
 *   component holds no relationship table;
 * - reconnecting a relation to another object is refused (anchors and
 *   waypoints move freely along the same objects).
 */

import inherits from 'inherits-browser';

import ContextPadModule from 'diagram-js/lib/features/context-pad/index.js';
import RuleProvider from 'diagram-js/lib/features/rules/RuleProvider.js';

/** Set by the editor facade: receives (sourceShape, targetShape). */
export interface ConnectRequestHandler {
  (source: any, target: any): void;
}

function UaContextPadProvider(
    this: any,
    contextPad: any,
    connect: any,
    modeling: any,
    translate: any
) {
  this._connect = connect;
  this._modeling = modeling;
  this._translate = translate;

  contextPad.registerProvider(this);
}

UaContextPadProvider.$inject = [
  'contextPad',
  'connect',
  'modeling',
  'translate'
];

UaContextPadProvider.prototype.getContextPadEntries = function(element: any) {
  const connect = this._connect;
  const modeling = this._modeling;
  const translate = this._translate;

  const entries: Record<string, unknown> = {};

  const businessObject = element.businessObject || {};

  const isHostNode = businessObject.hostKey !== undefined &&
    businessObject.hostConnexionId === undefined;

  if (isHostNode) {
    entries[ 'connect' ] = {
      group: 'edit',
      className: 'ua-pad-relier',
      title: translate('Relier à un autre objet'),
      action: {
        click: (event: any) => connect.start(event, element),
        dragstart: (event: any) => connect.start(event, element)
      }
    };
  }

  if (element.type !== 'root' && element.type !== 'label') {
    entries[ 'remove' ] = {
      group: 'edit',
      className: 'ua-pad-retirer',
      title: translate('Retirer de la vue'),
      action: {
        click: () => modeling.removeElements([ element ])
      }
    };
  }

  return entries;
};

/**
 * Intercepts the end of the connect gesture between two host objects:
 * the default behavior (free relation creation) is preempted and the
 * request is handed to the editor facade, which asks the host.
 */
function UaConnectBehavior(this: any, eventBus: any) {
  this._handler = null;

  const self = this;

  // priority above the default connect.end listener (1000)
  eventBus.on('connect.end', 1250, function(event: any) {
    const context = event.context,
        source = context.source,
        target = context.target;

    if (!context.canExecute || !source || !target) {
      return;
    }

    const sourceKey = source.businessObject && source.businessObject.hostKey;
    const targetKey = target.businessObject && target.businessObject.hostKey;

    const sourceIsNode = sourceKey !== undefined &&
      source.businessObject.hostConnexionId === undefined;
    const targetIsNode = targetKey !== undefined &&
      target.businessObject.hostConnexionId === undefined;

    if (sourceIsNode && targetIsNode && self._handler) {
      self._handler(source, target);

      // preempt the default free connection creation
      return false;
    }

    // anything else (notes, frames, ...) keeps the default behavior
  });
}

UaConnectBehavior.$inject = [ 'eventBus' ];

UaConnectBehavior.prototype.setHandler = function(handler: ConnectRequestHandler) {
  this._handler = handler;
};

/**
 * The relationship rules come from the host: without its agreement a
 * relation cannot be rerouted to another object. Moving anchors and
 * waypoints along the same objects stays free.
 */
function UaReconnectRule(this: any, eventBus: any) {
  (RuleProvider as any).call(this, eventBus);
}

inherits(UaReconnectRule, RuleProvider as any);

UaReconnectRule.prototype.init = function(this: any) {
  // higher priority than ArchimateRules' own rule
  this.addRule('connection.reconnect', 2000, (context: any) => {
    const connection = context.connection,
        source = context.source,
        target = context.target;

    if (!connection || !connection.businessObject) {
      return;
    }

    // a host relation keeps its two objects
    if (connection.businessObject.hostKey !== undefined) {
      const sameSource = connection.source &&
        source &&
        connection.source.businessObject === source.businessObject;
      const sameTarget = connection.target &&
        target &&
        connection.target.businessObject === target.businessObject;

      return sameSource && sameTarget ? { type: connection.type } : false;
    }
  });
};

UaReconnectRule.$inject = [ 'eventBus' ];

export default {
  __depends__: [ ContextPadModule ],
  __init__: [ 'uaContextPadProvider', 'uaConnectBehavior', 'uaReconnectRule' ],
  uaContextPadProvider: [ 'type', UaContextPadProvider ],
  uaConnectBehavior: [ 'type', UaConnectBehavior ],
  uaReconnectRule: [ 'type', UaReconnectRule ]
};
