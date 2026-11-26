import { describe, it, expect } from 'vitest';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { load as parseYaml } from 'js-yaml';

import {
  applyRules,
  RuleResolutionError
} from '../../src/rules/engine.ts';

import { resolveValuePath, isValuePath } from '../../src/rules/paths.ts';

const exampleYaml = readFileSync(
  join(import.meta.dirname, '../../examples/boutique/modele-hydrate.yaml'),
  'utf8');

function exampleModel() {
  return parseYaml(exampleYaml);
}

describe('rules — value paths', () => {

  it('resolves dotted paths', () => {
    const objet = { nom: 'Boutique', proprietes: { acces: 'Write' } };

    expect(resolveValuePath(objet, '$.nom')).toBe('Boutique');
    expect(resolveValuePath(objet, '$.proprietes.acces')).toBe('Write');
    expect(resolveValuePath(objet, '$.proprietes.absent')).toBeUndefined();
  });

  it('distinguishes paths from literals', () => {
    expect(isValuePath('$.nom')).toBe(true);
    expect(isValuePath('Write')).toBe(false);
  });
});

describe('rules — block resolution (critères 1 et 5)', () => {

  it('an application object takes its own block', () => {
    const ir = applyRules(exampleModel());

    const boutique = ir.elements.find((e) => e.cle === 'APP-BOUTIQUE');

    expect(boutique.archimateType).toBe('ApplicationComponent');
    expect(boutique.name).toBe('Boutique en ligne');
    // the application block maps the `responsable` property
    expect(boutique.properties).toEqual([
      { definition: 'propid-responsable', value: 'Équipe vente' }
    ]);
  });

  it('an object of a type without a block takes the block of its ArchiMate type', () => {
    const model = exampleModel();

    // give the rules a block addressed to the ArchiMate type directly
    model.regles.data.elements.push({
      type: 'ApplicationInterface',
      name: '$.nom',
      documentation: '$.documentation'
    });
    // remove defaut so the match is provable
    delete model.regles.data.defaut;
    // document-metier block covers OBJ-COMMANDE; API-CATALOGUE has no
    // 'interface-applicative' block -> falls back to ApplicationInterface
    const ir = applyRules(model);

    const api = ir.elements.find((e) => e.cle === 'API-CATALOGUE');
    expect(api.archimateType).toBe('ApplicationInterface');
    expect(api.name).toBe('API Catalogue');
  });

  it('otherwise the defaut block applies', () => {
    const ir = applyRules(exampleModel());

    // API-CATALOGUE has no block for its type nor its ArchiMate type:
    // the defaut block gives it its name
    const api = ir.elements.find((e) => e.cle === 'API-CATALOGUE');
    expect(api.name).toBe('API Catalogue');
  });

  it('refuses an object without an applicable block, naming it (critère 5)', () => {
    const model = exampleModel();
    delete model.regles.data.defaut;
    // remove the interface fallback: API-CATALOGUE has nothing left
    model.regles.data.elements =
      model.regles.data.elements.filter((b) => b.type === 'application');
    // keep only blocks that no longer cover document-metier either;
    // OBJ-COMMANDE would fail first or API-CATALOGUE — both named cases ok
    model.regles.data.elements.push({
      type: 'document-metier', name: '$.nom'
    });

    expect(() => applyRules(model)).toThrow(RuleResolutionError);
    expect(() => applyRules(model)).toThrow(/API-CATALOGUE/);
  });
});

describe('rules — translation (critères 2 et 3)', () => {

  it('a property not picked up by the block of the type does not appear', () => {
    const model = exampleModel();

    // the document-metier block has no properties mapping; give the
    // object a property anyway
    model.documents.find((d) => d.data.cle === 'OBJ-COMMANDE')
      .data.proprietes = { couleur: 'rouge' };

    const ir = applyRules(model);

    const commande = ir.elements.find((e) => e.cle === 'OBJ-COMMANDE');
    expect(commande.properties).toEqual([]);
  });

  it('acces: Write gives accessType="Write" without conversion (critère 3)', () => {
    const ir = applyRules(exampleModel());

    const relation = ir.relationships.find(
      (r) => r.cle === 'REL-BOUTIQUE-ECRIT-COMMANDE');

    expect(relation.archimateType).toBe('Access');
    expect(relation.attributes.accessType).toBe('Write');
    expect(relation.source).toBe('id-app-boutique');
    expect(relation.target).toBe('id-obj-commande');
  });

  it('uses the rules lang', () => {
    const ir = applyRules(exampleModel());
    expect(ir.lang).toBe('fr');
  });
});
