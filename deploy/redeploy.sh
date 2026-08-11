#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/opt/data/repos/accessicheck"
CADDYFILE="/etc/caddy/Caddyfile"
PUBLIC_URL="https://api.brozapi.com/accessicheck"
ACTIVE_PORT_FILE="/root/.accessicheck-active-port"
PROJECT_NAME="accessicheck"
SERVICE_NAME="accessicheck-api"
IMAGE_NAME="${PROJECT_NAME}-${SERVICE_NAME}:latest"

cd "$REPO_DIR"

echo "=== git safe directory ==="
git config --global --add safe.directory "$REPO_DIR" || true

echo "=== git pull ==="
git fetch origin
git reset --hard origin/main
git pull origin main

echo "=== docker compose build ==="
if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif docker-compose version >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  echo "ERREUR: docker compose non trouvé"
  exit 1
fi

$COMPOSE -p "$PROJECT_NAME" build

echo "=== determine active / alternate port ==="
CURRENT_PORT=8081
OTHER_PORT=8082
if [ -f "$ACTIVE_PORT_FILE" ]; then
  CURRENT_PORT=$(cat "$ACTIVE_PORT_FILE")
  if [ "$CURRENT_PORT" = "8081" ]; then OTHER_PORT=8082; else OTHER_PORT=8081; fi
fi
echo "current port: $CURRENT_PORT, alternate port: $OTHER_PORT"

echo "=== start new container on port $OTHER_PORT ==="
docker rm -f "${SERVICE_NAME}-next" >/dev/null 2>&1 || true

if ! docker image inspect "$IMAGE_NAME" >/dev/null 2>&1; then
  echo "ERREUR: image $IMAGE_NAME introuvable"
  exit 1
fi

docker run -d --name "${SERVICE_NAME}-next" \
  --network badgeia-net \
  -v accessicheck-data:/data \
  -e DATABASE_PATH=/data/scans.db \
  -e SCAN_TIMEOUT=30000 \
  -e MAX_RETRIES=2 \
  -e WORKER_SCAN_TIMEOUT_MS=120000 \
  -e PORT=8080 \
  -e BASE_PATH= \
  -p "127.0.0.1:${OTHER_PORT}:8080" \
  --restart unless-stopped \
  "$IMAGE_NAME"

echo "=== healthcheck new container ==="
for i in {1..30}; do
  if curl -fsS "http://127.0.0.1:${OTHER_PORT}/health" >/dev/null 2>&1; then
    echo "new container health OK"
    break
  fi
  sleep 2
done

if ! curl -fsS "http://127.0.0.1:${OTHER_PORT}/health"; then
  echo "ERREUR: healthcheck du nouveau conteneur échoué"
  docker logs "${SERVICE_NAME}-next" --tail 30 || true
  docker rm -f "${SERVICE_NAME}-next" >/dev/null 2>&1 || true
  exit 1
fi

echo "=== switch Caddy to port $OTHER_PORT ==="
cp "$CADDYFILE" "$CADDYFILE.bak.$(date +%s)"
sed -i '/handle_path \/accessicheck\//,/^    }/s/reverse_proxy 127\.0\.0\.1:[0-9]*/reverse_proxy 127.0.0.1:'"${OTHER_PORT}"'/' "$CADDYFILE"

if docker ps --format '{{.Names}}' | grep -q '^caddy$'; then
  docker exec caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
elif command -v caddy >/dev/null 2>&1; then
  caddy reload --config "$CADDYFILE"
else
  echo "ERREUR: Caddy non trouvé pour rechargement"
  docker rm -f "${SERVICE_NAME}-next" >/dev/null 2>&1 || true
  exit 1
fi

echo "$OTHER_PORT" > "$ACTIVE_PORT_FILE"

echo "=== stop and remove old container ==="
if docker ps -a --format '{{.Names}}' | grep -q "^${SERVICE_NAME}$"; then
  docker stop "$SERVICE_NAME" >/dev/null || true
  docker rm -f "$SERVICE_NAME" >/dev/null || true
fi

echo "=== rename new container to canonical name ==="
docker rename "${SERVICE_NAME}-next" "$SERVICE_NAME"

echo "=== public health after switch ==="
curl -fsS "${PUBLIC_URL}/health"
echo

echo "=== test scan ==="
SCAN_RESPONSE=$(curl -fsS -X POST "${PUBLIC_URL}/scan" -H 'Content-Type: application/json' -d '{"url":"https://example.com","offer":"oneshot"}')
SCAN_ID=$(echo "$SCAN_RESPONSE" | python3 -c 'import sys,json; print(json.load(sys.stdin)["id"])')
echo "scan id: $SCAN_ID"
for i in {1..60}; do
  RESULT=$(curl -fsS "${PUBLIC_URL}/result/${SCAN_ID}")
  STATUS=$(echo "$RESULT" | python3 -c 'import sys,json; print(json.load(sys.stdin)["status"])')
  echo "($i) $STATUS"
  if [ "$STATUS" = "done" ] || [ "$STATUS" = "failed" ]; then
    break
  fi
  sleep 3
done

echo "=== containers ==="
docker ps --filter name=accessicheck --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

echo "=== redeploy OK ==="
