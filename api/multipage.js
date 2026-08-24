// Audit multi-pages — AccessiCheck v4
// Découverte des pages clés d'un site (contact, produits/services, mentions légales,
// pages principales de navigation) puis scan de chacune avec les moteurs existants.
// Un audit multi-pages = 1 quota (le rate-limit est décompté une fois, à la création
// du scan). Le scan gratuit reste limité à la page d'accueil (différenciation offre).

const { URL } = require('url');
const { getBrowser, scanWithRetry, scanUrl, computeScore } = require('./scanner');

const MAX_PAGES = parseInt(process.env.MULTIPAGE_MAX_PAGES || '5', 10);
const PAGE_SCAN_TIMEOUT_MS = parseInt(process.env.MULTIPAGE_PAGE_TIMEOUT_MS || '90000', 10);

// Mots-clés de priorisation (chemin + texte du lien), par ordre de valeur métier.
const PRIORITY_RULES = [
  { rank: 0, re: /contact|nous-contacter|formulaire/i },
  { rank: 1, re: /service|produit|offre|prestation|tarif|prix|pricing|boutique|shop|solution|realisation|portfolio/i },
  { rank: 2, re: /mentions?[-_ ]?legales?|legal|cgv|cgu|confidentialite|privacy|donnees[-_ ]?personnelles|politique/i },
  { rank: 3, re: /a[-_ ]?propos|about|qui[-_ ]?sommes|equipe|societe|entreprise|notre[-_ ]?histoire/i },
];

const EXCLUDED_EXT = /\.(pdf|jpe?g|png|gif|webp|svg|zip|rar|7z|tar|gz|mp[34]|mov|avi|webm|docx?|xlsx?|pptx?|csv|ics)(\?|#|$)/i;

// Pages de démonstration / exemples : hors périmètre d'audit (contenus fictifs
// publiés à titre d'illustration, ex. notre propre exemple-rapport.html).
const EXCLUDED_DEMO_PATH = /exemple[-_]?rapport|\/demo|\/demos|\/demonstration|\/sample|\/samples|\/example|\/examples|maquette|mockup|kitchen[-_]?sink|style[-_]?guide/i;

function canonicalize(href, baseUrl) {
  let u;
  try {
    u = new URL(href, baseUrl);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(u.protocol)) return null;
  const base = new URL(baseUrl);
  const sameHost = u.hostname.replace(/^www\./, '') === base.hostname.replace(/^www\./, '');
  if (!sameHost) return null;
  u.hostname = base.hostname; // uniformise www / non-www pour la déduplication
  u.hash = '';
  // Paramètres de tracking : inutiles pour l'audit, source de doublons.
  for (const key of [...u.searchParams.keys()]) {
    if (/^utm_|^fbclid$|^gclid$|^mc_/i.test(key)) u.searchParams.delete(key);
  }
  if (EXCLUDED_EXT.test(u.pathname)) return null;
  if (/wp-admin|\/login|\/signin|\/deconnexion|\/logout/i.test(u.pathname)) return null;
  if (EXCLUDED_DEMO_PATH.test(u.pathname)) return null;
  // Normalisation : retire le slash final (sauf racine) pour dédupliquer.
  let out = u.toString();
  if (u.pathname.length > 1 && out.endsWith('/')) out = out.slice(0, -1);
  return out;
}

// Classe les liens internes par pertinence métier. `links` = [{href, text, nav}]
// dans l'ordre du DOM (l'ordre du DOM approxime la priorité de navigation).
function rankLinks(links, baseUrl) {
  const baseCanon = canonicalize(baseUrl, baseUrl);
  const seen = new Set();
  const candidates = [];
  for (const link of links) {
    const canon = canonicalize(link.href, baseUrl);
    if (!canon || canon === baseCanon || seen.has(canon)) continue;
    seen.add(canon);
    const haystack = `${new URL(canon).pathname} ${link.text || ''}`;
    let rank = link.nav ? 4 : 5;
    for (const rule of PRIORITY_RULES) {
      if (rule.re.test(haystack)) { rank = rule.rank; break; }
    }
    candidates.push({ url: canon, rank, nav: !!link.nav });
  }
  // Tri stable : priorité métier, puis ordre d'apparition dans le DOM.
  return candidates
    .map((c, i) => ({ ...c, domIndex: i }))
    .sort((a, b) => (a.rank - b.rank) || (a.domIndex - b.domIndex))
    .map((c) => c.url);
}

// Extrait les liens internes de la page d'accueil (déjà validée chargée).
async function discoverLinks(baseUrl, log = console.log) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setUserAgent('AccessiCheck-Scanner/0.1 (+https://accessicheck.brozapi.com)');
    await page.setCacheEnabled(false); // navigateur mutualise : pas de cache entre scans
    await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: PAGE_SCAN_TIMEOUT_MS });
    const links = await page.evaluate(() => {
      const out = [];
      for (const a of document.querySelectorAll('a[href]')) {
        out.push({
          href: a.href,
          text: (a.innerText || a.textContent || '').trim().slice(0, 80),
          nav: !!a.closest('nav, header, [role="navigation"], [role="menu"]'),
        });
        if (out.length >= 300) break;
      }
      return out;
    });
    return rankLinks(links, baseUrl);
  } catch (err) {
    log('multipage: découverte des liens impossible :', err.message);
    return [];
  } finally {
    try { await page.close(); } catch { /* ignore */ }
  }
}

function pagePath(url, baseUrl) {
  try {
    const u = new URL(url);
    const base = new URL(baseUrl);
    const p = u.pathname + (u.search || '');
    if (u.hostname.replace(/^www\./, '') !== base.hostname.replace(/^www\./, '')) return u.toString();
    return p === '' ? '/' : p;
  } catch {
    return String(url);
  }
}

// Fusionne les issues de toutes les pages : une issue identique (même moteur,
// même règle, même sélecteur) présente sur plusieurs pages n'apparaît qu'une
// fois, avec la liste des pages concernées dans `pages`.
function mergeIssues(pageResults) {
  const map = new Map();
  for (const pr of pageResults) {
    for (const issue of pr.result.issues || []) {
      const key = `${issue.engine}|${issue.id || issue.code || issue.message}|${issue.selector || (issue.nodes && issue.nodes[0] && issue.nodes[0].target ? issue.nodes[0].target.join(',') : '')}`;
      const existing = map.get(key);
      if (existing) {
        if (!existing.pages.includes(pr.path)) existing.pages.push(pr.path);
      } else {
        map.set(key, { ...issue, page: pr.path, pages: [pr.path] });
      }
    }
  }
  return [...map.values()];
}

function mergeSummary(issues) {
  const summary = { total: issues.length, byImpact: {}, byEngine: {}, byLayer: {} };
  for (const issue of issues) {
    const impact = issue.impact || issue.type || 'notice';
    summary.byImpact[impact] = (summary.byImpact[impact] || 0) + 1;
    const engine = issue.engine || 'unknown';
    summary.byEngine[engine] = (summary.byEngine[engine] || 0) + 1;
    const layer = issue.ai ? 'ia' : (issue.layer || 'technique');
    summary.byLayer[layer] = (summary.byLayer[layer] || 0) + 1;
  }
  return summary;
}

// Audit complet d'un site : page d'accueil + jusqu'à MAX_PAGES-1 pages clés.
// L'analyse IA sémantique n'est exécutée que sur la page d'accueil (maîtrise
// des coûts LLM, politique D13) — les autres pages relèvent des moteurs
// déterministes (pa11y + axe + contrôles custom).
async function scanSiteWithRetry(baseUrl, log = console.log) {
  // 1. Page d'accueil (avec retries + analyse IA).
  const home = await scanWithRetry(baseUrl);

  // 2. Découverte des pages clés.
  const extraUrls = (await discoverLinks(baseUrl, log)).slice(0, MAX_PAGES - 1);

  // 3. Scan des pages supplémentaires (1 tentative + 1 retry, tolérance d'échec).
  const pageResults = [{ url: baseUrl, path: '/', result: home, error: null }];
  for (const url of extraUrls) {
    let result = null;
    let lastErr = null;
    for (let attempt = 0; attempt < 2 && !result; attempt++) {
      try {
        result = await scanUrl(url, { log, runSemantic: false });
      } catch (err) {
        lastErr = err;
        if (attempt === 0) await new Promise((r) => setTimeout(r, 1000));
      }
    }
    pageResults.push({
      url,
      path: pagePath(url, baseUrl),
      result,
      error: result ? null : (lastErr && lastErr.message) || 'Scan impossible.',
    });
  }

  // 4. Agrégation.
  const okPages = pageResults.filter((p) => p.result);
  const issues = mergeIssues(okPages);
  const globalScore = okPages.length > 0
    ? Math.round(okPages.reduce((sum, p) => sum + p.result.score, 0) / okPages.length)
    : 0;

  return {
    url: baseUrl,
    pageTitle: home.pageTitle,
    status: home.status,
    score: globalScore,
    summary: mergeSummary(issues),
    issues,
    ai_analysis: home.ai_analysis,
    pages: pageResults.map((p) => ({
      url: p.url,
      path: p.path,
      pageTitle: p.result ? p.result.pageTitle : '',
      score: p.result ? p.result.score : null,
      issuesCount: p.result ? (p.result.issues || []).length : null,
      status: p.result ? 'done' : 'failed',
      error: p.error,
    })),
    pages_count: okPages.length,
    scanned_at: new Date().toISOString(),
    coverage_note:
      `Audit multi-pages : ${okPages.length} page(s) clé(s) analysée(s) (page d'accueil + pages découvertes automatiquement : contact, produits/services, mentions légales, pages principales). ` +
      'Ce scan combine une détection technique automatisée (contraste, structure, ARIA, formulaires, images, liens, navigation clavier — critères RGAA/WCAG) élargie par une analyse IA des textes alternatifs, intitulés de liens et labels de formulaires sur la page d\u2019accueil. La détection automatisée reste partielle : un audit humain reste nécessaire pour une conformité complète.',
  };
}

module.exports = {
  MAX_PAGES,
  canonicalize,
  rankLinks,
  pagePath,
  mergeIssues,
  mergeSummary,
  discoverLinks,
  scanSiteWithRetry,
};
