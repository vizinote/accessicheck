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
- `WORKER_SCAN_TIMEOUT_MS` — timeout max d'un scan mono-page (défaut : 90000)
- `MULTIPAGE_SCAN_TIMEOUT_MS` — timeout max d'un audit multi-pages (défaut : 420000)
- `MULTIPAGE_MAX_PAGES` — nombre max de pages auditées (défaut : 5)
- `MULTIPAGE_PAGE_TIMEOUT_MS` — timeout de chargement par page (défaut : 90000)
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

### Rapport « Corrections prêtes à coller » (v3.1)

Le rapport enrichi affiche, pour les 5 problèmes les plus fréquents du site
(occurrences mesurées + présence sur plusieurs pages, à impact égal) :
- la liste des **éléments fautifs** : sélecteur CSS + extrait HTML échappé (cap 5
  éléments / issue, « + N autres » au-delà) ;
- un encadré **« Comment corriger »** avec un **avant/après** de code corrigé,
  généré DÉTERMINISTEMENT par gabarit par règle axe (`image-alt`, `color-contrast`
  avec couleurs mesurées + suggestion de ratio, `label`, `button-name`,
  `html-has-lang`…) — `api/reports/corrections.js`.

Règles métier :
- **Aucun texte LLM brut** : les gabarits sont pré-écrits et validés, seules les
  données mesurées (sélecteurs, valeurs, URLs) sont injectées.
- **Sécurité** : tout snippet/HTML du site scanné est échappé via `escapeHtml`
  (anti-injection). Aucun script issu du site audité n'est interprété.
- **IA sémantique** : conserver le disclaimer « à confirmer par un expert humain »
  pour les détections sémantiques `ai: true`.

Le scanner remonte désormais aussi les mesures brutes des noeuds axe (`data` :
`fgColor`, `bgColor`, `contrastRatio`, `fontSize`, `expectedContrastRatio`…) et les
sélecteurs/HTML des checks custom (cibles tactiles, champs sans label, tabindex
positif) pour alimenter ces gabarits.

## Rapport v4 (2026-08-24) — multi-pages + RGAA explicite

1. **Audit multi-pages** (`api/multipage.js`) : les offres payantes (`oneshot`,
   `pro`, `monitoring`) auditent la page d'accueil + jusqu'à 4 pages clés
   découvertes automatiquement (priorité : contact → produits/services →
   mentions légales → pages principales de navigation). Le scan **gratuit**
   reste limité à la page d'accueil. Le quota (10 scans/h/IP) est décompté
   UNE fois à la création du scan : 1 audit multi-pages = 1 quota.
   - Résultat : `pages[]` (score par page), `score` global = moyenne,
     `issues` fusionnées avec attribution `pages` par problème.
   - L'analyse IA sémantique ne tourne que sur la page d'accueil (coût D13).
   - Timeout worker multi-pages : `MULTIPAGE_SCAN_TIMEOUT_MS` (420 s).
2. **Mapping RGAA 4.1 explicite** (`api/reports/rgaa.js`) : grille de
   correspondance WCAG 2.1 ↔ RGAA 4.1.2 (106 critères) figée et testée.
   Chaque problème du rapport est annoté (colonne « RGAA 4.1 ») et une
   section « Correspondance RGAA 4.1 » regroupe les critères en échec par
   thématique avec les pages concernées. Les règles sans équivalent RGAA
   (WCAG 2.2, ex : 2.5.8) et l'obligation de déclaration (art. 47) sont
   signalées comme hors grille. Les références `rgaa` des checks custom du
   scanner ont été corrigées (lang → 8.3, skip-link → 12.7, contrastes → 3.2…).
3. **Corrections prêtes à coller** : tri par fréquence (éléments fautifs +
   pages touchées), top 5, code avant/après dont couleur de contraste
   corrigée passant 4,5:1.

Compatibilité monitoring : `accessicheck-monthly.py` et
`accessicheck-deliveries.py` consomment `result.score` / `result.summary.total`
(champs inchangés) ; leurs timeouts d'attente ont été portés à 480 s.

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
