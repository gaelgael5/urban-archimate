/**
 * Assembles the Python package: builds the JS, emits the TypeScript
 * declarations, copies everything under python/urban_archimate/static
 * and aligns the Python version on package.json.
 *
 * Usage: node scripts/build-python-package.mjs
 */

import { execSync } from 'node:child_process';
import {
  cpSync, mkdirSync, readFileSync, rmSync, writeFileSync
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const run = (command) =>
  execSync(command, { cwd: ROOT, stdio: 'inherit' });

run('npx vite build');
run('npx tsc -p tsconfig.build.json');

const staticDir = join(ROOT, 'python/urban_archimate/static');
rmSync(staticDir, { recursive: true, force: true });
mkdirSync(staticDir, { recursive: true });

// built JS (+ sourcemap)
cpSync(join(ROOT, 'dist/urban-archimate.js'), join(staticDir, 'urban-archimate.js'));
try {
  cpSync(
    join(ROOT, 'dist/urban-archimate.js.map'),
    join(staticDir, 'urban-archimate.js.map'));
} catch {
  // sourcemap optional
}

// TypeScript types of the contract, for the host front
cpSync(join(ROOT, 'dist/types/src'), join(staticDir, 'types'), { recursive: true });

// JSON Schema of the hydrated model
cpSync(
  join(ROOT, 'schema/hydrated-model.schema.json'),
  join(staticDir, 'hydrated-model.schema.json'));

// align the Python version on package.json
const version = JSON.parse(
  readFileSync(join(ROOT, 'package.json'), 'utf8')).version;

const initFile = join(ROOT, 'python/urban_archimate/__init__.py');
const init = readFileSync(initFile, 'utf8')
  .replace(/__version__ = "[^"]+"/, `__version__ = "${ version }"`);
writeFileSync(initFile, init);

console.log(`paquet python assemblé (version ${ version })`);
