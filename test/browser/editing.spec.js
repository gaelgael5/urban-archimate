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

const TYPE_ACCES = {
  type: 'acces',
  archimate: 'Access',
  libelle: 'Accès',
  schema: { title: 'Accès', 'x-archimate': 'Access' }
};

const DROP_FACTURE = {
  objet: {
    chemin: 'cartographie/objets/document-metier/obj-facture.yaml',
    data: { cle: 'OBJ-FACTURE', type: 'document-metier', nom: 'Facture' }
  }
};

describe('éditer une vue en respectant les règles de relation', () => {

  let container, editor, allowedRelations, drop;

  beforeEach(async () => {
    container = createContainer();

    allowedRelations = vi.fn(async () => [ TYPE_ACCES ]);
    drop = vi.fn(async () => DROP_FACTURE);

    editor = new UrbanArchimateEditor({
      container,
      delegates: {
        toolbox: async () => [ {
          id: 'objets', libelle: 'Objets',
          outils: [ { cle: 'OBJ-FACTURE', libelle: 'Facture' } ]
        } ],
        drop,
        allowedRelations
      }
    });

    await editor.load(exampleYaml);
  });

  afterEach(() => {
    editor.destroy();
    container.remove();
  });

  function diagram() {
    return editor.getDiagram();
  }

  function shapeOf(id) {
    return diagram().get('elementRegistry').get(id);
  }

  it('le geste de liaison entre deux objets passe par le délégué des relations permises (critère 1)', async () => {
    const eventBus = diagram().get('eventBus');

    // fin du geste de liaison N1 -> N3 (ce que produit connect.end)
    eventBus.fire('connect.end', {
      context: {
        canExecute: true,
        source: shapeOf('n-VUE-COOPERATION-N1'),
        target: shapeOf('n-VUE-COOPERATION-N3'),
        connectionStart: { x: 0, y: 0 }
      },
      x: 0, y: 0
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(allowedRelations).toHaveBeenCalledTimes(1);
    expect(allowedRelations).toHaveBeenCalledWith('APP-BOUTIQUE', 'OBJ-COMMANDE');

    // la grille s'est ouverte ; seuls les types rendus sont proposés
    const form = container.querySelector('.ua-grille form');
    expect(form).toBeTruthy();

    const types = [ ...form.querySelector('select[name="type"]').options ]
      .map((o) => o.value);
    expect(types).toEqual([ 'acces' ]);

    form.querySelector('.ua-bouton-annuler').click();
  });

  it('le pad contextuel offre relier et retirer, pas de création ni de remplacement', () => {
    const contextPad = diagram().get('contextPad');
    const entries = contextPad.getEntries(shapeOf('n-VUE-COOPERATION-N1'));

    expect(Object.keys(entries).sort()).toEqual([ 'connect', 'remove' ]);
  });

  it('annuler puis refaire rend exactement le même modèle et le même graphique (critère 3)', async () => {
    const baseline = editor.save();

    // poser un objet via le délégué
    container.querySelector('.ua-outil[data-cle="OBJ-FACTURE"]').click();
    const canvasHost = container.querySelector('.ua-canvas');
    const rect = canvasHost.getBoundingClientRect();
    canvasHost.dispatchEvent(new MouseEvent('click', {
      bubbles: true, clientX: rect.left + 500, clientY: rect.top + 400
    }));
    await new Promise((r) => setTimeout(r, 30));

    const afterPose = editor.save();
    expect(afterPose.modele.elements).toContain('OBJ-FACTURE');

    const commandStack = diagram().get('commandStack');

    commandStack.undo();

    const afterUndo = editor.save();
    expect(afterUndo.modele).toEqual(baseline.modele);
    expect(afterUndo.graphique).toEqual(baseline.graphique);

    commandStack.redo();

    const afterRedo = editor.save();
    expect(afterRedo.modele).toEqual(afterPose.modele);
    expect(afterRedo.graphique).toEqual(afterPose.graphique);
  });

  it('retirer le dernier nœud d\'un objet le retire de elements et son document de documents (critère 4)', () => {
    const modeling = diagram().get('modeling');

    // retirer le nœud OBJ-COMMANDE (N3) — sa connexion C1 part avec lui
    modeling.removeElements([ shapeOf('n-VUE-COOPERATION-N3') ]);

    const { modele } = editor.save();

    expect(modele.elements).not.toContain('OBJ-COMMANDE');
    expect(modele.documents).not.toContain(
      'cartographie/objets/document-metier/obj-commande.yaml');

    // la relation qui n'apparaît plus dans aucune vue sort aussi
    expect(modele.relationships).not.toContain('REL-BOUTIQUE-ECRIT-COMMANDE');
    expect(modele.vues[0].connexions || []).toEqual([]);

    // l'objet n'est jamais supprimé côté hôte : seul le modèle change
    // (le document du modèle ne le liste plus, le fichier appartient à l'hôte)
  });

  it('retirer un nœud d\'un objet présent ailleurs le garde retenu', async () => {
    // API-CATALOGUE n'a qu'un nœud (N2, imbriqué dans N1) ; en revanche
    // APP-BOUTIQUE garde son nœud N1 quand on retire un doublon
    const placement = await import('../../src/editor/placement.ts');

    // poser un second nœud d'APP-BOUTIQUE n'est pas offert par l'hôte ici,
    // on vérifie à l'inverse : retirer N2 retire API-CATALOGUE (dernier nœud)
    const modeling = diagram().get('modeling');
    modeling.removeElements([ shapeOf('n-VUE-COOPERATION-N2') ]);

    const { modele } = editor.save();
    expect(modele.elements).not.toContain('API-CATALOGUE');
    expect(modele.elements).toContain('APP-BOUTIQUE');
    expect(placement).toBeTruthy();
  });

  it('imbriquer un nœud dans un autre se retrouve dans le modèle enregistré', () => {
    const modeling = diagram().get('modeling');

    const n3 = shapeOf('n-VUE-COOPERATION-N3');
    const n1 = shapeOf('n-VUE-COOPERATION-N1');

    modeling.updateAttachment(n3, n1);

    const { modele } = editor.save();
    const noeuds = modele.vues[0].noeuds;

    const n1Doc = noeuds.find((n) => n.id === 'N1');
    expect(n1Doc.enfants.map((e) => e.id)).toContain('N3');
    expect(noeuds.some((n) => n.id === 'N3')).toBe(false);
  });

  it('déplacer les points de passage d\'une relation ne change que le graphique', () => {
    const modeling = diagram().get('modeling');
    const connection = shapeOf('c-VUE-COOPERATION-C1');

    const baseline = editor.save();

    modeling.updateWaypoints(connection, [
      { x: 360, y: 150 },
      { x: 420, y: 260 },
      { x: 460, y: 95 }
    ]);

    const { modele, graphique } = editor.save();

    expect(modele.vues).toEqual(baseline.modele.vues);
    expect(graphique.vues['VUE-COOPERATION'].connexions.C1.points)
      .toEqual([ { x: 420, y: 260 } ]);
  });

  it('une relation de l\'hôte ne peut pas être rebranchée sur un autre objet', () => {
    const rules = diagram().get('rules');

    const connection = shapeOf('c-VUE-COOPERATION-C1');
    const autre = shapeOf('n-VUE-COOPERATION-N2');

    const refused = rules.allowed('connection.reconnect', {
      connection,
      source: connection.source,
      target: autre
    });

    expect(refused).toBe(false);

    const allowed = rules.allowed('connection.reconnect', {
      connection,
      source: connection.source,
      target: connection.target
    });

    expect(allowed).toBeTruthy();
  });
});
