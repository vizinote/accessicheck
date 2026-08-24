const puppeteer = require('puppeteer');
const pa11y = require('pa11y');
const { AxePuppeteer } = require('@axe-core/puppeteer');
const crypto = require('crypto');
const { URL } = require('url');
const { runSemanticAnalysis } = require('./semantic');

const SCAN_TIMEOUT = parseInt(process.env.SCAN_TIMEOUT || '30000', 10);
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '2', 10);
const USER_AGENT = 'AccessiCheck-Scanner/0.1 (+https://accessicheck.brozapi.com)';

let browserInstance = null;

async function getBrowser() {
  if (browserInstance && browserInstance.process() !== null) {
    return browserInstance;
  }
  browserInstance = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  });
  return browserInstance;
}

function generateId() {
  return crypto.randomBytes(12).toString('hex');
}

function isPrivateUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    const hostname = parsed.hostname.toLowerCase();
    if (['localhost', '127.0.0.1', '0.0.0.0', '[::1]'].includes(hostname)) return true;
    if (hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.')) {
      const second = parseInt(hostname.split('.')[1], 10);
      if (hostname.startsWith('172.') && second >= 16 && second <= 31) return true;
      if (hostname.startsWith('192.168.') || hostname.startsWith('10.')) return true;
    }
    return false;
  } catch {
    return true;
  }
}

function normalizeUrl(url) {
  url = (url || '').trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  try {
    const parsed = new URL(url);
    return parsed.toString();
  } catch {
    return url;
  }
}

function validateUrl(url) {
  if (!url) return 'URL manquante.';
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return 'Protocole non autorisé.';
    if (!parsed.hostname || !parsed.hostname.includes('.')) return 'Nom de domaine invalide.';
    if (isPrivateUrl(url)) return 'Adresse locale ou privée non autorisée.';
  } catch {
    return 'URL invalide.';
  }
  return null;
}

async function runPa11y(browser, url) {
  const results = await pa11y(url, {
    browser,
    timeout: SCAN_TIMEOUT,
    userAgent: USER_AGENT,
    standard: 'WCAG2AA',
    runners: ['axe', 'htmlcs'],
    ignoreUrl: true,
    chromeLaunchConfig: {
      ignoreHTTPSErrors: true,
    },
  });
  return results.issues.map((issue) => ({
    engine: 'pa11y',
    code: issue.code,
    type: issue.type,
    typeCode: issue.typeCode,
    message: issue.message,
    context: issue.context,
    selector: issue.selector,
    runner: issue.runner,
    standard: 'WCAG2AA',
  }));
}

async function runAxe(page) {
  const axeResults = await new AxePuppeteer(page)
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  const violations = axeResults.violations || [];
  return violations.map((v) => ({
    engine: 'axe',
    id: v.id,
    impact: v.impact,
    tags: v.tags,
    description: v.description,
    help: v.help,
    helpUrl: v.helpUrl,
    nodes: v.nodes.map((n) => {
      // Mesures brutes fournies par axe (couleurs, ratio, tailles…)
      // => alimente les gabarits de correction déterministes du rapport.
      const anyData = (n.any || []).filter((c) => c && c.data && Object.keys(c.data).length > 0)
        .map((c) => c.data);
      const allData = (n.all || []).filter((c) => c && c.data && Object.keys(c.data).length > 0)
        .map((c) => c.data);
      const data = anyData[0] || allData[0] || null;
      return {
        target: n.target,
        html: n.html,
        failureSummary: n.failureSummary,
        data,
      };
    }),
  }));
}

// Textes de lien non explicites (WCAG 2.4.4) : "cliquez ici", "en savoir plus", etc.
const VAGUE_LINK_TEXTS = new Set([
  'cliquez ici', 'click here', 'cliquez', 'ici', 'en savoir plus', 'learn more',
  'lire la suite', 'read more', 'suite', 'plus d\'infos', 'plus', 'more',
  'télécharger ici', 'download here', 'suivre ce lien', 'suivre', 'go', 'continue',
]);

function isVagueLinkText(text) {
  const t = (text || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.…!?]+$/, '').trim();
  return VAGUE_LINK_TEXTS.has(t);
}

// ---------------------------------------------------------------------------
// Couche v3 — DÉTECTIONS CONTENU (statiques)
// ---------------------------------------------------------------------------
async function runContentChecks(page) {
  const checks = [];

  // 1. Médias video/audio sans sous-titres ni transcription
  const media = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('video, audio'));
    return els.map((m) => {
      const hasTrack = !!m.querySelector('track[kind="captions"], track[kind="subtitles"], track[kind="descriptions"]');
      const container = m.closest('figure, .media, section, div') || m;
      const hasTranscriptionLink = !!(container.querySelector('a[href$=".vtt"], a[href$=".txt"], a[href$=".docx"], a[href$=".pdf"]'));
      const src = m.currentSrc || m.getAttribute('src') || (m.querySelector('source') || {}).src || '';
      return { tag: m.tagName.toLowerCase(), hasTrack, hasTranscriptionLink, src: src.slice(0, 60) };
    });
  });
  const mediaNoSubs = media.filter((m) => m.hasTrack === false && m.hasTranscriptionLink === false);
  if (mediaNoSubs.length > 0) {
    checks.push({
      engine: 'custom',
      id: 'media-missing-subtitles',
      impact: 'moderate',
      message: `${mediaNoSubs.length} média(s) (vidéo/audio) sans piste de sous-titres/audiodescription ni lien de transcription.`,
      wcag: '1.2.2',
      rgaa: '4.3',
      count: mediaNoSubs.length,
      layer: 'contenu',
    });
  }

  // 2. Liens vers des PDF (documents probablement non accessibles)
  // RGAA 13.3 : un PDF n'est un problème que s'il n'existe pas de version
  // accessible. Si la page propose à côté du lien PDF une version HTML /
  // « en ligne » du même document, le lien n'est pas signalé.
  const pdfLinks = await page.evaluate(() => {
    const out = [];
    for (const a of document.querySelectorAll('a[href]')) {
      const h = (a.getAttribute('href') || '').toLowerCase();
      if (/\.pdf\b|\.pdf\?/.test(h)) {
        const container = a.closest('article, section, li, td, div, p') || a.parentElement;
        let hasHtmlAlternative = false;
        if (container) {
          for (const other of container.querySelectorAll('a[href]')) {
            if (other === a) continue;
            const oh = (other.getAttribute('href') || '').toLowerCase();
            const ot = (other.innerText || '').toLowerCase();
            const isHtmlPage = /\.html?\b|\/$|^\/[^.]*$/.test(oh) && !/\.pdf\b/.test(oh);
            if (isHtmlPage && /en ligne|version html|version accessible|html/i.test(ot)) {
              hasHtmlAlternative = true;
              break;
            }
          }
        }
        out.push({ text: (a.innerText || '').trim().slice(0, 60), href: (a.getAttribute('href') || '').slice(0, 80), hasHtmlAlternative });
        if (out.length >= 12) break;
      }
    }
    return out;
  });
  const flaggedPdfLinks = pdfLinksWithoutAlternative(pdfLinks);
  if (flaggedPdfLinks.length > 0) {
    const examples = flaggedPdfLinks.map((l) => `"${l.text || l.href}"`).join(', ');
    checks.push({
      engine: 'custom',
      id: 'pdf-links',
      impact: 'minor',
      message: `${flaggedPdfLinks.length} lien(s) vers un fichier PDF détecté(s) sans version accessible équivalente (ex : ${examples}). PDF probablement non accessible, à vérifier — ou proposez une version HTML à côté du lien.`,
      wcag: '1.1.1',
      rgaa: '13.3',
      count: flaggedPdfLinks.length,
      samples: flaggedPdfLinks.map((l) => l.href),
      layer: 'contenu',
    });
  }

  // 3. Absence de déclaration d'accessibilité (obligation RGAA)
  const hasStatement = await page.evaluate(() => {
    const body = document.body ? document.body.innerHTML : '';
    if (/d[ée]claration\s+d['’]accessibilit[ée]/i.test(body)) return true;
    for (const a of document.querySelectorAll('a[href]')) {
      const h = (a.getAttribute('href') || '');
      const t = (a.innerText || '');
      if (h.toLowerCase().includes('accessibilite') || h.toLowerCase().includes('accessibility') || /accessibilit/i.test(t)) return true;
    }
    return false;
  });
  if (!hasStatement) {
    checks.push({
      engine: 'custom',
      id: 'accessibility-statement-missing',
      impact: 'moderate',
      message: `Aucune page ou lien « Déclaration d'accessibilité » détecté. Obligation RGAA pour les services concernés (art. 47 de la loi pour une République numérique).`,
      wcag: '2.4.1',
      rgaa: null,
      layer: 'contenu',
    });
  }

  // 4. iframes sans titre
  const iframesNoTitle = await page.evaluate(() => {
    const out = [];
    for (const f of document.querySelectorAll('iframe')) {
      const title = (f.getAttribute('title') || '').trim();
      const aria = (f.getAttribute('aria-label') || '').trim();
      if (!title && !aria) out.push((f.getAttribute('src') || '').slice(0, 80));
      if (out.length >= 8) break;
    }
    return out;
  });
  if (iframesNoTitle.length > 0) {
    checks.push({
      engine: 'custom',
      id: 'iframe-no-title',
      impact: 'serious',
      message: `${iframesNoTitle.length} iframe(s) sans titre (attribut title ou aria-label absent). Donner à chaque iframe un titre décrivant son contenu.`,
      wcag: '4.1.2',
      rgaa: '2.1',
      count: iframesNoTitle.length,
      layer: 'contenu',
    });
  }

  return checks;
}

// ---------------------------------------------------------------------------
// Couche v3 — TESTS D'INTERACTION (clavier, focus, cibles tactiles, mobile)
// ---------------------------------------------------------------------------
async function runInteractionChecks(page, log = console.log) {
  const checks = [];

  try {
    // 5. Présence d'un skip-link fonctionnel (cible existante)
    const skip = await page.evaluate(() => {
      for (const a of document.querySelectorAll('a[href^="#"]')) {
        const err = (a.innerText || a.getAttribute('aria-label') || '').trim();
        const t = (err || '').toLowerCase();
        if (/skip|aller (au|vers)|contenu|principal/.test(t) && err.length < 60) {
          const href = a.getAttribute('href') || '';
          const target = href.length > 1 && href !== '#' ? document.querySelector(href) : null;
          return { text: err.slice(0, 40), href, hasTarget: !!target };
        }
      }
      return null;
    });
    if (!skip) {
      checks.push({
        engine: 'custom',
        id: 'skip-link-missing',
        impact: 'serious',
        message: 'Aucun lien d\'évitement (skip-link) détecté : permettre d\'atteindre directement le contenu principal sans repasser la navigation.',
        wcag: '2.4.1',
        rgaa: '12.7',
        layer: 'interaction',
      });
    } else if (!skip.hasTarget) {
      checks.push({
        engine: 'custom',
        id: 'skip-link-broken',
        impact: 'moderate',
        message: `Le lien d'évitement « ${skip.text} » pointe vers « ${skip.href} » dont la cible n'existe pas.`,
        wcag: '2.4.1',
        rgaa: '12.7',
        layer: 'interaction',
      });
    }

    // 6. Simulation clavier (focus visible + piège de focus)
    const totalFocusables = await page.evaluate(() => {
      return Array.from(
        document.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]')
      ).filter((el) => {
        const cs = getComputedStyle(el);
        return cs.display !== 'none' && cs.visibility !== 'hidden' && el.getClientRects().length > 0;
      }).length;
    });

    const KB_STEPS = Math.min(totalFocusables || 0, 25);
    let trap = false;
    let trapLabel = '';
    let focusNotVisible = false;
    let focusLabel = '';
    let lastKey = '';
    let repeats = 0;

    for (let i = 0; i < KB_STEPS; i++) {
      await page.keyboard.press('Tab').catch(() => {});
      const active = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        // les champs de saisie ont un repère de focus natif (bordure/caret) : on ne les évalue pas ici
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return null;
        const cs = getComputedStyle(el);
        const hasOutline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
        const text = (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 20) || el.tagName || '';
        return { tag: el.tagName, text, outline: hasOutline };
      });
      if (!active) continue;
      const key = active.tag + ':' + active.text;
      if (key === lastKey) { repeats += 1; } else { repeats = 0; lastKey = key; }
      if (repeats >= 5) { trap = true; trapLabel = key; break; }
      if (!active.outline && !focusNotVisible) { focusNotVisible = true; focusLabel = key; }
    }

    if (trap) {
      checks.push({
        engine: 'custom', id: 'focus-trap', impact: 'serious',
        message: `Piège de focus possible : la navigation clavier semble bloquée sur « ${trapLabel} ». On doit pouvoir sortir de chaque zone au clavier.`,
        wcag: '2.1.2', rgaa: '12.9', layer: 'interaction',
      });
    }
    if (focusNotVisible && KB_STEPS > 0) {
      checks.push({
        engine: 'custom', id: 'focus-not-visible', impact: 'moderate',
        message: `Indicateur de focus visible incertain sur « ${focusLabel} » : l'élément recevant le focus n'affiche pas de contour (outline) visible.`,
        wcag: '2.4.7', rgaa: '10.7', layer: 'interaction',
      });
    }

    // 7. Cibles tactiles < 44 px (hors liens d'évitement cachés/offscreen)
    const smallTargets = await page.evaluate(() => {
      const info = (el) => {
        if (!el) return { target: '', html: '' };
        const parts = [];
        let node = el;
        while (node && node !== document.documentElement) {
          let sel = '';
          if (node.id) { sel = '#' + String(node.id).replace(/[^a-zA-Z0-9_-]/g, '_'); }
          else if (node.classList && node.classList.length) { sel = '.' + Array.from(node.classList).slice(0, 3).join('.'); }
          else {
            sel = node.tagName ? node.tagName.toLowerCase() : '';
            const parent = node.parentElement;
            if (parent) {
              const same = Array.from(parent.children).filter((c) => c.tagName === node.tagName);
              if (same.length > 1) sel += ':nth-child(' + (Array.from(parent.children).indexOf(node) + 1) + ')';
            }
          }
          if (!sel) { node = node.parentElement; continue; }
          parts.unshift(sel);
          node = node.parentElement;
        }
        return { target: parts.join(' > '), html: (el.outerHTML || '').replace(/\s+/g, ' ').slice(0, 200) };
      };
      const out = [];
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      for (const el of document.querySelectorAll('a[href], button, input[type=submit], input[type=button], input[type=checkbox], input[type=radio]')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        // hors champ visible (skip-link caché, éléments offscreen pour le focus) : pas une cible tactile
        if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
        // Exemption WCAG 2.5.8 : les liens au fil du texte (rendus inline dans
        // une phrase ou un bloc de texte) ne sont pas des cibles tactiles.
        if (el.tagName === 'A' && getComputedStyle(el).display === 'inline') continue;
        if (r.width < 44 || r.height < 44) {
          const i = info(el);
          out.push({ tag: el.tagName.toLowerCase(), w: Math.round(r.width), h: Math.round(r.height), text: (el.innerText || el.value || '').trim().slice(0, 20) || el.tagName, target: i.target, html: i.html });
          if (out.length >= 8) break;
        }
      }
      return out;
    });
    if (smallTargets.length > 0) {
      const ex = smallTargets.slice(0, 3).map((t) => `${t.tag} ${t.w}×${t.h} «${t.text}»`).join(', ');
      checks.push({
        engine: 'custom', id: 'small-touch-target', impact: 'moderate',
        message: `${smallTargets.length} cible(s) tactile(s) de taille < 44×44 px (min. recommandé) (ex : ${ex}).`,
        wcag: '2.5.8', rgaa: null, count: smallTargets.length, layer: 'interaction',
        nodes: smallTargets.slice(0, 5).map((t) => ({ target: [t.target], html: t.html })),
      });
    }

    // 8. Débordement horizontal sur mobile (viewport 390 px)
    await page.setViewport({ width: 390, height: 844 });
    const over = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth || 0,
      innerW: window.innerWidth || 390,
      bodyW: document.body ? document.body.scrollWidth : 0,
    }));
    await page.setViewport({ width: 1280, height: 1024 });
    if (over.scrollW > over.innerW + 2 || over.bodyW > over.innerW + 2) {
      checks.push({
        engine: 'custom', id: 'horizontal-overflow-mobile', impact: 'serious',
        message: `Débordement horizontal sur mobile (contenu large de ${over.scrollW} px pour un écran de 390 px) : une partie du contenu est inaccessible sans défilement horizontal. Éviter les largeurs fixes dépassant le viewport.`,
        wcag: '1.4.10', rgaa: '10.11', layer: 'interaction',
      });
    }
  } catch (err) {
    log('interaction warning:', err.message);
  }

  return checks;
}

async function runCustomChecks(page) {
  const checks = [];

  const pageLang = await page.evaluate(() => document.documentElement.lang || '');
  if (!pageLang.trim()) {
    checks.push({
      engine: 'custom',
      id: 'page-lang-missing',
      impact: 'serious',
      message: 'La langue de la page (attribut lang sur <html>) est absente.',
      wcag: '3.1.1',
      rgaa: '8.3',
      layer: 'technique',
    });
  }

  const headings = await page.evaluate(() => {
    const hs = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    return hs.map((h) => ({ level: parseInt(h.tagName[1], 10), text: h.innerText.trim().slice(0, 200) }));
  });

  const h1s = headings.filter((h) => h.level === 1);
  if (h1s.length === 0) {
    checks.push({
      engine: 'custom', id: 'no-h1', impact: 'serious',
      message: 'Aucun titre de niveau 1 (<h1>) détecté.',
      wcag: '1.3.1', rgaa: '9.1', layer: 'technique',
    });
  } else if (h1s.length > 1) {
    checks.push({
      engine: 'custom', id: 'multiple-h1', impact: 'moderate',
      message: `Plusieurs titres de niveau 1 détectés (${h1s.length}).`,
      wcag: '1.3.1', rgaa: '9.1', layer: 'technique',
    });
  }

  for (let i = 1; i < headings.length; i++) {
    if (headings[i].level > headings[i - 1].level + 1) {
      checks.push({
        engine: 'custom', id: 'heading-skip', impact: 'moderate',
        message: `Saut dans la hiérarchie des titres : h${headings[i - 1].level} suivi de h${headings[i].level}.`,
        wcag: '1.3.1', rgaa: '9.1', layer: 'technique',
      });
      break;
    }
  }

  const formLabels = await page.evaluate(() => {
    const info = (el) => {
      if (!el) return { target: '', html: '' };
      const parts = [];
      let node = el;
      while (node && node !== document.documentElement) {
        let sel = '';
        if (node.id) { sel = '#' + String(node.id).replace(/[^a-zA-Z0-9_-]/g, '_'); }
        else if (node.classList && node.classList.length) { sel = '.' + Array.from(node.classList).slice(0, 3).join('.'); }
        else {
          sel = node.tagName ? node.tagName.toLowerCase() : '';
          const parent = node.parentElement;
          if (parent) {
            const same = Array.from(parent.children).filter((c) => c.tagName === node.tagName);
            if (same.length > 1) sel += ':nth-child(' + (Array.from(parent.children).indexOf(node) + 1) + ')';
          }
        }
        if (!sel) { node = node.parentElement; continue; }
        parts.unshift(sel);
        node = node.parentElement;
      }
      return { target: parts.join(' > '), html: (el.outerHTML || '').replace(/\s+/g, ' ').slice(0, 200) };
    };
    const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"]), select, textarea'));
    const bad = inputs.filter((input) => {
      const id = input.id;
      const aria = input.getAttribute('aria-label') || input.getAttribute('aria-labelledby');
      const hasLabel = id && document.querySelector(`label[for="${id}"]`);
      const placeholder = input.placeholder;
      const title = input.title;
      return !(hasLabel || aria || placeholder || title);
    });
    return bad.map((input) => {
      const i = info(input);
      return { tag: input.tagName, type: input.type || '', name: input.name || '', target: i.target, html: i.html };
    });
  });

  if (formLabels.length > 0) {
    checks.push({
      engine: 'custom', id: 'form-missing-label', impact: 'serious',
      message: `${formLabels.length} champ(s) de formulaire sans label détecté(s).`,
      wcag: '1.3.1', rgaa: '11.1', count: formLabels.length, layer: 'technique',
      nodes: formLabels.slice(0, 5).map((f) => ({ target: [f.target], html: f.html })),
    });
  }

  const structure = await page.evaluate(() => {
    const info = (el) => {
      if (!el) return { target: '', html: '' };
      const parts = [];
      let node = el;
      while (node && node !== document.documentElement) {
        let sel = '';
        if (node.id) { sel = '#' + String(node.id).replace(/[^a-zA-Z0-9_-]/g, '_'); }
        else if (node.classList && node.classList.length) { sel = '.' + Array.from(node.classList).slice(0, 3).join('.'); }
        else {
          sel = node.tagName ? node.tagName.toLowerCase() : '';
          const parent = node.parentElement;
          if (parent) {
            const same = Array.from(parent.children).filter((c) => c.tagName === node.tagName);
            if (same.length > 1) sel += ':nth-child(' + (Array.from(parent.children).indexOf(node) + 1) + ')';
          }
        }
        if (!sel) { node = node.parentElement; continue; }
        parts.unshift(sel);
        node = node.parentElement;
      }
      return { target: parts.join(' > '), html: (el.outerHTML || '').replace(/\s+/g, ' ').slice(0, 200) };
    };
    const hasMain = !!document.querySelector('main, [role="main"]');
    const hasNav = !!document.querySelector('nav, [role="navigation"]');
    const title = document.title || '';
    const positiveTabindex = Array.from(document.querySelectorAll('[tabindex]'))
      .filter((el) => {
        const v = parseInt(el.getAttribute('tabindex'), 10);
        return Number.isInteger(v) && v > 0;
      })
      .map((el) => info(el));
    return { hasMain, hasNav, title, positiveTabindex };
  });

  if (!structure.hasMain) {
    checks.push({
      engine: 'custom', id: 'landmark-main-missing', impact: 'serious',
      message: 'Aucun repère principal (landmark) détecté pour la zone de contenu (élément <main> ou role="main").',
      wcag: '1.3.1', rgaa: '12.6', layer: 'technique',
    });
  }
  if (!structure.hasNav) {
    checks.push({
      engine: 'custom', id: 'landmark-nav-missing', impact: 'moderate',
      message: 'Aucun repère de navigation (landmark) détecté (élément <nav> ou role="navigation").',
      wcag: '1.3.1', rgaa: '12.6', layer: 'technique',
    });
  }
  if (!structure.title.trim()) {
    checks.push({
      engine: 'custom', id: 'title-missing', impact: 'serious',
      message: 'La balise <title> (titre de la page) est absente.',
      wcag: '2.4.2', rgaa: '8.5', layer: 'technique',
    });
  }
  if (structure.positiveTabindex.length > 0) {
    checks.push({
      engine: 'custom', id: 'positive-tabindex', impact: 'moderate',
      message: `${structure.positiveTabindex.length} élément(s) avec un tabindex positif (> 0) détecté(s), perturbant l'ordre de tabulation naturel.`,
      wcag: '2.4.3', rgaa: '12.8', count: structure.positiveTabindex.length, layer: 'technique',
      nodes: structure.positiveTabindex.slice(0, 5).map((t) => ({ target: [t.target], html: t.html })),
    });
  }

  const links = await page.evaluate((vagueList) => {
    const out = { vague: [], newTabNoRel: 0, newTabSamples: [] };
    for (const a of document.querySelectorAll('a[href]')) {
      const visibleText = (a.innerText || a.textContent || '').trim();
      const hasAccName = a.getAttribute('aria-label') || a.getAttribute('aria-labelledby') || a.getAttribute('title');
      if (!hasAccName && visibleText) {
        const normalized = visibleText.toLowerCase().replace(/\s+/g, ' ').replace(/[.…?!]+$/, '').trim();
        if (vagueList.includes(normalized) && out.vague.length < 5) {
          out.vague.push({ text: visibleText.slice(0, 60), href: a.getAttribute('href') || '' });
        }
      }
      if ((a.getAttribute('target') || '').toLowerCase() === '_blank') {
        const rel = (a.getAttribute('rel') || '').toLowerCase();
        if (!rel.includes('noopener') && !rel.includes('noreferrer')) {
          out.newTabNoRel += 1;
          if (out.newTabSamples.length < 5) out.newTabSamples.push(a.getAttribute('href') || '');
        }
      }
    }
    return out;
  }, Array.from(VAGUE_LINK_TEXTS));

  if (links.vague.length > 0) {
    const examples = links.vague.map((l) => `"${l.text}"`).join(', ');
    checks.push({
      engine: 'custom', id: 'vague-link-text', impact: 'moderate',
      message: `${links.vague.length} lien(s) avec un texte non explicite (ex : ${examples}). Rendre le libellé du lien explicite hors contexte.`,
      wcag: '2.4.4', rgaa: '6.1', count: links.vague.length, layer: 'technique',
    });
  }
  if (links.newTabNoRel > 0) {
    checks.push({
      engine: 'custom', id: 'link-new-tab-no-warning', impact: 'minor',
      message: `${links.newTabNoRel} lien(s) s'ouvrant dans un nouvel onglet (target="_blank") sans rel="noopener" ni avertissement explicite.`,
      wcag: '2.4.4', rgaa: '13.2', count: links.newTabNoRel, samples: links.newTabSamples, layer: 'technique',
    });
  }

  return checks;
}

// RGAA 13.3 : ne retient que les liens PDF dépourvus d'une version accessible
// (lien HTML « en ligne » détecté à proximité par runContentChecks).
function pdfLinksWithoutAlternative(pdfLinks) {
  return (pdfLinks || []).filter((l) => !l.hasHtmlAlternative);
}

function computeScore(issues) {
  if (issues.length === 0) return 100;

  const weights = {
    error: 10, warning: 5, notice: 2,
    serious: 8, critical: 12, moderate: 5, minor: 2,
  };

  let penalty = 0;
  for (const issue of issues) {
    let key = issue.impact || issue.type || 'notice';
    key = key.toLowerCase();
    penalty += weights[key] || 2;
  }

  return Math.max(0, Math.min(100, 100 - penalty));
}

function deduplicateIssues(issues) {
  const seen = new Set();
  return issues.filter((issue) => {
    const key = `${issue.engine}|${issue.id || issue.code || issue.message}|${issue.selector || issue.nodes?.[0]?.target?.join(',') || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function scanUrl(url, opts = {}) {
  const { log = console.log, runSemantic = true } = typeof opts === 'function' ? { log: opts } : opts;
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setUserAgent(USER_AGENT);
    // Le navigateur est mutualise entre scans : desactiver le cache HTTP
    // pour ne jamais rescanner une version perimee d'un site corrige.
    await page.setCacheEnabled(false);
    await page.setViewport({ width: 1280, height: 1024 });

    const response = await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: SCAN_TIMEOUT,
    });

    if (!response) {
      throw new Error('Impossible de charger la page (pas de réponse).');
    }

    const status = response.status();
    if (status >= 400) {
      throw new Error(`La page a retourné un statut HTTP ${status}.`);
    }

    const [pa11yIssues, axeIssues, customIssues, contentIssues, interactionIssues] = await Promise.all([
      runPa11y(browser, url).catch((err) => { log('pa11y warning:', err.message); return []; }),
      runAxe(page).catch((err) => { log('axe warning:', err.message); return []; }),
      runCustomChecks(page).catch((err) => { log('custom warning:', err.message); return []; }),
      runContentChecks(page).catch((err) => { log('content warning:', err.message); return []; }),
      runInteractionChecks(page, log).catch((err) => { log('interaction warning:', err.message); return []; }),
    ]);

    // Couche sémantique IA (échec gracieux) — désactivable pour les scans
    // de pages secondaires (maîtrise du coût LLM en audit multi-pages).
    const aiAnalysis = runSemantic
      ? await runSemanticAnalysis(page)
      : { issues: [], skipped: true };

    const rawIssues = [...pa11yIssues, ...axeIssues, ...customIssues, ...contentIssues, ...interactionIssues, ...aiAnalysis.issues];
    const issues = deduplicateIssues(rawIssues);
    const score = computeScore(issues);

    const summary = { total: issues.length, byImpact: {}, byEngine: {}, byLayer: {} };
    for (const issue of issues) {
      const impact = issue.impact || issue.type || 'notice';
      summary.byImpact[impact] = (summary.byImpact[impact] || 0) + 1;
      const engine = issue.engine || 'unknown';
      summary.byEngine[engine] = (summary.byEngine[engine] || 0) + 1;
      const layer = issue.ai ? 'ia' : (issue.layer || 'technique');
      summary.byLayer[layer] = (summary.byLayer[layer] || 0) + 1;
    }

    const pageTitle = await page.title().catch(() => '');

    return {
      url,
      pageTitle,
      status,
      score,
      summary,
      issues,
      ai_analysis: aiAnalysis,
      scanned_at: new Date().toISOString(),
      coverage_note:
        'Ce scan combine une détection technique automatisée (contraste, structure, ARIA, formulaires, images, liens, navigation clavier — critères RGAA/WCAG) élargie par une analyse IA des textes alternatifs, intitulés de liens et labels de formulaires. La détection automatisée reste partielle : un audit humain reste nécessaire pour une conformité complète.',
    };
  } finally {
    try {
      await page.close();
    } catch {
      // ignore
    }
  }
}

async function scanWithRetry(url, retries = MAX_RETRIES) {
  let lastError;
  for (let i = 0; i <= retries; i++) {
    try {
      return await scanUrl(url, {});
    } catch (err) {
      lastError = err;
      if (i < retries && err.message && !err.message.includes('non autorisée')) {
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
      } else {
        break;
      }
    }
  }
  throw lastError;
}

async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

module.exports = {
  generateId,
  normalizeUrl,
  validateUrl,
  scanUrl,
  scanWithRetry,
  closeBrowser,
  getBrowser,
  isVagueLinkText,
  computeScore,
  runCustomChecks,
  runContentChecks,
  runInteractionChecks,
  pdfLinksWithoutAlternative,
};