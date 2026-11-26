#!/usr/bin/env bash
# Déploie le site de démonstration urban-archimate sur une machine de test
# (branche dev), après y avoir joué la suite complète de tests.
#
# Usage (depuis le clone du dépôt sur la machine) :
#   ./dev-deploy.sh                 # tests, déploiement, E2E, déclaration
#   ./dev-deploy.sh --sans-tests    # saute la suite (pas l'E2E) — redéploiement rapide
#   ./dev-deploy.sh --no-detach     # CI / débogage : sans le filet anti-raccrochage
#   ./dev-deploy.sh --exposer-seulement
#                                   # stack déjà en place : santé + E2E + déclaration
#
# Déclaration à l'annuaire du portail : active seulement si PORTAL_TOKEN est
# dans l'environnement — code TOTP « <login>:<code> » obtenu par l'outil MCP
# `totp_code`, valable 30 s, jamais écrit dans .env ni dans le journal. Il
# expire bien avant la fin d'un build : on enchaîne donc ./dev-deploy.sh, puis
# un code frais et ./dev-deploy.sh --exposer-seulement.
#
# Prérequis : git, docker (+ plugin compose v2), curl, l'accès réseau au dépôt
# GitHub (le script se met à jour depuis origin/dev avant tout ; il n'existe pas
# de mode « déployer ce qui est déjà là »), et le browserless de la machine de
# test (port BROWSERLESS_PORT, 3000 par défaut) pour l'E2E.
#
# Site statique, sans base : aucune migration à jouer.
set -euo pipefail

BRANCH="dev"
SERVICE="site"
STEPS=11
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$REPO_DIR/deploy-logs"
PRUNE_STAMP="$LOG_DIR/.last-prune"
cd "$REPO_DIR"

DETACH=1
EXPOSE_ONLY=0
SKIP_TESTS=0
for arg in "$@"; do
  case "$arg" in
    --no-detach) DETACH=0 ;;
    --exposer-seulement) EXPOSE_ONLY=1 ;;
    --sans-tests) SKIP_TESTS=1 ;;
    -h|--help) sed -n '2,24p' "$0"; exit 0 ;;
    *) echo "Option inconnue : $arg" >&2; exit 2 ;;
  esac
done

# --- 0. Survivre à la perte de la session -----------------------------------
# Le script arrête la stack : si le terminal tombe entre l'arrêt et la relance,
# SIGHUP le tuerait et laisserait la stack à terre. On ignore donc HUP et on
# journalise tout dans un fichier (`tee -p` continue d'écrire sans terminal).
mkdir -p "$LOG_DIR"
if [[ "$DETACH" == 1 && -z "${DEV_DEPLOY_LOGGING:-}" ]]; then
  export DEV_DEPLOY_LOGGING=1
  export DEV_DEPLOY_LOG="$LOG_DIR/deploy-$(date +%Y%m%d-%H%M%S).log"
  trap '' HUP PIPE
  exec > >(tee -a -p "$DEV_DEPLOY_LOG") 2>&1
  echo "Journal du déploiement : $DEV_DEPLOY_LOG"
fi

step() { echo; echo "=== [$1/$STEPS] $2"; }
die()  { echo "ERREUR : $*" >&2; exit 1; }

# --- 1. Prérequis --------------------------------------------------------------
step 1 "Prérequis"
command -v git  >/dev/null || die "git introuvable — sudo apt-get install -y git"
command -v curl >/dev/null || die "curl introuvable — sudo apt-get install -y curl"
command -v docker >/dev/null || die "docker introuvable — https://docs.docker.com/engine/install/"
docker compose version >/dev/null 2>&1 \
  || die "plugin docker compose v2 introuvable — sudo apt-get install -y docker-compose-plugin"
docker info >/dev/null 2>&1 \
  || die "le démon docker ne répond pas, ou droits insuffisants — sudo usermod -aG docker \$USER (puis reconnexion)"
echo "OK : $(docker compose version --short) / $(git --version)"

# --- 2. Mise à jour depuis le dépôt, puis ré-exécution ---------------------------
# Sans ré-exécution, on déploierait le code neuf avec un script, un compose et un
# Dockerfile périmés. DEV_DEPLOY_REEXEC évite de boucler.
step 2 "Mise à jour depuis origin/$BRANCH"
if [[ -z "${DEV_DEPLOY_REEXEC:-}" ]]; then
  [[ -z "$(git status --porcelain --untracked-files=no)" ]] \
    || die "modifications locales sur la machine (git status) : aucune retouche à la main n'est admise, tout passe par le dépôt"
  before="$(git rev-parse HEAD)"
  git fetch --prune origin "$BRANCH"
  git checkout -q "$BRANCH"
  git merge --ff-only -q "origin/$BRANCH" \
    || die "la branche locale a divergé d'origin/$BRANCH — reclone la branche dev"
  after="$(git rev-parse HEAD)"
  if [[ "$before" != "$after" ]]; then
    echo "Mis à jour ${before:0:7} -> ${after:0:7} : relance avec la version récupérée"
    export DEV_DEPLOY_REEXEC=1
    exec "$REPO_DIR/dev-deploy.sh" "$@"
  fi
fi
echo "Déploiement de $(git log -1 --format='%h %s')"

# --- 3. Configuration : compléter .env sans écraser l'existant --------------------
step 3 "Configuration (.env)"
touch .env
env_get() { grep "^$1=" .env | tail -1 | cut -d= -f2-; }
# Valeur absente de .env : prise dans l'environnement si elle y est (premier
# déploiement sur une VM partagée : SITE_PORT=8120 ./dev-deploy.sh), sinon le
# défaut ; elle est alors persistée et relue aux passages suivants.
env_default() { grep -q "^$1=" .env || echo "$1=${!1:-$2}" >> .env; }
# Isolation sur VM partagée : nom de stack et port paramétrés, jamais en dur.
env_default COMPOSE_PROJECT_NAME urban-archimate
env_default SITE_PORT 8120
env_default BROWSERLESS_PORT 3000
# Cible de la déclaration à l'annuaire (le jeton, lui, n'est jamais ici).
env_default EXPOSE_PORTAL_URL https://dev.yoops.org
env_default EXPOSE_WORKSPACE urban-archimate
PORT="$(env_get SITE_PORT)"
STACK="$(env_get COMPOSE_PROJECT_NAME)"
export COMPOSE_PROJECT_NAME="$STACK"
# Adresse par laquelle le Chromium de browserless (autre conteneur) et le
# conteneur de test joignent les ports publiés : la première IP de l'hôte, pas
# 127.0.0.1 qui désignerait le conteneur lui-même.
HOST_IP="$(hostname -I | awk '{print $1}')"
echo "Stack : $STACK — port publié : $PORT — hôte : $HOST_IP"

if [[ "$EXPOSE_ONLY" == 1 ]]; then
  echo "--exposer-seulement : étapes 4 à 7 sautées (stack supposée en place)"
else

# --- 4. Construction --------------------------------------------------------------
# Construire ici, depuis la copie fraîche du dépôt, est la vraie validation des
# images : jamais d'image réutilisée d'ailleurs.
step 4 "Construction des images (site + tests)"
docker compose --profile tests build --pull

# --- 5. Suite de tests complète (barrière avant livraison) ------------------------
# Jouée AVANT d'arrêter la stack : un échec laisse la version précédente en place.
step 5 "Suite de tests (lint, typecheck, Vitest unit + Chromium, build, Python)"
if [[ "$SKIP_TESTS" == 1 ]]; then
  echo "--sans-tests : suite sautée"
else
  docker compose --profile tests run --rm tests \
    || die "suite de tests en échec — rien n'a été livré (la stack précédente tourne toujours)"
fi

# --- 6. Arrêt (orphelins compris) puis contrôle du port ---------------------------
# Le port se sonde APRÈS l'arrêt : avant, on prendrait notre propre conteneur
# pour un conflit.
step 6 "Arrêt de la stack et contrôle du port"
docker compose down --remove-orphans
if (exec 3<>"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null; then
  die "le port $PORT est occupé par un autre service après l'arrêt de la stack — change SITE_PORT dans .env (diagnostic : sudo ss -ltnp 'sport = :$PORT')"
fi
echo "Port $PORT libre"

# --- 7. Lancement, attente d'un conteneur réellement en marche --------------------
step 7 "Lancement"
docker compose up -d "$SERVICE"
for _ in $(seq 1 30); do
  state="$(docker compose ps --format '{{.State}}' "$SERVICE" 2>/dev/null || true)"
  [[ "$state" == "running" ]] && break
  sleep 2
done
[[ "${state:-}" == "running" ]] \
  || die "le conteneur $SERVICE n'est pas en marche (état : ${state:-absent}) — docker compose logs $SERVICE"
echo "Conteneur $SERVICE en marche"
fi

# --- 8. Contrôle de santé, plafonné, sur le port réellement publié ----------------
step 8 "Contrôle de santé (http://127.0.0.1:$PORT/healthz)"
ok=0
for _ in $(seq 1 45); do
  if curl -fs --max-time 2 "http://127.0.0.1:$PORT/healthz" | grep -q '"ok"'; then ok=1; break; fi
  sleep 2
done
[[ "$ok" == 1 ]] || die "pas de réponse saine en 90 s — docker compose logs --tail=100 $SERVICE"
# La santé ne prouve pas que le site est servi : on vérifie aussi la page.
curl -fs --max-time 5 "http://127.0.0.1:$PORT/" | grep -q '<urban-archimate' \
  || die "/healthz répond mais la page d'accueil ne contient pas <urban-archimate> — docker compose logs $SERVICE"
echo "Service sain : http://$HOST_IP:$PORT/"

# --- 9. E2E dans le Chromium de browserless ---------------------------------------
# On éprouve le site tel que servi, dans un vrai navigateur. Échec = déploiement
# déclaré en échec (le site tourne, mais il ne fonctionne pas).
step 9 "E2E via browserless (ws://$HOST_IP:$(env_get BROWSERLESS_PORT))"
docker compose --profile tests run --rm \
  -e SITE_URL="http://$HOST_IP:$PORT/" \
  -e BROWSERLESS_WS="ws://$HOST_IP:$(env_get BROWSERLESS_PORT)" \
  -v "$LOG_DIR:/out" \
  tests node test/e2e/site-deploye.mjs /out/e2e-site.png \
  || die "E2E en échec — capture et détail ci-dessus ; docker compose logs $SERVICE"

# --- 10. Déclaration à l'annuaire du portail (best-effort) ------------------------
# Après la santé et l'E2E : on ne publie pas une stack qui ne marche pas. Nom du
# service = nom de la stack. Voie --me : sous le workspace de l'appelant TOTP.
step 10 "Déclaration à l'annuaire"
if [[ -n "${PORTAL_TOKEN:-}" ]]; then
  # Le portail n'accepte qu'une IP du mesh (100.64.0.0/10) ou celle d'une
  # machine qu'il connaît — l'IP LAN est refusée (422).
  ips="$(hostname -I 2>/dev/null)"
  TARGET_HOST="$(tr ' ' '\n' <<<"$ips" | grep -E '^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\.' | head -1)"
  [[ -n "$TARGET_HOST" ]] || TARGET_HOST="$(awk '{print $1}' <<<"$ips")"
  bash "$REPO_DIR/scripts/declarer-exposition.sh" --me \
    --portal "$(env_get EXPOSE_PORTAL_URL)" \
    --workspace "$(env_get EXPOSE_WORKSPACE)" \
    --service "$STACK" \
    --target-host "$TARGET_HOST" \
    --target-port "$PORT" \
    --host "$(hostname)"
else
  echo "PORTAL_TOKEN absent : pas de déclaration (relancer avec un code TOTP et --exposer-seulement)"
fi

# --- 11. Purge disque hebdomadaire (ne fait jamais échouer le déploiement) --------
# Chaque build laisse des couches détaggées que rien ne récupère. Portée limitée
# au cache de build et aux images détaggées ; jamais les volumes ni les images de
# base. Témoin horodaté : au plus une fois par semaine.
step 11 "Purge disque (hebdomadaire)"
if [[ "$EXPOSE_ONLY" == 1 ]]; then
  echo "--exposer-seulement : pas de purge"
elif [[ ! -f "$PRUNE_STAMP" ]] || [[ -n "$(find "$PRUNE_STAMP" -mtime +6 2>/dev/null)" ]]; then
  {
    echo "Avant : $(df -h / | awk 'NR==2{print $4}') libres"
    docker builder prune -f --filter until=168h
    docker image prune -f
    echo "Après : $(df -h / | awk 'NR==2{print $4}') libres"
    touch "$PRUNE_STAMP"
  } || echo "AVERTISSEMENT : purge en échec (déploiement non affecté)"
else
  echo "Dernière purge il y a moins d'une semaine : rien à faire"
fi

echo
echo "Déploiement terminé."
