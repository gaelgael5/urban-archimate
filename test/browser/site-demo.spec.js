import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { UrbanArchimateEditor } from '../../src/editor/UrbanArchimateEditor.ts';

import {
  MODELES,
  hydrate,
  toolbox,
  drop,
  allowedRelations,
  delegates
} from '../../site/hote.ts';

function createContainer() {
  const container = document.createElement('div');
  container.style.width = '1400px';
  container.style.height = '800px';
  document.body.appendChild(container);
  return container;
}

describe('page de démonstration — l\'hôte boutique en ligne', () => {

  let container, editor;

  beforeEach(() => {
    container = createContainer();
  });

  afterEach(() => {
    editor?.destroy();
    editor = null;
    container.remove();
  });

  it('hydrate les deux modèles d\'exemple et le composant les charge sans avertissement', async () => {
    expect(MODELES.length).toBe(2);

    for (const chemin of MODELES) {
      const hydrated = hydrate(chemin);

      const localContainer = createContainer();
      const localEditor = new UrbanArchimateEditor({
        container: localContainer, delegates: delegates()
      });

      const { warnings } = await localEditor.load(hydrated);
      expect(warnings, chemin).toEqual([]);

      localEditor.destroy();
      localContainer.remove();
    }
  });

  it('la boîte à outils de la démo fournit groupes, libellés, icônes et clés', () => {
    const groupes = toolbox();

    expect(groupes.length).toBe(4);

    const jonctions = groupes.find((groupe) => groupe.id === 'jonctions');
    expect(jonctions.outils.map((outil) => outil.cle)).toEqual(
      [ 'JCT-MODE-LIVRAISON', 'JCT-SYNCHRO' ]);

    const outils = groupes.flatMap((groupe) => groupe.outils);
    expect(outils.length).toBeGreaterThanOrEqual(12);

    for (const outil of outils) {
      expect(outil.cle).toBeTruthy();
      expect(outil.libelle).toBeTruthy();
      expect(outil.icone).toContain('<svg');
    }
  });

  it('poser un objet depuis la boîte appelle le délégué de la démo et l\'affiche (critère 2)', async () => {
    const demoDelegates = delegates();
    const dropSpy = vi.fn(demoDelegates.drop);
    demoDelegates.drop = dropSpy;

    editor = new UrbanArchimateEditor({ container, delegates: demoDelegates });
    await editor.load(hydrate(MODELES[0]));

    // OBJ-FACTURE n'est pas dans le modèle métier : on le pose
    container.querySelector('.ua-outil[data-cle="OBJ-FACTURE"]').click();

    const canvasHost = container.querySelector('.ua-canvas');
    const rect = canvasHost.getBoundingClientRect();
    canvasHost.dispatchEvent(new MouseEvent('click', {
      bubbles: true, clientX: rect.left + 500, clientY: rect.top + 500
    }));
    await new Promise((r) => setTimeout(r, 30));

    expect(dropSpy).toHaveBeenCalledTimes(1);
    expect(dropSpy).toHaveBeenCalledWith('OBJ-FACTURE');

    const registry = editor.getDiagram().get('elementRegistry');
    const shape = registry.getAll().find(
      (element) => element.businessObject?.hostKey === 'OBJ-FACTURE');

    expect(shape).toBeTruthy();
    expect(shape.name).toBe('Facture');
  });

  it('tracer une relation et la remplir : elle apparaît dans « nouvelles relations » (critère 3)', async () => {
    editor = new UrbanArchimateEditor({ container, delegates: delegates() });
    await editor.load(hydrate(MODELES[0]));

    // la démo autorise acces entre un processus et un document métier
    const permis = allowedRelations('PRC-PREPARATION', 'OBJ-COMMANDE');
    expect(permis.map((type) => type.type)).toEqual([ 'acces' ]);

    const promise = editor.connectNodes(
      'n-VUE-PARCOURS-N-PREP', 'n-VUE-PARCOURS-N-CMD');
    await new Promise((r) => setTimeout(r, 10));

    const form = container.querySelector('.ua-grille form');
    form.querySelector('input[name="cle"]').value = 'REL-PREPARATION-LIT-COMMANDE';
    form.querySelector('input[name="nom"]').value = 'Lit la commande';
    form.querySelector('select[data-archimate="acces"]').value = 'Read';
    form.dispatchEvent(new Event('input', { bubbles: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await promise;

    const { nouvellesRelations } = editor.save();

    expect(nouvellesRelations).toEqual([ {
      cle: 'REL-PREPARATION-LIT-COMMANDE',
      type: 'acces',
      source: 'PRC-PREPARATION',
      cible: 'OBJ-COMMANDE',
      nom: 'Lit la commande',
      proprietes: { acces: 'Read' }
    } ]);
  });

  it('déplacer un nœud ne change que le graphique affiché (critère 4)', async () => {
    editor = new UrbanArchimateEditor({ container, delegates: delegates() });
    await editor.load(hydrate(MODELES[1]));

    const base = editor.save();

    const diagram = editor.getDiagram();
    const registry = diagram.get('elementRegistry');
    diagram.get('modeling').moveShape(
      registry.get('n-VUE-COUCHES-N-SERVEUR'), { x: 40, y: 20 });

    const { modele, graphique } = editor.save();

    expect(modele).toEqual(base.modele);
    expect(graphique.vues['VUE-COUCHES'].noeuds['N-SERVEUR'])
      .toEqual({ x: 360, y: 640, l: 200, h: 80 });
  });

  it('le délégué de pose de la démo refuse une clé inconnue', () => {
    expect(() => drop('OBJ-INCONNU')).toThrow(/OBJ-INCONNU/);
  });
});
