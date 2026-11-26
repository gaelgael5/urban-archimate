import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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

const TYPE_FLUX = {
  type: 'flux',
  archimate: 'Flow',
  libelle: 'Flux',
  schema: {
    title: 'Flux',
    'x-archimate': 'Flow',
    properties: {
      frequence: {
        title: 'Fréquence',
        type: 'string',
        enum: [ 'quotidien', 'hebdomadaire', 'mensuel' ]
      },
      volume: { title: 'Volume', type: 'number' }
    },
    required: [ 'frequence' ]
  }
};

describe('grille de propriétés pilotée par le schéma du type', () => {

  let container, editor, allowedRelations;

  beforeEach(async () => {
    container = createContainer();

    allowedRelations = vi.fn(async () => [ TYPE_ACCES, TYPE_FLUX ]);

    editor = new UrbanArchimateEditor({
      container,
      delegates: { allowedRelations }
    });

    await editor.load(exampleYaml);
  });

  afterEach(() => {
    editor.destroy();
    container.remove();
  });

  function grille() {
    return container.querySelector('.ua-grille');
  }

  it('tracer un accès : clé, nom et sens demandés ; Valider inactif tant que la clé est vide ou mal formée (critère 1)', async () => {
    const promise = editor.connectNodes(
      'n-VUE-COOPERATION-N1', 'n-VUE-COOPERATION-N3');

    await new Promise((r) => setTimeout(r, 10));

    // le délégué des relations permises est appelé une fois, avec les deux clés
    expect(allowedRelations).toHaveBeenCalledTimes(1);
    expect(allowedRelations).toHaveBeenCalledWith('APP-BOUTIQUE', 'OBJ-COMMANDE');

    const form = grille().querySelector('form');
    expect(form).toBeTruthy();

    const cle = form.querySelector('input[name="cle"]');
    const nom = form.querySelector('input[name="nom"]');
    const sens = form.querySelector('select[data-archimate="acces"]');
    const valider = form.querySelector('.ua-bouton-valider');

    expect(cle).toBeTruthy();
    expect(nom).toBeTruthy();
    expect(sens).toBeTruthy();

    const libelles = [ ...sens.options ].map((o) => o.textContent);
    expect(libelles).toEqual([
      'non précisé', 'lecture', 'écriture', 'lecture-écriture' ]);

    // clé vide : Valider inactif
    expect(valider.disabled).toBe(true);

    // clé mal formée : toujours inactif
    cle.value = 'minuscules pas bonnes';
    form.dispatchEvent(new Event('input', { bubbles: true }));
    expect(valider.disabled).toBe(true);

    // clé bien formée : actif
    cle.value = 'REL-BOUTIQUE-LIT-COMMANDE';
    form.dispatchEvent(new Event('input', { bubbles: true }));
    expect(valider.disabled).toBe(false);

    form.querySelector('.ua-bouton-annuler').click();
    await promise;
  });

  it('une propriété enum s\'affiche en liste ; une propriété obligatoire vide bloque la validation (critère 2)', async () => {
    const promise = editor.connectNodes(
      'n-VUE-COOPERATION-N1', 'n-VUE-COOPERATION-N3');

    await new Promise((r) => setTimeout(r, 10));

    const form = grille().querySelector('form');

    // choisir le type Flux (propriétés du schéma)
    const type = form.querySelector('select[name="type"]');
    type.value = 'flux';
    type.dispatchEvent(new Event('change', { bubbles: true }));

    const frequence = form.querySelector('select[data-propriete="frequence"]');
    expect(frequence).toBeTruthy();
    expect([ ...frequence.options ].map((o) => o.value)).toContain('quotidien');

    const volume = form.querySelector('input[data-propriete="volume"]');
    expect(volume).toBeTruthy();
    expect(volume.type).toBe('number');

    const cle = form.querySelector('input[name="cle"]');
    const valider = form.querySelector('.ua-bouton-valider');

    cle.value = 'REL-FLUX-TEST';
    form.dispatchEvent(new Event('input', { bubbles: true }));

    // fréquence obligatoire non choisie : bloqué
    expect(valider.disabled).toBe(true);

    frequence.value = 'quotidien';
    form.dispatchEvent(new Event('input', { bubbles: true }));
    expect(valider.disabled).toBe(false);

    form.querySelector('.ua-bouton-annuler').click();
    await promise;
  });

  it('valider : la relation apparaît sur le dessin et dans « nouvelles relations » avec acces: Read (critère 3)', async () => {
    const promise = editor.connectNodes(
      'n-VUE-COOPERATION-N1', 'n-VUE-COOPERATION-N3');

    await new Promise((r) => setTimeout(r, 10));

    const form = grille().querySelector('form');

    form.querySelector('input[name="cle"]').value = 'REL-BOUTIQUE-LIT-COMMANDE';
    form.querySelector('input[name="nom"]').value = 'Lit la commande';

    const sens = form.querySelector('select[data-archimate="acces"]');
    sens.value = 'Read'; // « lecture »

    form.dispatchEvent(new Event('input', { bubbles: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await promise;

    // sur le dessin
    const registry = editor.getDiagram().get('elementRegistry');
    const connection = registry.getAll().find(
      (element) => element.businessObject &&
        element.businessObject.hostKey === 'REL-BOUTIQUE-LIT-COMMANDE');

    expect(connection).toBeTruthy();
    expect(connection.type).toBe('Access');
    expect(connection.businessObject.relationshipRef.accessType).toBe('Read');

    // dans la sortie, pas dans les documents (critère 5 du contrat)
    const { modele, nouvellesRelations } = editor.save();

    expect(nouvellesRelations).toEqual([ {
      cle: 'REL-BOUTIQUE-LIT-COMMANDE',
      type: 'acces',
      source: 'APP-BOUTIQUE',
      cible: 'OBJ-COMMANDE',
      nom: 'Lit la commande',
      proprietes: { acces: 'Read' }
    } ]);

    expect(modele.relationships).toContain('REL-BOUTIQUE-LIT-COMMANDE');
    expect(modele.documents.some(
      (chemin) => chemin.includes('lit-commande'))).toBe(false);

    expect(modele.vues[0].connexions.some(
      (c) => c.relationship === 'REL-BOUTIQUE-LIT-COMMANDE')).toBe(true);
  });

  it('l\'hôte ne rend aucun type : liaison refusée avec le nom des deux objets', async () => {
    allowedRelations.mockResolvedValueOnce([]);

    await editor.connectNodes('n-VUE-COOPERATION-N1', 'n-VUE-COOPERATION-N3');

    const statut = container.querySelector('.ua-toolbox-statut');
    expect(statut.textContent).toContain('Boutique en ligne');
    expect(statut.textContent).toContain('Commande');
    expect(statut.textContent).toContain('aucune relation');

    // pas de formulaire ouvert
    expect(grille().querySelector('form')).toBeFalsy();
  });

  it('sélectionner un objet posé : propriétés affichées, non modifiables (critère 4)', async () => {
    const registry = editor.getDiagram().get('elementRegistry');
    const selection = editor.getDiagram().get('selection');

    selection.select(registry.get('n-VUE-COOPERATION-N1'));

    const lecture = grille().querySelector('.ua-grille-lecture');
    expect(lecture).toBeTruthy();

    expect(lecture.textContent).toContain('APP-BOUTIQUE');
    expect(lecture.textContent).toContain('Boutique en ligne');
    expect(lecture.textContent).toContain('Responsable');
    expect(lecture.textContent).toContain('Équipe vente');

    // aucune saisie possible
    expect(lecture.querySelector('input, select, textarea')).toBeFalsy();

    // la sélection d'une relation existante s'affiche aussi en lecture seule
    selection.select(registry.get('c-VUE-COOPERATION-C1'));

    const relation = grille().querySelector('.ua-grille-lecture');
    expect(relation.textContent).toContain('REL-BOUTIQUE-ECRIT-COMMANDE');
    // valeur ArchiMate affichée avec son libellé français
    expect(relation.textContent).toContain('écriture');
  });
});
