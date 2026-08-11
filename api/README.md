# AccessiCheck API

API HTTP d'audit d'accessibilité AccessiCheck.

## Endpoints

- `GET /health` — vérification de santé.
- `POST /scan` — crée un scan.
  - Body : `{ "url": "https://example.com", "offre": "oneshot" }`
  - `offre` accepte : `oneshot`, `pro`, `monitoring`
  - Réponse `201` : `{ "ok": true, "id": "...", "status": "pending" }`
- `GET /result/:id` — récupère le résultat.
  - En cours : `{ "status": "pending" }` ou `{ "status": "running" }`
  - Terminé : `{ "status": "done", "result": { ... } }`
  - Échec : `{ "status": "failed", "error": "..." }`

## Variables d'environnement

- `PORT` (défaut : 8080)
- `DATABASE_PATH` (défaut : `./data/scans.db`)
- `SCAN_TIMEOUT` — timeout de scan en ms (défaut : 30000)
- `MAX_RETRIES` — tentatives de retry (défaut : 2)
- `BASE_PATH` — préfixe de route (défaut : ")

## Développement

```bash
cd api
npm install
npm test
DATABASE_PATH=/tmp/scans.db PORT=9090 node server.js
```

## Docker

```bash
docker build -t accessicheck-api ./api
docker run -p 8080:8080 -v accessicheck-data:/data accessicheck-api
```

Ou avec docker-compose (nécessite le réseau `badgeia-net`) :

```bash
docker network create badgeia-net
docker compose up -d accessicheck-api
```
