const puppeteer = require('puppeteer');
const pa11y = require('pa11y');
const { injectAxe, getViolations } = require('@axe-core/puppeteer');
const crypto = require('crypto');
const { URL } = require('url');

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
  await injectAxe(page);
  const axeResults = await page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    return await axe.run({
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21aa'],
      },
    });
  });
  return axeResults.violations.map((v) => ({
    engine: 'axe',
    id: v.id,
    impact: v.impact,
    tags: v.tags,
    description: v.description,
    help: v.help,
    helpUrl: v.helpUrl,
    nodes: v.nodes.map((n) => ({
      target: n.target,
      html: n.html,
      failureSummary: n.failureSummary,
    })),
  }));
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
      rgaa: '8.1.1',
    });
  }

  const headings = await page.evaluate(() => {
    const hs = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    return hs.map((h) => ({ level: parseInt(h.tagName[1], 10), text: h.innerText.trim().slice(0, 200) }));
  });

  const h1s = headings.filter((h) => h.level === 1);
  if (h1s.length === 0) {
    checks.push({
      engine: 'custom',
      id: 'no-h1',
      impact: 'serious',
      message: 'Aucun titre de niveau 1 (<h1>) détecté.',
      wcag: '1.3.1',
      rgaa: '9.1.1',
    });
  } else if (h1s.length > 1) {
    checks.push({
      engine: 'custom',
      id: 'multiple-h1',
      impact: 'moderate',
      message: `Plusieurs titres de niveau 1 détectés (${h1s.length}).`,
      wcag: '1.3.1',
      rgaa: '9.1.1',
    });
  }

  for (let i = 1; i < headings.length; i++) {
    if (headings[i].level > headings[i - 1].level + 1) {
      checks.push({
        engine: 'custom',
        id: 'heading-skip',
        impact: 'moderate',
        message: `Saut dans la hiérarchie des titres : h${headings[i - 1].level} suivi de h${headings[i].level}.`,
        wcag: '1.3.1',
        rgaa: '9.1.1',
      });
      break;
    }
  }

  const formLabels = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"]), select, textarea'));
    return inputs
      .filter((input) => {
        const id = input.id;
        const aria = input.getAttribute('aria-label') || input.getAttribute('aria-labelledby');
        const hasLabel = id && document.querySelector(`label[for="${id}"]`);
        const placeholder = input.placeholder;
        const title = input.title;
        return !(hasLabel || aria || placeholder || title);
      })
      .map((input) => ({ tag: input.tagName, type: input.type || '', name: input.name || '' }));
  });

  if (formLabels.length > 0) {
    checks.push({
      engine: 'custom',
      id: 'form-missing-label',
      impact: 'serious',
      message: `${formLabels.length} champ(s) de formulaire sans label détecté(s).`,
      wcag: '1.3.1',
      rgaa: '11.1.1',
      count: formLabels.length,
    });
  }

  return checks;
}

function computeScore(issues) {
  if (issues.length === 0) return 100;

  const weights = {
    error: 10,
    warning: 5,
    notice: 2,
    serious: 8,
    critical: 12,
    moderate: 5,
    minor: 2,
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

async function scanUrl(url, log = console.log) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setUserAgent(USER_AGENT);
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

    const [pa11yIssues, axeIssues, customIssues] = await Promise.all([
      runPa11y(browser, url).catch((err) => {
        log('pa11y warning:', err.message);
        return [];
      }),
      runAxe(page).catch((err) => {
        log('axe warning:', err.message);
        return [];
      }),
      runCustomChecks(page),
    ]);

    const rawIssues = [...pa11yIssues, ...axeIssues, ...customIssues];
    const issues = deduplicateIssues(rawIssues);
    const score = computeScore(issues);

    const summary = {
      total: issues.length,
      byImpact: {},
      byEngine: {},
    };
    for (const issue of issues) {
      const impact = issue.impact || issue.type || 'notice';
      summary.byImpact[impact] = (summary.byImpact[impact] || 0) + 1;
      const engine = issue.engine || 'unknown';
      summary.byEngine[engine] = (summary.byEngine[engine] || 0) + 1;
    }

    const pageTitle = await page.title().catch(() => '');

    return {
      url,
      pageTitle,
      status,
      score,
      summary,
      issues,
      scanned_at: new Date().toISOString(),
      coverage_note:
        'Ce scan couvre uniquement les critères RGAA/WCAG automatiquement testables (environ 30-40 % du référentiel RGAA). Un audit humain reste nécessaire pour une conformité complète.',
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
      return await scanUrl(url);
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
  scanWithRetry,
  closeBrowser,
  getBrowser,
};
