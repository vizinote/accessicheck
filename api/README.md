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
- `WORKER_SCAN_TIMEOUT_MS` — timeout max d'un scan complet (défaut : 90000)
- `BASE_PATH` — préfixe de route (défaut : ")
- `OPENROUTER_API_KEY` — clé OpenRouter pour l'analyse sémantique IA (via le `.env` monté)
- `SCANNER_LLM_MODEL` — modèle IA d'analyse sémantique (défaut : `deepseek/deepseek-v4-flash`)
- `SCANNER_LLM_TIMEOUT_MS` — timeout de l'appel IA (défaut : 25000)

## Scanner v3 (2026-08-21)

Le scan combine 3 couches de détection, étiquetées dans le rapport :
1. **Technique** (pa11y + axe + checks custom) : contraste, structure, ARIA, formulaires, lang, navigation clavier,
   skip-link, piège de focus, cibles tactiles < 44 px, débordement mobile 390 px, médias sans sous-titres,
   liens PDF, iframes sans titre, absence de déclaration d'accessibilité.
2. **Interaction** : nav clavier simulée, focus visible, skip-link fonctionnel, cibles tactiles, débordement mobile.
3. **IA sémantique** (`api/semantic.js`) : un appel LLM par scan sur un extrait structuré (alt, liens, labels)
   pour juger la pertinence des alternatives, l'explicabilité des intitulés et la clarté des labels/messages.
   Échec gracieux : le scan technique est toujours rendu même si l'IA échoue. Coût cible < 0,005 $/scan.

Le rapport sépare explicitement **Analyse IA** (verdicts à confirmer) et **Détection technique**.

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
