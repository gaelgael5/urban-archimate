import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { UrbanArchimateEditor } from '../../src/editor/UrbanArchimateEditor.ts';

import {
  SCHEMA_JONCTION,
  modelWithJunctions
} from '../fixtures/modele-jonctions.mjs';

function createContainer() {
  const container = document.createElement('div');
  container.style.width = '1400px';
  container.style.height = '800px';
  document.body.appendChild(container);
  return container;
}

describe('jonction — rendu, pose et enregistrement', () => {

  let container, editor;

  beforeEach(() => {
    container = createContainer();
  });

  afterEach(() => {
    editor?.destroy();
    editor = null;
    container.remove();
  });

  function circleOf(nodeId) {
    const registry = editor.getDiagram().get('elementRegistry');
    const shape = registry.get(nodeId);
    return {
      shape,
      circle: registry.getGraphics(shape).querySelector('circle')
    };
  }

  it('une jonction de l\'hôte se dessine « et » (plein) ou « ou » (creux) (critères 1 et 2)', async () => {
    editor = new UrbanArchimateEditor({ container });
    await editor.load(modelWithJunctions());

    const et = circleOf('n-VUE-J-NJ1');
    expect(et.shape.type).toBe('AndJunction');
    expect(et.circle).toBeTruthy();

    const ou = circleOf('n-VUE-J-NJ2');
    expect(ou.shape.type).toBe('OrJunction');

    // « ou » est creux (fond blanc), « et » est plein (encre)
    expect(ou.circle.style.fill).toBe('rgb(255, 255, 255)');
    expect(et.circle.style.fill).not.toBe('rgb(255, 255, 255)');
    expect(et.circle.style.fill).toBe(et.circle.style.stroke);
  });

  it('une jonction posée par le délégué de pose apparaît avec le bon dessin (critère 3)', async () => {
    const drop = vi.fn(async () => ({
      objet: {
        chemin: 'cartographie/objets/jonction/jct-paiement.yaml',
        data: {
          cle: 'JCT-PAIEMENT',
          type: 'jonction',
          nom: 'Choix du paiement',
          proprietes: { jonction: 'Or' }
        }
      },
      schemaType: {
        chemin: 'cartographie/types/jonction.schema.yaml',
        data: SCHEMA_JONCTION
      }
    }));

    editor = new UrbanArchimateEditor({
      container,
      delegates: {
        toolbox: async () => [ {
          id: 'jonctions', libelle: 'Jonctions',
          outils: [ { cle: 'JCT-PAIEMENT', libelle: 'Choix du paiement' } ]
        } ],
        drop
      }
    });

    await editor.load(modelWithJunctions());

    container.querySelector('.ua-outil[data-cle="JCT-PAIEMENT"]').click();
    const canvasHost = container.querySelector('.ua-canvas');
    const rect = canvasHost.getBoundingClientRect();
    canvasHost.dispatchEvent(new MouseEvent('click', {
      bubbles: true, clientX: rect.left + 600, clientY: rect.top + 400
    }));
    await new Promise((r) => setTimeout(r, 30));

    expect(drop).toHaveBeenCalledWith('JCT-PAIEMENT');

    const registry = editor.getDiagram().get('elementRegistry');
    const shape = registry.getAll().find(
      (element) => element.businessObject?.hostKey === 'JCT-PAIEMENT');

    expect(shape).toBeTruthy();
    expect(shape.type).toBe('OrJunction');
    expect(registry.getGraphics(shape).querySelector('circle')
      .style.fill).toBe('rgb(255, 255, 255)');

    const { modele } = editor.save();
    expect(modele.elements).toContain('JCT-PAIEMENT');
  });

  it('relations via une jonction : enregistrement puis rechargement identiques (critère 5)', async () => {
    editor = new UrbanArchimateEditor({ container });
    await editor.load(modelWithJunctions());

    const premier = editor.save();

    // les relations qui passent par la jonction sont bien là
    const vue = premier.modele.vues[0];
    expect(vue.connexions.map((c) => c.relationship)).toEqual([
      'REL-A-ET', 'REL-ET-B' ]);

    // rechargement : on réhydrate à partir de l'enregistrement
    const rehydrate = modelWithJunctions();
    rehydrate.vues = premier.modele.vues;
    rehydrate.graphique.data = premier.graphique;

    const container2 = createContainer();
    const editor2 = new UrbanArchimateEditor({ container: container2 });

    try {
      await editor2.load(rehydrate);
      const second = editor2.save();

      expect(second.modele).toEqual(premier.modele);
      expect(second.graphique).toEqual(premier.graphique);
    } finally {
      editor2.destroy();
      container2.remove();
    }
  });
});
