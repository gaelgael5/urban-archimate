/**
 * Garde-fous du thème de l'interface (assets/urban-archimate-ui.css),
 * sur le modèle de ceux d'Ossie Studio (frontend/src/styles.test.ts) :
 * sans eux, une couleur en dur ou un token oublié installe en silence une
 * palette parallèle que l'hôte ne peut plus aligner sur la sienne.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const css = readFileSync(join(ROOT, 'assets/urban-archimate-ui.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const contrat = readFileSync(join(ROOT, 'docs/contrat.md'), 'utf8');

// le bloc des valeurs par défaut : `:root, :host { … }`
const tokenBlock = css.match(/:root,\s*:host\s*\{([^}]*)\}/)[1];
const rest = css.replace(tokenBlock, '');

const declared = new Map(
  [ ...tokenBlock.matchAll(/(--ua-[\w-]+)\s*:\s*([^;]+);/g) ]
    .map(([ , name, value ]) => [ name, value.trim() ]));

function resolve(value) {
  const ref = value.match(/^var\((--ua-[\w-]+)\)$/);
  return ref ? resolve(declared.get(ref[1])) : value;
}

function luminance(hex) {
  const [ r, g, b ] = hex.replace('#', '').match(/../g)
    .map((c) => parseInt(c, 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [ hi, lo ] = [ luminance(resolve(a)), luminance(resolve(b)) ].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('thème de l\'interface — tokens --ua-*', () => {

  it('les valeurs par défaut s\'appliquent aussi dans le shadow DOM (:host)', () => {
    // `:root` seul ne correspond à rien dans un shadow root : les tokens y
    // seraient indéfinis et chaque couleur retomberait sur sa valeur initiale
    expect(css).toMatch(/:root,\s*:host\s*\{/);
  });

  it('tout token référencé est déclaré', () => {
    const referenced = new Set([ ...css.matchAll(/var\((--ua-[\w-]+)/g) ].map((m) => m[1]));
    const missing = [ ...referenced ].filter((name) => !declared.has(name));
    expect(missing).toEqual([]);
  });

  it('aucune couleur n\'est écrite en dur hors du bloc des tokens', () => {
    const literals = rest.match(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(|\b(?:white|black)(?![\w-])/gi) || [];
    expect(literals).toEqual([]);
  });

  it('chaque token est documenté dans le contrat (raccord de l\'hôte)', () => {
    const undocumented = [ ...declared.keys() ].filter((name) => !contrat.includes(`\`${ name }\``));
    expect(undocumented).toEqual([]);
  });

  it('les couples texte / fond par défaut passent le seuil WCAG AA', () => {
    const couples = [
      [ '--ua-texte', '--ua-fond' ],
      [ '--ua-texte', '--ua-fond-panneau' ],
      [ '--ua-texte-secondaire', '--ua-fond' ],
      [ '--ua-texte-secondaire', '--ua-fond-panneau' ],
      [ '--ua-texte-secondaire', '--ua-fond-discret' ],
      [ '--ua-accent', '--ua-fond-panneau' ],
      [ '--ua-accent-texte', '--ua-accent' ],
      [ '--ua-accent-texte', '--ua-accent-survol' ],
      [ '--ua-accent-fond-texte', '--ua-accent-fond' ],
      [ '--ua-erreur', '--ua-fond-panneau' ],
      [ '--ua-erreur', '--ua-erreur-fond' ]
    ];

    const failing = couples
      .map(([ fg, bg ]) => ({ fg, bg, ratio: contrast(`var(${ fg })`, `var(${ bg })`) }))
      .filter(({ ratio }) => ratio < 4.5);

    expect(failing).toEqual([]);
  });

  it('l\'anneau de focus se distingue du fond (≥ 3)', () => {
    expect(contrast('var(--ua-focus)', 'var(--ua-fond-panneau)')).toBeGreaterThanOrEqual(3);
  });
});
