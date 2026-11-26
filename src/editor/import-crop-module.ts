/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * At import time the connections are built from node centers (the
 * saved graphics only keep the intermediate bendpoints). This module
 * crops both ends on the real shape outline — the standard diagram-js
 * docking — so arrows start and stop at the border of the blocks
 * instead of running under them. Registered in the modeler AND the
 * read-only viewer (which has no modeling module, hence no docking).
 */

import CroppingConnectionDocking from 'diagram-js/lib/layout/CroppingConnectionDocking.js';

function UaImportCrop(
    this: any,
    eventBus: any,
    connectionDocking: any,
    graphicsFactory: any,
    elementRegistry: any
) {

  // fired by the importer once a connection and both its shapes exist
  eventBus.on('elementRef.added', (event: any) => {
    const connection = event.element;

    if (!connection.waypoints || !connection.source || !connection.target) {
      return;
    }

    connection.waypoints = connectionDocking.getCroppedWaypoints(connection);

    const gfx = elementRegistry.getGraphics(connection);

    if (gfx) {
      graphicsFactory.update('connection', connection, gfx);
    }
  });
}

UaImportCrop.$inject = [
  'eventBus',
  'connectionDocking',
  'graphicsFactory',
  'elementRegistry'
];

export default {
  __init__: [ 'uaImportCrop' ],
  connectionDocking: [ 'type', CroppingConnectionDocking ],
  uaImportCrop: [ 'type', UaImportCrop ]
};
