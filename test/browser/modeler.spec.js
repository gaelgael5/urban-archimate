import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import Modeler from '../../lib/Modeler.js';

function createContainer() {
  const container = document.createElement('div');
  container.style.width = '1000px';
  container.style.height = '800px';
  document.body.appendChild(container);
  return container;
}

describe('Modeler (smoke)', () => {

  let container, modeler;

  beforeEach(() => {
    container = createContainer();
    modeler = new Modeler({ container });
  });

  afterEach(() => {
    modeler.destroy();
    container.remove();
  });

  it('creates a new model and renders the default view', async () => {
    await modeler.createNewModel();

    const canvas = modeler.get('canvas');
    const root = canvas.getRootElement();

    expect(root).toBeTruthy();

    // the canvas rendered an SVG into our container
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('places two elements and connects them', async () => {
    await modeler.createNewModel();

    const canvas = modeler.get('canvas');
    const elementFactory = modeler.get('elementFactory');
    const modeling = modeler.get('modeling');
    const elementRegistry = modeler.get('elementRegistry');

    const root = canvas.getRootElement();

    const actorShape = elementFactory.createShape({ type: 'BusinessActor' });
    const createdActor = modeling.createShape(
      actorShape, { x: 200, y: 150 }, root);

    const processShape = elementFactory.createShape({ type: 'BusinessProcess' });
    const createdProcess = modeling.createShape(
      processShape, { x: 500, y: 150 }, root);

    expect(createdActor).toBeTruthy();
    expect(createdProcess).toBeTruthy();

    const connection = modeling.connect(
      createdActor, createdProcess, { type: 'Assignment' });

    expect(connection).toBeTruthy();

    // both shapes and the connection are in the registry
    expect(elementRegistry.get(createdActor.id)).toBe(createdActor);
    expect(elementRegistry.get(createdProcess.id)).toBe(createdProcess);
    expect(elementRegistry.get(connection.id)).toBe(connection);

    // and both shapes got rendered into the SVG
    const gfxActor = elementRegistry.getGraphics(createdActor);
    const gfxProcess = elementRegistry.getGraphics(createdProcess);
    expect(gfxActor).toBeTruthy();
    expect(gfxProcess).toBeTruthy();
  });

  it('round-trips the model through saveXML / importXML', async () => {
    await modeler.createNewModel();

    const canvas = modeler.get('canvas');
    const elementFactory = modeler.get('elementFactory');
    const modeling = modeler.get('modeling');

    const root = canvas.getRootElement();

    const actor = modeling.createShape(
      elementFactory.createShape({ type: 'BusinessActor' }),
      { x: 200, y: 150 }, root);
    const process = modeling.createShape(
      elementFactory.createShape({ type: 'BusinessProcess' }),
      { x: 500, y: 150 }, root);
    modeling.connect(actor, process, { type: 'Assignment' });

    const { xml } = await modeler.saveXML({ format: true });

    expect(xml).toContain('BusinessActor');
    expect(xml).toContain('BusinessProcess');
    expect(xml).toContain('Assignment');

    // reimport into a fresh modeler
    const container2 = createContainer();
    const modeler2 = new Modeler({ container: container2 });

    try {
      await modeler2.importXML(xml);

      const registry2 = modeler2.get('elementRegistry');
      const all = registry2.getAll();

      // root + 2 shapes + 1 connection at least
      expect(all.length).toBeGreaterThanOrEqual(4);
    } finally {
      modeler2.destroy();
      container2.remove();
    }
  });
});
