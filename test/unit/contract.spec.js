import { describe, it, expect } from 'vitest';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { load as parseYaml } from 'js-yaml';

import { loadHydratedModel } from '../../src/model/load.ts';
import { validateHydratedModel } from '../../src/model/validate.ts';
import { dehydrateModel, cleanHydratedModel } from '../../src/model/dehydrate.ts';
import { ModelValidationError } from '../../src/model/errors.ts';

const exampleYaml = readFileSync(
  join(import.meta.dirname, '../../examples/boutique/modele-hydrate.yaml'),
  'utf8');

function exampleModel() {
  return parseYaml(exampleYaml);
}

describe('contract — hydrated model validation', () => {

  it('accepts the repository example', () => {
    const { model, warnings } = loadHydratedModel(exampleYaml);

    expect(model.id).toBe('MOD-BOUTIQUE-APPLICATIF');
    expect(warnings).toEqual([]);
  });

  it('refuses a retained key absent from the documents', () => {
    const model = exampleModel();
    model.elements.push('OBJ-FANTOME');

    expect(() => loadHydratedModel(model)).toThrow(ModelValidationError);

    try {
      loadHydratedModel(model);
    } catch (error) {
      const codes = error.issues.map((issue) => issue.code);
      expect(codes).toContain('cle-retenue-sans-document');
      expect(error.message).toContain('OBJ-FANTOME');
    }
  });

  it('refuses a relationship whose target is not retained', () => {
    const model = exampleModel();
    // drop OBJ-COMMANDE from retained elements (and its node from the view
    // so only the relationship control fires)
    model.elements = model.elements.filter((cle) => cle !== 'OBJ-COMMANDE');
    model.documents = model.documents.filter(
      (doc) => doc.data.cle !== 'OBJ-COMMANDE');
    model.vues[0].noeuds = model.vues[0].noeuds.filter((n) => n.id !== 'N3');
    model.vues[0].connexions = [];
    delete model.graphique.data.vues['VUE-COOPERATION'].connexions;

    try {
      loadHydratedModel(model);
      expect.unreachable('le modèle aurait dû être refusé');
    } catch (error) {
      const codes = error.issues.map((issue) => issue.code);
      expect(codes).toContain('relation-extremite-non-retenue');
      expect(error.message).toContain('REL-BOUTIQUE-ECRIT-COMMANDE');
    }
  });

  it('refuses a connection that references an unknown node', () => {
    const model = exampleModel();
    model.vues[0].connexions[0].vers = 'N-INCONNU';

    try {
      loadHydratedModel(model);
      expect.unreachable('le modèle aurait dû être refusé');
    } catch (error) {
      const codes = error.issues.map((issue) => issue.code);
      expect(codes).toContain('connexion-noeud-inconnu');
      expect(error.message).toContain('N-INCONNU');
    }
  });

  it('refuses a document none of whose objects is retained', () => {
    const model = exampleModel();
    model.documents.push({
      chemin: 'cartographie/objets/application/app-orpheline.yaml',
      data: { cle: 'APP-ORPHELINE', type: 'application', nom: 'Orpheline' }
    });

    try {
      loadHydratedModel(model);
      expect.unreachable('le modèle aurait dû être refusé');
    } catch (error) {
      const codes = error.issues.map((issue) => issue.code);
      expect(codes).toContain('document-sans-objet-retenu');
      expect(error.message).toContain('app-orpheline.yaml');
    }
  });

  it('reports (without refusing) a graphics entry without a matching node', () => {
    const model = exampleModel();
    model.graphique.data.vues['VUE-COOPERATION'].noeuds['N-FANTOME'] =
      { x: 0, y: 0, l: 10, h: 10 };

    const { warnings } = validateHydratedModel(model);

    expect(warnings.some((w) => w.code === 'graphique-noeud-inconnu')).toBe(true);
  });

  it('refuses a malformed key via the JSON Schema', () => {
    const model = exampleModel();
    model.elements[0] = 'minuscules-interdites';

    const { errors } = validateHydratedModel(model);
    expect(errors.some((e) => e.code === 'schema')).toBe(true);
  });
});

describe('contract — dehydration (save)', () => {

  it('returns the model without data, identical to the stored form', () => {
    const { model } = loadHydratedModel(exampleYaml);

    const dehydrated = dehydrateModel(model);

    expect(dehydrated).toEqual({
      id: 'MOD-BOUTIQUE-APPLICATIF',
      nom: 'Boutique — vue applicative',
      description: 'Ce que la boutique expose et ce qu\'elle manipule.',
      regles: 'cartographie/regles/standard.rules.yaml',
      graphique: 'cartographie/modeles/boutique-applicatif.graphique.yaml',
      documents: [
        'cartographie/objets/application/app-boutique.yaml',
        'cartographie/objets/interface-applicative/api-catalogue.yaml',
        'cartographie/objets/document-metier/obj-commande.yaml',
        'cartographie/objets/acces/rel-boutique-ecrit-commande.yaml'
      ],
      elements: [ 'APP-BOUTIQUE', 'API-CATALOGUE', 'OBJ-COMMANDE' ],
      relationships: [ 'REL-BOUTIQUE-ECRIT-COMMANDE' ],
      vues: model.vues
    });

    // no `data` anywhere
    expect(JSON.stringify(dehydrated)).not.toContain('"data"');
  });

  it('drops nodes, connections and documents of a key no longer retained', () => {
    const { model } = loadHydratedModel(exampleYaml);

    // the host removed OBJ-COMMANDE from the retained elements
    model.elements = model.elements.filter((cle) => cle !== 'OBJ-COMMANDE');
    model.relationships = [];

    cleanHydratedModel(model);

    const vue = model.vues[0];
    expect(vue.noeuds.map((n) => n.id)).toEqual([ 'N1', 'N4' ]);
    expect(vue.connexions).toEqual([]);
    expect(model.documents.map((d) => d.data.cle)).toEqual([
      'APP-BOUTIQUE', 'API-CATALOGUE'
    ]);
  });
});
