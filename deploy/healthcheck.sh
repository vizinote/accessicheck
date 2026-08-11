#!/usr/bin/env bash
set -uo pipefail

PUBLIC_URL="https://api.brozapi.com/accessicheck"
LANDING_URL="https://accessicheck.brozapi.com"
ERR=0

HEALTH=$(curl -fsS "${PUBLIC_URL}/health" 2>/dev/null || true)
if [ -z "$HEALTH" ]; then
  echo "[FAIL] API health ne répond pas sur ${PUBLIC_URL}/health"
  ERR=1
else
  echo "[OK] API health: $HEALTH"
fi

if ! curl -fsSI "${LANDING_URL}/" >/dev/null 2>&1; then
  echo "[FAIL] Landing ${LANDING_URL}/ ne répond pas"
  ERR=1
else
  echo "[OK] Landing ${LANDING_URL}/ répond"
fi

if docker ps --format '{{.Names}}' | grep -q '^accessicheck-api$'; then
  echo "[OK] Conteneur accessicheck-api est en cours d'exécution"
else
  echo "[FAIL] Conteneur accessicheck-api non trouvé"
  ERR=1
fi

exit "$ERR"
