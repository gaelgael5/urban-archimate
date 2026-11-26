/**
 * Test de bout en bout du site de démonstration DÉPLOYÉ, piloté par le
 * Chromium de browserless de la machine de test (pas par un navigateur local) :
 * on éprouve ce que sert réellement nginx, tel qu'un visiteur le charge.
 *
 * Usage : SITE_URL=http://hote:8120/ BROWSERLESS_WS=ws://hote:3000 \
 *         node test/e2e/site-deploye.mjs [capture.png]
 *
 * Sort en code 1 au premier contrôle en échec, avec un message explicite.
 */

import { chromium } from 'playwright';

const SITE_URL = process.env.SITE_URL;
const BROWSERLESS_WS = process.env.BROWSERLESS_WS;
const CAPTURE = process.argv[2];

if (!SITE_URL || !BROWSERLESS_WS) {
  console.error('SITE_URL et BROWSERLESS_WS sont requis');
  process.exit(2);
}

const controles = [];

function verifier(nom, condition, detail = '') {
  controles.push({ nom, ok: Boolean(condition), detail });
  console.log(`${ condition ? 'OK  ' : 'ÉCHEC' } ${ nom }${ detail ? ` — ${ detail }` : '' }`);
}

// connectOverCDP plutôt que connect() : tolérant à l'écart de version entre
// le Playwright du dépôt et celui embarqué par browserless.
const browser = await chromium.connectOverCDP(BROWSERLESS_WS);

try {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();

  const erreurs = [];
  page.on('pageerror', (error) => erreurs.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') erreurs.push(message.text());
  });

  const reponse = await page.goto(SITE_URL, { waitUntil: 'networkidle' });
  verifier('la page répond 200', reponse?.status() === 200, `HTTP ${ reponse?.status() }`);

  // Le composant rend dans un shadow DOM ouvert : on attend les formes diagram-js.
  const formes = page.locator('urban-archimate .djs-shape');
  await formes.first().waitFor({ timeout: 15000 }).catch(() => {});
  const nbFormes = await formes.count();
  verifier('le composant affiche le premier modèle', nbFormes > 0, `${ nbFormes } formes`);

  // L'ajustement se fait sur la taille réelle du canevas, pas sur celle
  // mesurée à sa création (diagramme minuscule sinon).
  const taille = await page.evaluate(() => {
    const editeur = document.getElementById('editeur');
    const canvas = editeur.editor.getDiagram().get('canvas');
    const hote = editeur.shadowRoot.querySelector('.ua-canvas');
    return { canevas: canvas.viewbox().outer.width, hote: hote.clientWidth, zoom: canvas.zoom() };
  });
  verifier('le diagramme est ajusté à la taille réelle du canevas',
    taille.canevas === taille.hote && taille.zoom > 0.4,
    `canevas ${ taille.canevas } px / conteneur ${ taille.hote } px, zoom ${ taille.zoom.toFixed(2) }`);

  const options = await page.locator('#choix-modele option').count();
  verifier('les deux modèles sont proposés', options === 2, `${ options } options`);

  // Deuxième modèle : le rechargement doit produire un diagramme non vide.
  if (options >= 2) {
    const deuxieme = await page.locator('#choix-modele option').nth(1).getAttribute('value');
    await page.selectOption('#choix-modele', deuxieme);
    await page.waitForTimeout(1000);
    const nb = await page.locator('urban-archimate .djs-shape').count();
    verifier('le second modèle se charge', nb > 0, `${ nb } formes`);
  }

  // Enregistrement : le composant rend modèle et graphique, affichés par l'hôte.
  await page.click('#bouton-enregistrer');
  const modele = await page.locator('#sortie-modele').textContent();
  const graphique = await page.locator('#sortie-graphique').textContent();
  verifier('l\'enregistrement rend le modèle', (modele || '').trim().length > 0);
  verifier('l\'enregistrement rend le graphique', (graphique || '').trim().length > 0);

  // Lecture seule : la palette d'édition disparaît, le diagramme reste.
  await page.check('#lecture-seule');
  await page.waitForTimeout(1000);
  const nbLecture = await page.locator('urban-archimate .djs-shape').count();
  verifier('le mode lecture seule affiche toujours le diagramme', nbLecture > 0, `${ nbLecture } formes`);

  verifier('aucune erreur JavaScript', erreurs.length === 0, erreurs.slice(0, 3).join(' | '));

  if (CAPTURE) {
    await page.uncheck('#lecture-seule');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: CAPTURE });
    console.log(`capture : ${ CAPTURE }`);
  }

  await context.close();
} finally {
  await browser.close();
}

const echecs = controles.filter((c) => !c.ok);
console.log(`\nE2E : ${ controles.length - echecs.length }/${ controles.length } contrôles OK`);
process.exit(echecs.length ? 1 : 0);
