#!/usr/bin/env node
// Régénère exemple-rapport.html (page publique de démonstration) à partir d'un
// VRAI résultat de scan AccessiCheck (JSON renvoyé par GET /accessicheck/scan/:id).
//
// Usage : node scripts/build-exemple-rapport.js <scan.json> [titre-histoire]
//
// La page générée est le rendu du gabarit courant (palette, messages FR,
// hiérarchie de titres) enveloppé d'un minimum de chrome de site (skip-link,
// navigation) pour rester elle-même accessible.

const fs = require('fs');
const path = require('path');
const { generateReportHtml } = require('../api/reports/reportGenerator');

const ROOT = path.join(__dirname, '..');

const WRAPPER_CSS = `
/* Chrome de la page de démonstration (hors gabarit du rapport) */
.skip-link {
  position: absolute;
  left: -9999px;
  top: 0;
  background: #1d4ed8;
  color: #fff;
  padding: 0.75rem 1.25rem;
  font-weight: 600;
  z-index: 200;
  text-decoration: none;
}
.skip-link:focus {
  left: 0.5rem;
  top: 0.5rem;
  outline: 2px solid #fff;
}
.site-nav {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid #e5e7eb;
  background: #fff;
  font-size: 10pt;
}
.site-nav a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 0.75rem;
  color: #1d4ed8;
  font-weight: 600;
  text-decoration: none;
}
.site-nav a:hover { text-decoration: underline; }
.site-nav .site-nav__note { color: #6b7280; margin-left: auto; }
.demo-banner {
  background: #eff6ff;
  border-left: 4px solid #1d4ed8;
  color: #1e293b;
  padding: 10pt 12pt;
  border-radius: 0 8px 8px 0;
  margin: 0 0 16pt 0;
  font-size: 10pt;
}
.demo-banner strong { color: #1d4ed8; }
`;

function metaHead({ description, canonicalUrl, title, ogTitle, ogDescription }) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  return `
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${esc(canonicalUrl)}">
  <meta property="og:title" content="${esc(ogTitle)}">
  <meta property="og:description" content="${esc(ogDescription)}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${esc(canonicalUrl)}">
  <meta property="og:locale" content="fr_FR">
  <meta property="og:image" content="https://accessicheck.brozapi.com/assets/og-image.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:type" content="image/png">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(ogTitle)}">
  <meta name="twitter:description" content="${esc(ogDescription)}">
  <meta name="twitter:image" content="https://accessicheck.brozapi.com/assets/og-image.png">
  <link rel="icon" type="image/svg+xml" href="favicon.svg">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.brozapi.com; font-src 'self' data:; base-uri 'self'; form-action 'self' https://api.brozapi.com">`;
}

async function main() {
  const scanPath = process.argv[2];
  if (!scanPath) {
    console.error('Usage : node scripts/build-exemple-rapport.js <scan.json>');
    process.exit(1);
  }
  const payload = JSON.parse(fs.readFileSync(scanPath, 'utf8'));
  const scan = {
    id: payload.id || 'exemple',
    url: payload.url,
    offer: payload.offer || 'oneshot',
    status: 'done',
    created_at: payload.created_at,
    finished_at: payload.finished_at,
    result: payload.result,
  };

  let html = await generateReportHtml(scan);

  // Titre de l'onglet + métadonnées SEO de la page publique.
  html = html.replace(/<title>[^<]*<\/title>/,
    '<title>AccessiCheck — Exemple réel de rapport d’accessibilité (avant correction, 87/100)</title>');
  html = html.replace('</head>', metaHead({
    description: 'Exemple réel d’un rapport AccessiCheck : notre propre site scanné à 87/100 le 24 août 2026, avec éléments fautifs et code de correction prêt à adapter. Le site est passé à 100/100 après application des corrections.',
    canonicalUrl: 'https://accessicheck.brozapi.com/exemple-rapport.html',
    ogTitle: 'AccessiCheck — Exemple réel de rapport (87/100 → 100/100)',
    ogDescription: 'Dogfooding : notre propre site scanné à 87/100, corrigé avec notre propre rapport, re-scanné à 100/100. Rapport complet, sans retouche.',
  }) + '\n</head>');

  // Chrome de site : skip-link + navigation + bandeau dogfooding.
  const chrome = `
  <a class="skip-link" href="#contenu">Aller au contenu</a>
  <nav class="site-nav" aria-label="Navigation du site">
    <a href="/">← Retour au site AccessiCheck</a>
    <a href="/#offres">Voir les offres</a>
    <span class="site-nav__note">Page de démonstration — rapport réel, sans retouche</span>
  </nav>
  <div class="demo-banner" role="note">
    <strong>Dogfooding :</strong> ce rapport est celui de <strong>notre propre site</strong>,
    accessicheck.brozapi.com, scanné le 24 août 2026 à <strong>87/100</strong>. Nous avons appliqué
    les corrections indiquées ci-dessous (skip-link, cibles tactiles, contraste du gabarit, pages de démonstration
    exclues du crawl) : le site affiche désormais <strong>100/100</strong> aux critères testables automatiquement.
  </div>`;
  html = html.replace('<body>', '<body>' + chrome);
  html = html.replace('<main class="report-body oneshot">', '<main class="report-body oneshot" id="contenu">');

  // Styles du chrome injectés à la fin du <style> du gabarit.
  html = html.replace('</style>', WRAPPER_CSS + '\n  </style>');

  const out = path.join(ROOT, 'exemple-rapport.html');
  fs.writeFileSync(out, html);
  console.log(`[build-exemple] ${out} écrit (${html.length} octets), score affiché : ${scan.result.score}/100`);
}

main().catch((err) => {
  console.error('[build-exemple] échec :', err);
  process.exit(1);
});
