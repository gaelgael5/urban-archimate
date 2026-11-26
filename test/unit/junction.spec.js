import { describe, it, expect } from 'vitest';

import {
  applyRules,
  archimateTypeOf,
  indexRules,
  translateObject
} from '../../src/rules/engine.ts';

import { exportExchange } from '../../src/exchange/export.ts';

import { schemas, modelWithJunctions } from '../fixtures/modele-jonctions.mjs';

describe('jonction — type Junction de l\'hôte, attribut jonction', () => {

  it('sans proprietes.jonction : jonction « et » (critère 1)', () => {
    const objet = { cle: 'JCT-1', type: 'jonction' };
    expect(archimateTypeOf(objet, schemas())).toBe('AndJunction');
  });

  it('jonction: Or -> « ou » ; jonction: And -> « et » (critère 2)', () => {
    expect(archimateTypeOf(
      { cle: 'JCT-1', type: 'jonction', proprietes: { jonction: 'Or' } },
      schemas())).toBe('OrJunction');

    expect(archimateTypeOf(
      { cle: 'JCT-1', type: 'jonction', proprietes: { jonction: 'And' } },
      schemas())).toBe('AndJunction');
  });

  it('une valeur inattendue est refusée en nommant la jonction', () => {
    expect(() => archimateTypeOf(
      { cle: 'JCT-X', type: 'jonction', proprietes: { jonction: 'Xor' } },
      schemas())).toThrow(/JCT-X.*Xor/);
  });

  it('la clé de règle junctionType se lit comme les autres', () => {
    const rules = {
      defaut: { name: '$.nom' },
      elements: [
        { type: 'jonction', name: '$.nom', junctionType: '$.proprietes.sens' }
      ]
    };

    const translated = translateObject(
      { cle: 'JCT-1', type: 'jonction', proprietes: { sens: 'Or' } },
      false,
      indexRules(rules),
      schemas());

    expect(translated.archimateType).toBe('OrJunction');
  });

  it('applyRules traduit les jonctions et leurs relations', () => {
    const ir = applyRules(modelWithJunctions());

    const et = ir.elements.find((e) => e.cle === 'JCT-ET');
    const ou = ir.elements.find((e) => e.cle === 'JCT-OU');

    expect(et.archimateType).toBe('AndJunction');
    expect(ou.archimateType).toBe('OrJunction');

    const relation = ir.relationships.find((r) => r.cle === 'REL-ET-B');
    expect(relation.source).toBe('id-jct-et');
  });

  it('l\'export Open Group sort AndJunction et OrJunction et reste valide (critère 4)', async () => {
    const xml = exportExchange(modelWithJunctions());

    expect(xml).toContain('xsi:type="AndJunction"');
    expect(xml).toContain('xsi:type="OrJunction"');

    // validation XSD : mêmes conditions que exchange.spec.js
    const { execFileSync } = await import('node:child_process');
    const { writeFileSync, mkdtempSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');

    try {
      execFileSync('xmllint', [ '--version' ], { stdio: 'ignore' });
    } catch {
      console.warn('xmllint absent : validation XSD sautée');
      return;
    }

    const dir = mkdtempSync(join(tmpdir(), 'ua-jonction-'));
    const file = join(dir, 'model.xml');
    writeFileSync(file, xml);

    execFileSync('xmllint', [
      '--noout',
      '--schema', join(import.meta.dirname, '../fixtures/xsd/archimate3_Diagram.xsd'),
      file
    ], {
      stdio: [ 'ignore', 'pipe', 'pipe' ],
      env: {
        ...process.env,
        XML_CATALOG_FILES: join(import.meta.dirname, '../fixtures/xsd/catalog.xml')
      }
    });
  });
});
