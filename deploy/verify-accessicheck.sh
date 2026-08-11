#!/usr/bin/env bash
set -euo pipefail

PUBLIC_URL="https://api.brozapi.com/accessicheck"
SCAN_ID="8f162228227abad3455739bb"

echo "=== vérification HTTPS ==="
curl -fsSI "${PUBLIC_URL}/health" | head -5
HEALTH=$(curl -fsS "${PUBLIC_URL}/health")
echo "health public: $HEALTH"

echo "=== redémarrage conteneur ==="
docker restart accessicheck-api
sleep 5

echo "=== vérification persistance du scan ${SCAN_ID} ==="
RESULT=$(curl -fsS "${PUBLIC_URL}/result/${SCAN_ID}")
echo "result: $RESULT"

echo "=== health après redémarrage ==="
curl -fsS "${PUBLIC_URL}/health"
echo

echo "=== statut conteneur ==="
docker ps --filter name=accessicheck --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
