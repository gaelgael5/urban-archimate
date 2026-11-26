#!/usr/bin/env bash
# Suite complète, jouée dans le conteneur `tests` sur la machine de test
# (dev-deploy.sh l'appelle avant de livrer). Mêmes étapes que la CI GitHub
# (.github/workflows/ci.yml) : un écart entre les deux serait un défaut.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

etape() { echo; echo "--- $*"; }

etape "Lint";       npm run lint
etape "Typecheck";  npm run typecheck
etape "Vitest (unit + navigateur Chromium)"; npm test
etape "Build de la bibliothèque"; npm run build

etape "Paquet Python : assemblage et test de mount()"
node scripts/build-python-package.mjs
PYTHONPATH=python python3 -m pytest python/tests -q

# La CI vérifie par `git diff` ; l'image n'a pas de .git (cf. .dockerignore),
# on compare donc à une copie prise avant régénération.
etape "Export des tables de relations à jour"
cp data/archimate-relationship-tables.json /tmp/tables-avant.json
npx vite-node scripts/export-relationship-tables.mjs
cmp -s /tmp/tables-avant.json data/archimate-relationship-tables.json \
  || { echo "ERREUR : data/archimate-relationship-tables.json n'est pas à jour — relancer l'export et committer" >&2; exit 1; }

etape "Construction du site de démonstration"; npm run build:site

echo; echo "Suite complète : OK"
