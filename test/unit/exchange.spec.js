import { describe, it, expect } from 'vitest';

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { load as parseYaml } from 'js-yaml';

import { exportExchange } from '../../src/exchange/export.ts';

const exampleYaml = readFileSync(
  join(import.meta.dirname, '../../examples/boutique/modele-hydrate.yaml'),
  'utf8');

const XSD_DIR = join(import.meta.dirname, '../fixtures/xsd');

function hasXmllint() {
  try {
    execFileSync('xmllint', [ '--version' ], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

describe('exchange — Open Group export', () => {

  it('produces the expected structure', () => {
    const xml = exportExchange(parseYaml(exampleYaml));

    expect(xml).toContain('xmlns="http://www.opengroup.org/xsd/archimate/3.0/"');
    expect(xml).toContain('xsi:type="ApplicationComponent"');
    expect(xml).toContain('accessType="Write"');
    expect(xml).toContain('xml:lang="fr"');
    expect(xml).toContain('xsi:type="Diagram"');
    expect(xml).toContain('elementRef="id-app-boutique"');
    expect(xml).toContain('<bendpoint x="400" y="95" />');
    expect(xml).toContain('xsi:type="Label"');
  });

  it('is valid against the official XSD 3.1 (critère 4)', () => {
    if (!hasXmllint()) {
      // CI installs libxml2-utils; locally the check needs xmllint
      console.warn('xmllint absent : validation XSD sautée');
      return;
    }

    const xml = exportExchange(parseYaml(exampleYaml));

    const dir = mkdtempSync(join(tmpdir(), 'ua-exchange-'));
    const file = join(dir, 'model.xml');
    writeFileSync(file, xml);

    // throws (non-zero exit) when invalid
    const output = execFileSync('xmllint', [
      '--noout',
      '--schema', join(XSD_DIR, 'archimate3_Diagram.xsd'),
      file
    ], {
      encoding: 'utf8',
      stdio: [ 'ignore', 'pipe', 'pipe' ],
      env: {
        ...process.env,

        // resolve the xml.xsd import offline
        XML_CATALOG_FILES: join(XSD_DIR, 'catalog.xml')
      }
    });

    expect(output).toBe('');
  });
});
