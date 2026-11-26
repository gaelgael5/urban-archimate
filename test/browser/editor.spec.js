import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { load as parseYaml } from 'js-yaml';

import { UrbanArchimateEditor } from '../../src/editor/UrbanArchimateEditor.ts';

import exampleYaml from '../../examples/boutique/modele-hydrate.yaml?raw';

function createContainer() {
  const container = document.createElement('div');
  container.style.width = '1000px';
  container.style.height = '800px';
  document.body.appendChild(container);
  return container;
}

describe('UrbanArchimateEditor', () => {

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

  it('loads the hydrated model and renders the view (rules applied)', async () => {
    editor = new UrbanArchimateEditor({ container });

    const { warnings } = await editor.load(exampleYaml);
    expect(warnings).toEqual([]);

    const registry = editor.getDiagram().get('elementRegistry');

    const boutique = registry.get('n-VUE-COOPERATION-N1');
    expect(boutique).toBeTruthy();
    expect(boutique.type).toBe('ApplicationComponent');
    expect(boutique.name).toBe('Boutique en ligne');
    expect(boutique.x).toBe(40);
    expect(boutique.y).toBe(60);

    // nested node positioned relative to N1 (40+20, 60+50)
    const api = registry.get('n-VUE-COOPERATION-N2');
    expect(api).toBeTruthy();
    expect(api.x).toBe(60);
    expect(api.y).toBe(110);

    // the note renders too
    const note = registry.get('n-VUE-COOPERATION-N4');
    expect(note).toBeTruthy();

    // the connection translated through the rules (Access)
    const connection = registry.get('c-VUE-COOPERATION-C1');
    expect(connection).toBeTruthy();
    expect(connection.type).toBe('Access');

    // rendered into SVG
    expect(registry.getGraphics(boutique)).toBeTruthy();
  });

  it('load then save without modification gives back the stored forms (critère 2 du contrat)', async () => {
    editor = new UrbanArchimateEditor({ container });
    await editor.load(exampleYaml);

    const input = parseYaml(exampleYaml);
    const { modele, graphique, nouvellesRelations } = editor.save();

    expect(nouvellesRelations).toEqual([]);

    expect(modele).toEqual({
      id: input.id,
      nom: input.nom,
      description: input.description,
      regles: input.regles.chemin,
      graphique: input.graphique.chemin,
      documents: input.documents.map((d) => d.chemin),
      elements: input.elements,
      relationships: input.relationships,
      vues: input.vues
    });

    // no data anywhere
    expect(JSON.stringify(modele)).not.toContain('"data"');

    // geometry identical to the input graphics
    const nodes = graphique.vues['VUE-COOPERATION'].noeuds;
    expect(nodes.N1).toEqual({ x: 40, y: 60, l: 320, h: 180 });
    expect(nodes.N2).toEqual({ relatif: 'N1', dx: 20, dy: 50, l: 140, h: 60 });
    expect(nodes.N3).toEqual({ relatif: 'N1', dx: 420, dy: 40, l: 160, h: 70 });

    const connexion = graphique.vues['VUE-COOPERATION'].connexions.C1;
    expect(connexion.ancre_source).toBe('droite');
    expect(connexion.ancre_cible).toBe('gauche');
    expect(connexion.libelle).toEqual({ position: 0.5, dx: 0, dy: -12 });
  });

  it('moving a node emits changed and only touches the graphics (critères contrat/édition)', async () => {
    editor = new UrbanArchimateEditor({ container });
    await editor.load(exampleYaml);

    const changes = [];
    editor.on('changed', (event) => changes.push(event));

    const diagram = editor.getDiagram();
    const registry = diagram.get('elementRegistry');
    const modeling = diagram.get('modeling');

    const shape = registry.get('n-VUE-COOPERATION-N3');
    modeling.moveShape(shape, { x: 15, y: 25 });

    expect(changes.length).toBeGreaterThan(0);

    const { modele, graphique } = editor.save();

    // the model is untouched: same views as the input document
    expect(modele.vues).toEqual(parseYaml(exampleYaml).vues);

    // only the graphics moved (N3 is relative to N1: offsets updated)
    const nodes = graphique.vues['VUE-COOPERATION'].noeuds;
    expect(nodes.N3).toEqual({ relatif: 'N1', dx: 435, dy: 65, l: 160, h: 70 });
  });

  it('selection emits the key of the object (sélection du contrat)', async () => {
    editor = new UrbanArchimateEditor({ container });
    await editor.load(exampleYaml);

    const selections = [];
    editor.on('selection', (event) => selections.push(event));

    const diagram = editor.getDiagram();
    const registry = diagram.get('elementRegistry');
    const selection = diagram.get('selection');

    selection.select(registry.get('n-VUE-COOPERATION-N1'));

    expect(selections.pop()).toEqual({
      cle: 'APP-BOUTIQUE',
      viewElementId: 'N1',
      kind: 'node'
    });
  });

  it('read-only: renders, cannot modify, emits no changed event (critère 6)', async () => {
    editor = new UrbanArchimateEditor({ container, readOnly: true });

    const changes = [];
    editor.on('changed', (event) => changes.push(event));

    await editor.load(exampleYaml);

    const diagram = editor.getDiagram();
    const registry = diagram.get('elementRegistry');

    expect(registry.get('n-VUE-COOPERATION-N1')).toBeTruthy();

    // no interaction/editing modules in the read-only viewer
    expect(() => diagram.get('move')).toThrow();
    expect(() => diagram.get('palette')).toThrow();
    expect(() => diagram.get('bendpoints')).toThrow();

    expect(changes).toEqual([]);
  });

  it('a model that violates the rules is refused with the offending object named', async () => {
    editor = new UrbanArchimateEditor({ container });

    const model = parseYaml(exampleYaml);
    delete model.regles.data.defaut;
    model.regles.data.elements =
      model.regles.data.elements.filter((b) => b.type === 'application');

    await expect(editor.load(model)).rejects.toThrow(/API-CATALOGUE|OBJ-COMMANDE/);
  });
});
