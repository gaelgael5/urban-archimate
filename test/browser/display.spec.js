import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { UrbanArchimateEditor } from '../../src/editor/UrbanArchimateEditor.ts';

import tousElementsYaml from '../../examples/tous-elements/modele-hydrate.yaml?raw';

function createContainer() {
  const container = document.createElement('div');
  container.style.width = '1200px';
  container.style.height = '900px';
  document.body.appendChild(container);
  return container;
}

describe('affichage — toutes les vues ArchiMate 3.2', () => {

  let container, editor;

  beforeEach(() => {
    container = createContainer();
  });

  afterEach(() => {
    if (editor) {
      editor.destroy();
      editor = null;
    }
    container.remove();
  });

  it('affiche un élément de chaque type 3.2, toutes couches (critère 1)', async () => {
    editor = new UrbanArchimateEditor({ container });

    const { warnings } = await editor.load(tousElementsYaml);
    expect(warnings).toEqual([]);

    const registry = editor.getDiagram().get('elementRegistry');

    const expectedTypes = [
      // stratégie
      'Resource', 'Capability', 'ValueStream', 'CourseOfAction',
      // métier
      'BusinessActor', 'BusinessRole', 'BusinessCollaboration',
      'BusinessInterface', 'BusinessProcess', 'BusinessFunction',
      'BusinessInteraction', 'BusinessEvent', 'BusinessService',
      'BusinessObject', 'Contract', 'Representation', 'Product',
      // application
      'ApplicationComponent', 'ApplicationCollaboration',
      'ApplicationInterface', 'ApplicationFunction',
      'ApplicationInteraction', 'ApplicationProcess', 'ApplicationEvent',
      'ApplicationService', 'DataObject',
      // technologie
      'Node', 'Device', 'SystemSoftware', 'TechnologyCollaboration',
      'TechnologyInterface', 'Path', 'CommunicationNetwork',
      'TechnologyFunction', 'TechnologyProcess', 'TechnologyInteraction',
      'TechnologyEvent', 'TechnologyService', 'Artifact',
      // physique
      'DistributionNetwork', 'Equipment', 'Facility', 'Material',
      // motivation
      'Stakeholder', 'Driver', 'Assessment', 'Goal', 'Outcome',
      'Principle', 'Requirement', 'Constraint', 'Meaning', 'Value',
      // mise en œuvre et migration
      'WorkPackage', 'Deliverable', 'ImplementationEvent', 'Plateau', 'Gap',
      // composites
      'Grouping', 'Location',
      // jonctions
      'AndJunction', 'OrJunction'
    ];

    for (const type of expectedTypes) {
      const shape = registry.get(`n-VUE-TOUS-ELEMENTS-N-${ type.toUpperCase() }`);
      expect(shape, `élément ${ type } absent`).toBeTruthy();
      expect(shape.type).toBe(type);
      expect(
        registry.getGraphics(shape),
        `élément ${ type } non rendu`
      ).toBeTruthy();
    }
  });

  it('affiche chaque type de relation, jonction comprise (critère 2)', async () => {
    editor = new UrbanArchimateEditor({ container });
    await editor.load(tousElementsYaml);

    const registry = editor.getDiagram().get('elementRegistry');

    const relationTypes = [
      'Composition', 'Aggregation', 'Assignment', 'Realization',
      'Serving', 'Access', 'Influence', 'Triggering', 'Flow',
      'Specialization', 'Association'
    ];

    for (const type of relationTypes) {
      const connection = registry.get(
        `c-VUE-TOUS-ELEMENTS-C-${ type.toUpperCase() }`);
      expect(connection, `relation ${ type } absente`).toBeTruthy();
      expect(connection.type).toBe(type);
      expect(registry.getGraphics(connection)).toBeTruthy();
    }

    // la jonction : un cercle, relié de part et d'autre
    const junction = registry.get('n-VUE-TOUS-ELEMENTS-N-J-AND');
    expect(junction).toBeTruthy();
    expect(junction.type).toBe('AndJunction');

    const gfx = registry.getGraphics(junction);
    expect(gfx.querySelector('circle')).toBeTruthy();

    for (const id of [ 'C-J-1', 'C-J-2', 'C-J-3' ]) {
      expect(registry.get(`c-VUE-TOUS-ELEMENTS-${ id }`)).toBeTruthy();
    }
  });

  it('les connexions chargées s\'arrêtent au bord des formes, pas à leur centre', async () => {
    editor = new UrbanArchimateEditor({ container });
    await editor.load(tousElementsYaml);

    const registry = editor.getDiagram().get('elementRegistry');
    const connections = registry.filter(
      (element) => element.waypoints && element.source && element.target);

    expect(connections.length).toBeGreaterThan(0);

    const distance = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);
    const centerOf = (shape) => ({
      x: shape.x + shape.width / 2, y: shape.y + shape.height / 2
    });

    for (const connection of connections) {
      const premier = connection.waypoints[0];
      const dernier = connection.waypoints[connection.waypoints.length - 1];

      // un ancrage croppé est posé sur le contour, jamais au centre
      expect(distance(premier, centerOf(connection.source)), connection.id)
        .toBeGreaterThan(5);
      expect(distance(dernier, centerOf(connection.target)), connection.id)
        .toBeGreaterThan(5);
    }
  });

  it('note et cadre de regroupement s\'affichent', async () => {
    editor = new UrbanArchimateEditor({ container });
    await editor.load(tousElementsYaml);

    const registry = editor.getDiagram().get('elementRegistry');

    const note = registry.get('n-VUE-TOUS-ELEMENTS-N-NOTE');
    expect(note).toBeTruthy();
    expect(note.type).toBe('Label');

    const cadre = registry.get('n-VUE-TOUS-ELEMENTS-N-CADRE');
    expect(cadre).toBeTruthy();
    expect(cadre.type).toBe('Container');
    expect(cadre.name).toBe('Cadre de regroupement');
    expect(registry.getGraphics(cadre)).toBeTruthy();
  });

  it('un nœud positionné relativement suit son parent quand celui-ci bouge (critère 3)', async () => {
    editor = new UrbanArchimateEditor({ container });
    await editor.load(tousElementsYaml);

    const diagram = editor.getDiagram();
    const registry = diagram.get('elementRegistry');
    const modeling = diagram.get('modeling');

    const parent = registry.get('n-VUE-TOUS-ELEMENTS-N-IMBRIQUE-PARENT');
    const enfant = registry.get('n-VUE-TOUS-ELEMENTS-N-IMBRIQUE-ENFANT');

    const avant = { x: enfant.x, y: enfant.y };

    modeling.moveElements([ parent ], { x: 30, y: 40 });

    expect(enfant.x).toBe(avant.x + 30);
    expect(enfant.y).toBe(avant.y + 40);
  });

  it('zoom, ajustement à la fenêtre et déplacement de la vue', async () => {
    editor = new UrbanArchimateEditor({ container });
    await editor.load(tousElementsYaml);

    const canvas = editor.getDiagram().get('canvas');

    canvas.zoom('fit-viewport');
    expect(canvas.zoom()).toBeGreaterThan(0);

    canvas.zoom(1.5);
    expect(canvas.zoom()).toBeCloseTo(1.5);

    const before = canvas.viewbox();
    canvas.scroll({ dx: 100, dy: 50 });
    const after = canvas.viewbox();
    expect(after.x).not.toBe(before.x);
  });

  it('une vue de 200 éléments s\'affiche et se déplace sans ralentissement visible (critère 4)', async () => {
    const documents = [];
    const elements = [];
    const noeuds = [];
    const geometries = {};

    for (let i = 0; i < 200; i++) {
      const cle = `EL-PERF-${ i }`;
      documents.push({
        chemin: `objets/application/el-perf-${ i }.yaml`,
        data: { cle, type: 'ApplicationComponent', nom: `Composant ${ i }` }
      });
      elements.push(cle);
      noeuds.push({ id: `N${ i }`, element: cle });
      geometries[ `N${ i }` ] = {
        x: 40 + (i % 14) * 170,
        y: 40 + Math.floor(i / 14) * 90,
        l: 150, h: 60
      };
    }

    const model = {
      id: 'MOD-PERF',
      nom: 'Performance',
      regles: {
        chemin: 'regles.yaml',
        data: { lang: 'fr', defaut: { name: '$.nom' } }
      },
      graphique: {
        chemin: 'graphique.yaml',
        data: { vues: { 'VUE-PERF': { noeuds: geometries } } }
      },
      documents,
      elements,
      vues: [ { id: 'VUE-PERF', nom: 'Performance', noeuds } ]
    };

    editor = new UrbanArchimateEditor({ container });

    const loadStart = performance.now();
    await editor.load(model);
    const loadDuration = performance.now() - loadStart;

    expect(loadDuration).toBeLessThan(5000);

    const canvas = editor.getDiagram().get('canvas');

    const scrollStart = performance.now();
    for (let i = 0; i < 20; i++) {
      canvas.scroll({ dx: 10, dy: 5 });
    }
    const scrollDuration = performance.now() - scrollStart;

    // 20 déplacements de vue doivent rester fluides
    expect(scrollDuration).toBeLessThan(1000);

    const registry = editor.getDiagram().get('elementRegistry');
    expect(registry.get('n-VUE-PERF-N199')).toBeTruthy();
  });
});
