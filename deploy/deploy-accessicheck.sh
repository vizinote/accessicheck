#!/usr/bin/env bash
set -euo pipefail

REPO_DIR=$(realpath /opt/data/kanban/boards/brozapi/workspaces/t_6919bda8)
CADDYFILE="/etc/caddy/Caddyfile"
PUBLIC_URL="https://api.brozapi.com/accessicheck"

cd "$REPO_DIR"

echo "=== git safe directory ==="
git config --global --add safe.directory "$REPO_DIR" || true

echo "=== git pull ==="
git reset --hard origin/main
git pull origin main

echo "=== docker compose build & up ==="
if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif docker-compose version >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  echo "ERREUR: docker compose non trouvé"
  exit 1
fi

$COMPOSE -f docker-compose.yml down
docker rm -f accessicheck-api >/dev/null 2>&1 || true
$COMPOSE -f docker-compose.yml up -d --build

echo "=== attente health ==="
for i in {1..30}; do
  if curl -fsS http://127.0.0.1:8081/health >/dev/null 2>&1; then
    echo "health OK"
    break
  fi
  sleep 2
done

curl -fsS http://127.0.0.1:8081/health || { echo "ERREUR: healthcheck failed"; exit 1; }

echo "=== Caddyfile ==="
if [ -f "$CADDYFILE" ]; then
  if ! grep -q "accessicheck" "$CADDYFILE"; then
    echo "Ajout de la route /accessicheck dans $CADDYFILE"
    cp "$CADDYFILE" "$CADDYFILE.bak.$(date +%s)"
    sed -i '/^api\.brozapi\.com {/a\\n    handle_path /accessicheck/* {\n        reverse_proxy 127.0.0.1:8081\n    }\n' "$CADDYFILE"
    if docker ps --format '{{.Names}}' | grep -q '^caddy$'; then
      docker exec caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
    elif command -v caddy >/dev/null 2>&1; then
      caddy reload --config "$CADDYFILE"
    else
      echo "AVERTISSEMENT: Caddy n'a pas pu être rechargé automatiquement"
    fi
  else
    echo "Route /accessicheck déjà présente"
  fi
else
  echo "AVERTISSEMENT: $CADDYFILE introuvable"
fi

echo "=== test scan example.com ==="
SCAN_RESPONSE=$(curl -fsS -X POST "${PUBLIC_URL}/scan" -H 'Content-Type: application/json' -d '{"url":"https://example.com","offre":"oneshot"}')
echo "scan response: $SCAN_RESPONSE"
SCAN_ID=$(echo "$SCAN_RESPONSE" | python3 -c 'import sys,json; print(json.load(sys.stdin)["id"])')
echo "scan id: $SCAN_ID"

for i in {1..60}; do
  RESULT=$(curl -fsS "${PUBLIC_URL}/result/${SCAN_ID}")
  STATUS=$(echo "$RESULT" | python3 -c 'import sys,json; print(json.load(sys.stdin)["status"])')
  echo "($i) status: $STATUS"
  if [ "$STATUS" = "done" ] || [ "$STATUS" = "failed" ]; then
    echo "result: $RESULT"
    break
  fi
  sleep 3
done

echo "=== conteneurs ==="
docker ps --filter name=accessicheck --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

echo "=== fin ==="
