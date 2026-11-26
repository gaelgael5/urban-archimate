import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { UrbanArchimateEditor } from '../../src/editor/UrbanArchimateEditor.ts';

import exampleYaml from '../../examples/boutique/modele-hydrate.yaml?raw';

const ICONE_SVG = '<svg viewBox="0 0 16 16"><rect width="16" height="16"/></svg>';

function buildToolbox() {
  const groupes = [
    {
      id: 'objets-application',
      libelle: 'Objets — Application',
      outils: [
        { cle: 'APP-PAIEMENT', libelle: 'Application Paiement', icone: ICONE_SVG },
        { cle: 'APP-STOCK', libelle: 'Application Stock', icone: ICONE_SVG },
        { cle: 'API-PAIEMENT', libelle: 'API Paiement', icone: ICONE_SVG },
        { cle: 'API-STOCK', libelle: 'API Stock', icone: ICONE_SVG }
      ]
    },
    {
      id: 'objets-metier',
      libelle: 'Objets — Métier',
      outils: [
        { cle: 'OBJ-FACTURE', libelle: 'Facture', icone: ICONE_SVG },
        { cle: 'OBJ-CLIENT', libelle: 'Client', icone: ICONE_SVG },
        { cle: 'OBJ-PANIER', libelle: 'Panier', icone: ICONE_SVG },
        { cle: 'OBJ-LIVRAISON', libelle: 'Livraison', icone: ICONE_SVG }
      ]
    },
    {
      id: 'relations-existantes',
      libelle: 'Relations existantes',
      outils: [
        { cle: 'REL-BOUTIQUE-LIT-FACTURE', libelle: 'Boutique lit Facture', icone: ICONE_SVG },
        { cle: 'REL-BOUTIQUE-ECRIT-COMMANDE', libelle: 'Boutique écrit Commande', icone: ICONE_SVG },
        { cle: 'REL-ERREUR', libelle: 'Relation en erreur', icone: ICONE_SVG },
        { cle: 'OBJ-ERREUR', libelle: 'Objet en erreur', icone: ICONE_SVG }
      ]
    }
  ];

  const objets = {
    'OBJ-FACTURE': {
      objet: {
        chemin: 'cartographie/objets/document-metier/obj-facture.yaml',
        data: { cle: 'OBJ-FACTURE', type: 'document-metier', nom: 'Facture' }
      }
    },
    'REL-BOUTIQUE-LIT-FACTURE': {
      objet: {
        chemin: 'cartographie/objets/acces/rel-boutique-lit-facture.yaml',
        data: {
          cle: 'REL-BOUTIQUE-LIT-FACTURE',
          type: 'acces',
          source: 'APP-BOUTIQUE',
          cible: 'OBJ-FACTURE',
          nom: 'Lit la facture',
          proprietes: { acces: 'Read' }
        }
      }
    }
  };

  return { groupes, objets };
}

function createContainer() {
  const container = document.createElement('div');
  container.style.width = '1200px';
  container.style.height = '800px';
  document.body.appendChild(container);
  return container;
}

function clickCanvas(container, offsetX = 300, offsetY = 300) {
  const canvasHost = container.querySelector('.ua-canvas');
  const rect = canvasHost.getBoundingClientRect();

  canvasHost.dispatchEvent(new MouseEvent('click', {
    bubbles: true,
    clientX: rect.left + offsetX,
    clientY: rect.top + offsetY
  }));

  // the placement flow is asynchronous (drop delegate)
  return new Promise((resolve) => setTimeout(resolve, 20));
}

describe('boîte à outils fournie par l\'hôte', () => {

  let container, editor, toolboxDelegate, dropDelegate;

  beforeEach(async () => {
    container = createContainer();

    const { groupes, objets } = buildToolbox();

    toolboxDelegate = vi.fn(async () => groupes);
    dropDelegate = vi.fn(async (cle) => {
      if (!objets[ cle ]) {
        throw new Error(`objet inconnu côté hôte : ${ cle }`);
      }
      return objets[ cle ];
    });

    editor = new UrbanArchimateEditor({
      container,
      delegates: { toolbox: toolboxDelegate, drop: dropDelegate }
    });

    await editor.load(exampleYaml);
  });

  afterEach(() => {
    editor.destroy();
    container.remove();
  });

  it('affiche les groupes et outils de l\'hôte avec libellé et icône ; la recherche filtre (critère 1)', () => {
    // le délégué a reçu le point de vue de la vue courante
    expect(toolboxDelegate).toHaveBeenCalledWith({
      pointDeVue: 'application-cooperation',
      vueId: 'VUE-COOPERATION'
    });

    const groupes = container.querySelectorAll('.ua-toolbox-groupe');
    // 3 groupes de l'hôte + le groupe « Vue » du composant
    expect(groupes.length).toBe(4);

    const outils = container.querySelectorAll('.ua-outil[data-kind="host"]');
    expect(outils.length).toBe(12);

    const facture = [ ...outils ].find((o) => o.dataset.cle === 'OBJ-FACTURE');
    expect(facture.textContent).toContain('Facture');
    expect(facture.querySelector('.ua-outil-icone svg')).toBeTruthy();

    // recherche
    const recherche = container.querySelector('.ua-toolbox-recherche');
    recherche.value = 'paiement';
    recherche.dispatchEvent(new Event('input'));

    const visibles = container.querySelectorAll('.ua-outil');
    expect(visibles.length).toBe(2);
    expect([ ...visibles ].every(
      (o) => o.textContent.toLowerCase().includes('paiement'))).toBe(true);
  });

  it('poser un outil appelle le délégué une fois avec la clé ; l\'élément apparaît avec le nom de la règle (critère 2)', async () => {
    const bouton = container.querySelector('.ua-outil[data-cle="OBJ-FACTURE"]');
    bouton.click();

    await clickCanvas(container);

    expect(dropDelegate).toHaveBeenCalledTimes(1);
    expect(dropDelegate).toHaveBeenCalledWith('OBJ-FACTURE');

    const registry = editor.getDiagram().get('elementRegistry');
    const shape = registry.getAll().find(
      (element) => element.businessObject &&
        element.businessObject.hostKey === 'OBJ-FACTURE');

    expect(shape).toBeTruthy();
    expect(shape.name).toBe('Facture');
    expect(shape.type).toBe('BusinessObject');

    // l'enregistrement reflète la pose
    const { modele } = editor.save();
    expect(modele.elements).toContain('OBJ-FACTURE');
    expect(modele.documents).toContain(
      'cartographie/objets/document-metier/obj-facture.yaml');
    expect(modele.vues[0].noeuds.some((n) => n.element === 'OBJ-FACTURE')).toBe(true);
  });

  it('glisser-déposer un outil sur le dessin le pose à l\'endroit du dépôt', async () => {
    const bouton = container.querySelector('.ua-outil[data-cle="OBJ-FACTURE"]');
    const canvasHost = container.querySelector('.ua-canvas');
    const rect = canvasHost.getBoundingClientRect();
    const depot = { x: rect.left + 500, y: rect.top + 320 };

    const debut = bouton.getBoundingClientRect();
    bouton.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, button: 0, pointerId: 1,
      clientX: debut.left + 10, clientY: debut.top + 10
    }));

    // un premier mouvement franchit le seuil, un second suit le curseur
    for (const point of [
      { x: debut.left + 60, y: debut.top + 20 }, depot ]) {
      window.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true, pointerId: 1, clientX: point.x, clientY: point.y
      }));
    }

    // le fantôme accompagne le geste
    expect(container.querySelector('.ua-outil-fantome')).toBeTruthy();

    window.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true, pointerId: 1, clientX: depot.x, clientY: depot.y
    }));

    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(container.querySelector('.ua-outil-fantome')).toBeFalsy();
    expect(dropDelegate).toHaveBeenCalledWith('OBJ-FACTURE');

    const registry = editor.getDiagram().get('elementRegistry');
    const shape = registry.getAll().find(
      (element) => element.businessObject &&
        element.businessObject.hostKey === 'OBJ-FACTURE');

    expect(shape).toBeTruthy();
  });

  it('le délégué échoue : rien n\'est posé et le message de l\'hôte s\'affiche (critère 3)', async () => {
    const registry = editor.getDiagram().get('elementRegistry');
    const avant = registry.getAll().length;

    container.querySelector('.ua-outil[data-cle="OBJ-ERREUR"]').click();
    await clickCanvas(container);

    expect(registry.getAll().length).toBe(avant);

    const statut = container.querySelector('.ua-toolbox-statut');
    expect(statut.textContent).toContain('objet inconnu côté hôte : OBJ-ERREUR');

    const { modele } = editor.save();
    expect(modele.elements).not.toContain('OBJ-ERREUR');
  });

  it('poser une relation existante dont la cible n\'est pas dans la vue : refusé, la cible est nommée (critère 4)', async () => {
    container.querySelector('.ua-outil[data-cle="REL-BOUTIQUE-LIT-FACTURE"]').click();
    await clickCanvas(container);

    const statut = container.querySelector('.ua-toolbox-statut');
    expect(statut.textContent).toContain('OBJ-FACTURE');
    expect(statut.textContent).toContain('n\'est pas dans la vue');

    const { modele } = editor.save();
    expect(modele.relationships).not.toContain('REL-BOUTIQUE-LIT-FACTURE');
  });

  it('poser une relation existante dont les deux extrémités sont dans la vue', async () => {
    // poser d'abord la facture
    container.querySelector('.ua-outil[data-cle="OBJ-FACTURE"]').click();
    await clickCanvas(container, 600, 400);

    // puis la relation existante
    container.querySelector('.ua-outil[data-cle="REL-BOUTIQUE-LIT-FACTURE"]').click();
    await clickCanvas(container, 300, 300);

    const registry = editor.getDiagram().get('elementRegistry');
    const connection = registry.getAll().find(
      (element) => element.businessObject &&
        element.businessObject.hostKey === 'REL-BOUTIQUE-LIT-FACTURE');

    expect(connection).toBeTruthy();
    expect(connection.type).toBe('Access');

    // la relation garde le sens d'accès de l'objet hôte
    expect(connection.businessObject.relationshipRef.accessType).toBe('Read');

    const { modele } = editor.save();
    expect(modele.relationships).toContain('REL-BOUTIQUE-LIT-FACTURE');
    expect(modele.vues[0].connexions.some(
      (c) => c.relationship === 'REL-BOUTIQUE-LIT-FACTURE')).toBe(true);
  });

  it('poser une note et un cadre n\'appelle pas le délégué (critère 5)', async () => {
    const outils = [ ...container.querySelectorAll('.ua-outil') ];

    outils.find((o) => o.dataset.kind === 'note').click();
    await clickCanvas(container, 200, 500);

    outils.find((o) => o.dataset.kind === 'cadre').click();
    await clickCanvas(container, 500, 500);

    expect(dropDelegate).not.toHaveBeenCalled();

    const { modele } = editor.save();
    const vue = modele.vues[0];

    expect(vue.noeuds.some((n) => n.note !== undefined && n.id !== 'N4')).toBe(true);
    expect(vue.noeuds.some((n) => n.cadre !== undefined)).toBe(true);
  });

  it('la palette de création libre n\'existe plus (pas de création d\'objet)', () => {
    expect(() => editor.getDiagram().get('palette')).toThrow();
  });
});
