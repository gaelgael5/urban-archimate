/**
 * Captures the example views as PNG files under docs/captures/
 * (visual control required by the backlog). Needs a running dev
 * server, or starts one itself.
 *
 * Usage: node scripts/capture-examples.mjs
 */

import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 5197;

const CAPTURES = [
  { exemple: 'tous-elements', fichier: 'tous-elements.png', height: 2600 },
  { exemple: 'boutique', fichier: 'boutique.png', height: 800 }
];

const server = spawn('npx', [ 'vite', '--port', String(PORT) ], {
  cwd: ROOT,
  stdio: 'ignore'
});

try {
  await new Promise((resolve) => setTimeout(resolve, 3000));

  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
    args: [ '--headless', '--no-sandbox' ]
  });

  mkdirSync(join(ROOT, 'docs/captures'), { recursive: true });

  for (const { exemple, fichier, height } of CAPTURES) {
    const page = await browser.newPage({
      viewport: { width: 1600, height },
      deviceScaleFactor: 2
    });

    await page.goto(
      `http://localhost:${ PORT }/demo/?exemple=${ exemple }`,
      { waitUntil: 'networkidle' });

    await page.waitForTimeout(1500);

    const path = join(ROOT, 'docs/captures', fichier);
    await page.screenshot({ path });
    console.log(`capture écrite : docs/captures/${ fichier }`);

    await page.close();
  }

  await browser.close();
} finally {
  server.kill();
}
