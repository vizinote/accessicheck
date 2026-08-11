#!/usr/bin/env bash
set -euo pipefail

CADDYFILE="/etc/caddy/Caddyfile"
REPO_DIR="/opt/data/repos/accessicheck"

echo "=== Caddyfile ==="
if [ ! -f "$CADDYFILE" ]; then
  echo "AVERTISSEMENT: $CADDYFILE introuvable"
  exit 0
fi

CHANGED=0

# Route API /accessicheck
if ! grep -q "handle_path /accessicheck" "$CADDYFILE"; then
  echo "Ajout de la route /accessicheck dans $CADDYFILE"
  cp "$CADDYFILE" "$CADDYFILE.bak.$(date +%s)"
  sed -i '/^api\.brozapi\.com {/a\\n    handle_path /accessicheck/* {\n        reverse_proxy 127.0.0.1:8081\n    }\n' "$CADDYFILE"
  CHANGED=1
else
  echo "Route /accessicheck déjà présente"
fi

# Site accessicheck.brozapi.com
# On ne l'active localement que si le DNS pointe vers ce serveur.
LOCAL_IPS=$(hostname -I 2>/dev/null || true)
ACCESSI_IPS=$(dig +short accessicheck.brozapi.com A 2>/dev/null || true)
DNS_POINTS_HERE=0
for ip in $ACCESSI_IPS; do
  if echo " $LOCAL_IPS " | grep -q " $ip "; then
    DNS_POINTS_HERE=1
    break
  fi
done

if [ "$DNS_POINTS_HERE" = "1" ] && ! grep -q "^accessicheck\.brozapi\.com {" "$CADDYFILE"; then
  echo "Ajout du site accessicheck.brozapi.com dans $CADDYFILE"
  cp "$CADDYFILE" "$CADDYFILE.bak.$(date +%s)"
  cat >> "$CADDYFILE" <<EOF

accessicheck.brozapi.com {
    # Reverse proxy vers GitHub Pages (vizinote.github.io)
    # si les fichiers statiques locaux ne sont pas utilisés.
    # Pour servir les fichiers locaux du repo, remplacer reverse_proxy par :
    #   root * ${REPO_DIR}
    #   file_server
    reverse_proxy https://vizinote.github.io {
        header_up Host accessicheck.brozapi.com
    }

    header {
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        Referrer-Policy strict-origin-when-cross-origin
        X-XSS-Protection "1; mode=block"
        -Server
    }
}
EOF
  CHANGED=1
else
  echo "DNS accessicheck.brozapi.com ne pointe pas vers ce serveur (GitHub Pages direct) ; site Caddy non ajouté"
fi

if [ "$CHANGED" = "1" ]; then
  if docker ps --format '{{.Names}}' | grep -q '^caddy$'; then
    docker exec caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
  elif command -v caddy >/dev/null 2>&1; then
    caddy reload --config "$CADDYFILE"
  else
    echo "AVERTISSEMENT: Caddy n'a pas pu être rechargé automatiquement"
  fi
else
  echo "Aucun changement Caddy"
fi
