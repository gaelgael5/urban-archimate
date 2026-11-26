# Images de la machine de test. Contexte de build = racine du dépôt.
#
#   cible `site`  : le site de démonstration, construit DEPUIS LES SOURCES de la
#                   branche déployée et servi par nginx (service livré) ;
#   cible `tests` : l'outillage de test (lint, typecheck, Vitest unit + navigateur,
#                   build de la bibliothèque, paquet Python, E2E via browserless).
#
# Les deux partent de la même installation `npm ci` : ce que les tests valident
# est ce que le site embarque.

# --- outillage de test --------------------------------------------------------
# Image Playwright alignée sur la version verrouillée dans package-lock.json :
# Vitest en mode navigateur a besoin du Chromium correspondant, déjà présent ici.
FROM mcr.microsoft.com/playwright:v1.65.1-noble AS tests

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    CI=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3-pip \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --break-system-packages starlette httpx pytest

WORKDIR /src
# Dépendances d'abord (couche réutilisée tant que le lock ne bouge pas) ;
# vendor/ est requis par npm ci (archimate-font est une dépendance file:).
COPY package.json package-lock.json ./
COPY vendor vendor
RUN npm ci

COPY . .
CMD ["bash", "scripts/tests-machine.sh"]

# --- construction du site -------------------------------------------------------
FROM tests AS site-build
RUN npm run build:site

# --- service livré ---------------------------------------------------------------
FROM nginx:1.27-alpine AS site
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=site-build /src/dist-site /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1/healthz | grep -q '"ok"' || exit 1
