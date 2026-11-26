import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { load as parseYaml } from 'js-yaml';

import { UrbanArchimateEditor } from '../../src/editor/UrbanArchimateEditor.ts';

import exampleYaml from '../../examples/boutique/modele-hydrate.yaml?raw';

function createContainer() {
  const container = document.createElement('div');
  container.style.width = '1400px';
  container.style.height = '800px';
  document.body.appendChild(container);
  return container;
}

/** The boutique example, plus a second view placing APP-BOUTIQUE. */
function modelWithTwoViews() {
  const model = parseYaml(exampleYaml);

  model.vues.push({
    id: 'VUE-B',
    nom: 'Vue B',
    point_de_vue: 'organisation',
    noeuds: [ { id: 'NB1', element: 'APP-BOUTIQUE' } ]
  });

  model.graphique.data.vues['VUE-B'] = {
    noeuds: { NB1: { x: 60, y: 80, l: 150, h: 60 } }
  };

  return model;
}

const DROP = {
  'OBJ-FACTURE': {
    objet: {
      chemin: 'cartographie/objets/document-metier/obj-facture.yaml',
      data: { cle: 'OBJ-FACTURE', type: 'document-metier', nom: 'Facture' }
    }
  },
  'OBJ-PANIER': {
    objet: {
      chemin: 'cartographie/objets/document-metier/obj-panier.yaml',
      data: { cle: 'OBJ-PANIER', type: 'document-metier', nom: 'Panier' }
    }
  }
};

describe('gérer les vues d\'un modèle', () => {

  let container, editor, toolboxDelegate;

  beforeEach(async () => {
    container = createContainer();

    toolboxDelegate = vi.fn(async () => [ {
      id: 'objets',
      libelle: 'Objets',
      outils: [
        { cle: 'OBJ-FACTURE', libelle: 'Facture' },
        { cle: 'OBJ-PANIER', libelle: 'Panier' }
      ]
    } ]);

    editor = new UrbanArchimateEditor({
      container,
      delegates: {
        toolbox: toolboxDelegate,
        drop: async (cle) => DROP[ cle ]
      }
    });

    await editor.load(modelWithTwoViews());
  });

  afterEach(() => {
    editor.destroy();
    container.remove();
  });

  async function poser(cle, x, y) {
    container.querySelector(`.ua-outil[data-cle="${ cle }"]`).click();
    const canvasHost = container.querySelector('.ua-canvas');
    const rect = canvasHost.getBoundingClientRect();
    canvasHost.dispatchEvent(new MouseEvent('click', {
      bubbles: true, clientX: rect.left + x, clientY: rect.top + y
    }));
    await new Promise((r) => setTimeout(r, 30));
  }

  it('la barre d\'onglets liste les vues avec leur point de vue ; cliquer change de vue', async () => {
    const onglets = [ ...container.querySelectorAll('.ua-vue-onglet') ];
    expect(onglets.map((o) => o.dataset.vueId)).toEqual([
      'VUE-COOPERATION', 'VUE-B' ]);

    expect(onglets[0].textContent).toContain('Coopération applicative');
    expect(onglets[0].textContent).toContain('application-cooperation');
    expect(onglets[0].classList.contains('ua-vue-active')).toBe(true);

    // changer de vue par le clic
    onglets[1].querySelector('.ua-vue-nom').click();
    await new Promise((r) => setTimeout(r, 30));

    const registry = editor.getDiagram().get('elementRegistry');
    expect(registry.get('n-VUE-B-NB1')).toBeTruthy();
    expect(registry.get('n-VUE-COOPERATION-N1')).toBeFalsy();
    expect(editor.currentVue.id).toBe('VUE-B');
  });

  it('au changement de vue, la boîte à outils est redemandée à l\'hôte avec le point de vue (critère 4)', async () => {
    toolboxDelegate.mockClear();

    await editor.setCurrentVue('VUE-B');

    expect(toolboxDelegate).toHaveBeenCalledTimes(1);
    expect(toolboxDelegate).toHaveBeenCalledWith({
      pointDeVue: 'organisation',
      vueId: 'VUE-B'
    });
  });

  it('ajouter « Vue métier », y poser deux objets, enregistrer : deux vues de plus et leurs entrées graphiques (critère 1)', async () => {
    await editor.addVue('Vue métier', 'business-process-cooperation');

    expect(editor.currentVue.nom).toBe('Vue métier');

    await poser('OBJ-FACTURE', 300, 200);
    await poser('OBJ-PANIER', 600, 200);

    const { modele, graphique } = editor.save();

    expect(modele.vues.map((v) => v.id)).toEqual([
      'VUE-COOPERATION', 'VUE-B', 'VUE-VUE-METIER' ]);

    const nouvelle = modele.vues[2];
    expect(nouvelle.nom).toBe('Vue métier');
    expect(nouvelle.point_de_vue).toBe('business-process-cooperation');
    expect(nouvelle.noeuds.map((n) => n.element)).toEqual([
      'OBJ-FACTURE', 'OBJ-PANIER' ]);

    expect(Object.keys(graphique.vues).sort()).toEqual([
      'VUE-B', 'VUE-COOPERATION', 'VUE-VUE-METIER' ]);
  });

  it('supprimer une vue dont un objet figure aussi dans une autre : l\'objet reste retenu (critère 2)', async () => {
    await editor.deleteVue('VUE-B');

    const { modele, graphique } = editor.save();

    expect(modele.vues.map((v) => v.id)).toEqual([ 'VUE-COOPERATION' ]);
    expect(modele.elements).toContain('APP-BOUTIQUE');

    // l'entrée graphique de la vue supprimée disparaît
    expect(Object.keys(graphique.vues)).toEqual([ 'VUE-COOPERATION' ]);
  });

  it('supprimer la dernière vue où figure un objet : il sort du modèle à l\'enregistrement (critère 3)', async () => {
    // OBJ-COMMANDE et API-CATALOGUE ne figurent que dans VUE-COOPERATION
    await editor.deleteVue('VUE-COOPERATION');

    const { modele } = editor.save();

    expect(modele.elements).toEqual([ 'APP-BOUTIQUE' ]);
    expect(modele.relationships).toEqual([]);
    expect(modele.documents).toEqual([
      'cartographie/objets/application/app-boutique.yaml' ]);

    // la vue restante est affichée
    expect(editor.currentVue.id).toBe('VUE-B');
  });

  it('renommer une vue ; suppression en deux temps dans la barre', async () => {
    editor.renameVue('VUE-B', 'Vue organisation');

    expect(editor.save().modele.vues[1].nom).toBe('Vue organisation');
    expect(container.textContent).toContain('Vue organisation');

    // suppression : premier clic = confirmation, second = suppression
    const onglet = [ ...container.querySelectorAll('.ua-vue-onglet') ]
      .find((o) => o.dataset.vueId === 'VUE-B');
    const bouton = onglet.querySelector('.ua-vue-supprimer');

    bouton.click();
    expect(bouton.textContent).toContain('Confirmer');
    expect(editor.save().modele.vues.length).toBe(2);

    bouton.click();
    await new Promise((r) => setTimeout(r, 30));

    expect(editor.save().modele.vues.length).toBe(1);
  });
});
