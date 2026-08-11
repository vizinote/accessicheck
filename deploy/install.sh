#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/opt/data/repos/accessicheck"
CADDYFILE="/etc/caddy/Caddyfile"
BACKUP_DIR="/opt/data/backups/accessicheck"
PROJECT_NAME="accessicheck"

echo "=== dépendances ==="
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y git curl docker.io docker-compose-plugin jq || true

systemctl enable --now docker || true

echo "=== réseau Docker ==="
docker network create badgeia-net >/dev/null 2>&1 || true

echo "=== clone du repo ==="
mkdir -p /opt/data/repos
if [ ! -d "$REPO_DIR/.git" ]; then
  git clone https://github.com/vizinote/accessicheck.git "$REPO_DIR"
fi
cd "$REPO_DIR"
git config --global --add safe.directory "$REPO_DIR" || true
git fetch origin
git reset --hard origin/main
git pull origin main

echo "=== déploiement initial ==="
if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif docker-compose version >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  echo "ERREUR: docker compose non trouvé"
  exit 1
fi
$COMPOSE -p "$PROJECT_NAME" up -d --build

echo "=== configuration Caddy ==="
"$REPO_DIR/deploy/configure-caddy.sh"

echo "=== répertoire de sauvegardes ==="
mkdir -p "$BACKUP_DIR"

echo "=== installation des scripts d'opération dans /root ==="
cp -f "$REPO_DIR/deploy/redeploy.sh" /root/accessicheck-redeploy.sh
cp -f "$REPO_DIR/deploy/healthcheck.sh" /root/accessicheck-healthcheck.sh
cp -f "$REPO_DIR/deploy/backup.sh" /root/accessicheck-backup.sh
chmod 700 /root/accessicheck-*.sh

echo "=== cron healthcheck + backup ==="
( crontab -l 2>/dev/null | grep -v accessicheck || true
  echo "*/5 * * * * /root/accessicheck-healthcheck.sh >> /var/log/accessicheck-health.log 2>&1"
  echo "0 3 * * * /root/accessicheck-backup.sh >> /var/log/accessicheck-backup.log 2>&1"
) | crontab -

echo "[OK] AccessiCheck installé / mis à jour"
echo "    API : https://api.brozapi.com/accessicheck/health"
echo "    Site : https://accessicheck.brozapi.com"
