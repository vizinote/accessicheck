const express = require('express');
const nodemailer = require('nodemailer');
const { initDb, createScan, getScan, updateScanStatus, listPendingScans, createOrder, getOrder, getPendingOrderByEmail, updateOrderStatus, saveLead } = require('./db');
const { generateId, normalizeUrl, validateUrl, scanWithRetry, closeBrowser } = require('./scanner');
const { scanSiteWithRetry } = require('./multipage');
const { generateReportHtml, generateReportPdf } = require('./reports/reportGenerator');

const app = express();
app.disable('x-powered-by'); // ne pas exposer la version/marque du serveur
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT || 8080;
const BASE_PATH = process.env.BASE_PATH || '';
const WORKER_SCAN_TIMEOUT_MS = parseInt(process.env.WORKER_SCAN_TIMEOUT_MS || '120000', 10);
const MULTIPAGE_SCAN_TIMEOUT_MS = parseInt(process.env.MULTIPAGE_SCAN_TIMEOUT_MS || '420000', 10);
const VALID_OFFERS = new Set(['oneshot', 'pro', 'monitoring', 'free']);
const ALLOWED_ORIGINS = new Set([
  'https://accessicheck.brozapi.com',
  'https://www.accessicheck.brozapi.com',
  'https://badgeia.brozapi.com',
  'https://brozapi.com',
  'https://www.brozapi.com',
  'http://localhost',
  'http://localhost:3000',
  'http://localhost:5173',
]);

// Configuration email (lues depuis l'environnement au runtime, jamais en dur).
// Peut provenir d'un fichier .env monté dans /data (badgeia-mail.env),
// avec des clés MAIL_* mappées sur les SMTP_* attendues par le code.
function loadDotenv(path) {
  try {
    const text = require('fs').readFileSync(path, 'utf-8');
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const [key, ...rest] = trimmed.split('=');
      const val = rest.join('=').trim().replace(/^['"]|['"]$/g, '');
      if (key && val && !(key in process.env)) {
        process.env[key] = val;
      }
    }
  } catch (e) {
    // fichier absent : on continue avec les variables existantes
  }
}

for (const envPath of ['/data/badgeia-mail.env', '/opt/data/badgeia-mail.env', '/app/badgeia-mail.env']) {
  loadDotenv(envPath);
}

function emailCfg(name) {
  const smtp = process.env['SMTP_' + name];
  if (smtp) return smtp;
  const mapping = { HOST: 'HOST', PORT: 'PORT', USER: 'USER', PASSWORD: 'PASS' };
  const mailKey = mapping[name] || name;
  return process.env['MAIL_' + mailKey] || '';
}

let smtpPortRaw = (emailCfg('PORT') || process.env.SMTP_PORT || process.env.MAIL_PORT || '587').toString().trim();
if (smtpPortRaw === '993' || smtpPortRaw === '995') smtpPortRaw = '587';
const SMTP_HOST = emailCfg('HOST') || process.env.SMTP_HOST || '';
const SMTP_PORT = parseInt(smtpPortRaw, 10);
const SMTP_USER = emailCfg('USER') || process.env.SMTP_USER || '';
const SMTP_PASSWORD = emailCfg('PASSWORD') || process.env.SMTP_PASSWORD || '';
const SMTP_FROM = process.env.SMTP_FROM || process.env.MAIL_DEFAULT_SENDER || SMTP_USER || '';
const SMTP_REPLY_TO = process.env.SMTP_REPLY_TO || '';
const GUIDE_PDF_URL = 'https://accessicheck.brozapi.com/guide-accessibilite-eaa.pdf';

function createEmailTransporter() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD || !SMTP_FROM) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    tls: { rejectUnauthorized: true },
  });
}

function sendGuideEmail(email) {
  // Ne fait jamais échouer la requête API.
  const transporter = createEmailTransporter();
  if (!transporter) {
    console.warn('SMTP non configuré : email de livraison non envoyé à %s', email);
    return Promise.resolve();
  }

  const subject = 'Votre guide Accessibilité web EAA/RGAA';
  const textBody =
    `Bonjour,\n\n` +
    `Merci pour votre intérêt. Votre guide « Accessibilité web : votre site est-il concerné ? (EAA, RGAA, WCAG) » ` +
    `est disponible ici : ${GUIDE_PDF_URL}\n\n` +
    `Vous pouvez le télécharger gratuitement et le partager au sein de votre équipe.\n\n` +
    `Important : un scan automatique combine une détection technique et une analyse IA élargie au-delà des 40 % classiques. ` +
    `Pour une conformité complète, un audit humain reste nécessaire.\n\n` +
    `Ce guide est fourni à titre indicatif. Il ne constitue pas un conseil juridique ` +
    `ni une garantie de conformité.\n\n` +
    `Bonne lecture,\n` +
    `L'équipe Brozapi — AccessiCheck\n` +
    `https://accessicheck.brozapi.com\n`;

  const htmlBody =
    `<html><body style="font-family: system-ui, sans-serif; color:#1a1a1a; background:#ffffff;">` +
    `<div style="max-width:560px; margin:0 auto;">` +
    `<p style="color:#1d4ed8; font-weight:800; font-size:1.1rem;">AccessiCheck · par Brozapi</p>` +
    `<p>Bonjour,</p>` +
    `<p>Merci pour votre intérêt. Votre guide <strong>« Accessibilité web : votre site est-il concerné ? (EAA, RGAA, WCAG) »</strong> ` +
    `est disponible ici :</p>` +
    `<p><a href="${GUIDE_PDF_URL}" style="display:inline-block; padding:0.75rem 1.25rem; background:#1d4ed8; color:#ffffff; text-decoration:none; border-radius:0.5rem; font-weight:600;">Télécharger le guide PDF</a></p>` +
    `<p>Vous pouvez le télécharger gratuitement et le partager au sein de votre équipe.</p>` +
    `<p style="background:#eff6ff; padding:0.75rem; border-left:3px solid #1d4ed8; color:#454545;">` +
    `<strong>Important :</strong> un scan automatique combine une détection technique et une analyse IA élargie au-delà des 40 % classiques. ` +
    `Pour une conformité complète, un audit humain reste toutefois nécessaire.` +
    `</p>` +
    `<p><small>Ce guide est fourni à titre indicatif. Il ne constitue pas un conseil juridique ` +
    `ni une garantie de conformité.</small></p>` +
    `<p>Bonne lecture,<br>` +
    `L'équipe Brozapi — AccessiCheck<br>` +
    `<a href="https://accessicheck.brozapi.com" style="color:#1d4ed8;">accessicheck.brozapi.com</a></p>` +
    `<hr style="border:none; border-top:1px solid #d4d4d4; margin:1.5rem 0;">` +
    `<p style="font-size:0.8rem; color:#737373;">` +
    `Brozapi — Studio de produits numériques.<br>` +
    `Ce message vous a été envoyé suite à votre demande sur accessicheck.brozapi.com.` +
    `</p>` +
    `</div></body></html>`;

  const msg = {
    from: SMTP_FROM,
    to: email,
    subject,
    text: textBody,
    html: htmlBody,
  };
  if (SMTP_REPLY_TO) msg.replyTo = SMTP_REPLY_TO;

  return transporter.sendMail(msg)
    .then(() => console.log('Email guide envoyé à %s', email))
    .catch((err) => console.warn('Échec envoi email guide à %s : %s', email, err.message || err));
}

const rateLimits = new Map();

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return xff.split(',').pop().trim();
  return req.headers['x-real-ip'] || req.ip || 'unknown';
}

function isAllowed(ip, action, limit, windowSeconds) {
  const key = `${ip}:${action}`;
  const now = Date.now();
  const bucket = rateLimits.get(key) || { start: now, count: 0 };
  if (now - bucket.start > windowSeconds * 1000) {
    bucket.start = now;
    bucket.count = 0;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  rateLimits.set(key, bucket);
  return true;
}

function setCors(req, res) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
}

app.use((req, res, next) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.sendStatus(204);
  }
  next();
});

function makeResponse(res, data, status = 200) {
  res.status(status).json(data);
}

function route(path) {
  return `${BASE_PATH}${path}`;
}

app.get(route('/health'), (req, res) => {
  res.json({ ok: true, service: 'accessicheck-api' });
});

// Enregistrement d'une commande (avant paiement Stripe) : associe URL + email + offre.
app.post(route('/orders'), async (req, res) => {
  const clientIp = getClientIp(req);
  if (!isAllowed(clientIp, 'order', 10, 3600)) {
    return makeResponse(res, { ok: false, error: 'Quota de commandes atteint. Réessayez dans une heure.' }, 429);
  }

  const email = String(req.body.email || '').trim();
  const url = normalizeUrl(req.body.url);
  const rawOffer = req.body.offer;

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return makeResponse(res, { ok: false, error: 'Email invalide.' }, 400);
  }
  if (!rawOffer || !VALID_OFFERS.has(rawOffer)) {
    return makeResponse(res, { ok: false, error: `Offre invalide. Valeurs acceptées : ${Array.from(VALID_OFFERS).join(', ')}.` }, 400);
  }
  const urlError = validateUrl(url);
  if (urlError) {
    return makeResponse(res, { ok: false, error: urlError }, 400);
  }

  try {
    const id = generateId();
    await createOrder(id, email, url, rawOffer);
    return makeResponse(res, { ok: true, id, email, url, offer: rawOffer, status: 'pending' }, 201);
  } catch (err) {
    console.error('createOrder error:', err);
    return makeResponse(res, { ok: false, error: 'Erreur de stockage.' }, 500);
  }
});

// Interrogation d'une commande en attente pour un email (utilisé par le poller de livraison).
app.get(route('/orders/pending'), async (req, res) => {
  const email = String(req.query.email || '').trim();
  if (!email) {
    return makeResponse(res, { ok: false, error: 'Paramètre email requis.' }, 400);
  }
  try {
    const order = await getPendingOrderByEmail(email);
    if (!order) {
      return makeResponse(res, { ok: true, order: null });
    }
    return makeResponse(res, { ok: true, order });
  } catch (err) {
    console.error('getPendingOrder error:', err);
    return makeResponse(res, { ok: false, error: 'Erreur de lecture.' }, 500);
  }
});

// Marque une commande comme payée (appelé par le poller après confirmation Stripe).
app.post(route('/orders/:id/paid'), async (req, res) => {
  try {
    const order = await getOrder(req.params.id);
    if (!order) {
      return makeResponse(res, { ok: false, error: 'Commande non trouvée.' }, 404);
    }
    const sessionId = String(req.body.session_id || order.session_id || '');
    await updateOrderStatus(order.id, 'paid', { session_id: sessionId });
    return makeResponse(res, { ok: true, id: order.id, status: 'paid' });
  } catch (err) {
    console.error('markOrderPaid error:', err);
    return makeResponse(res, { ok: false, error: 'Erreur de mise à jour.' }, 500);
  }
});

// Marque une commande comme livrée (appelé par le poller après envoi du rapport).
app.post(route('/orders/:id/delivered'), async (req, res) => {
  try {
    const order = await getOrder(req.params.id);
    if (!order) {
      return makeResponse(res, { ok: false, error: 'Commande non trouvée.' }, 404);
    }
    await updateOrderStatus(order.id, 'delivered');
    return makeResponse(res, { ok: true, id: order.id, status: 'delivered' });
  } catch (err) {
    console.error('markOrderDelivered error:', err);
    return makeResponse(res, { ok: false, error: 'Erreur de mise à jour.' }, 500);
  }
});

app.post(route('/lead'), async (req, res) => {
  const clientIp = getClientIp(req);
  const data = req.body || {};
  const email = String(data.email || '').trim().toLowerCase();
  const consent = data.consent;

  if (consent !== true) {
    return makeResponse(res, { ok: false, error: 'Vous devez accepter la politique de confidentialité.' }, 400);
  }
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return makeResponse(res, { ok: false, error: 'Adresse email invalide.' }, 400);
  }
  if (!isAllowed(clientIp, 'lead_guide', 3, 86400)) {
    return makeResponse(res, { ok: false, error: 'Quota de demandes atteint. Réessayez dans quelques heures.' }, 429);
  }

  try {
    await saveLead(email, '/guide-accessibilite-eaa.pdf', '', 'guide-pdf-accessicheck');
  } catch (err) {
    console.error('saveLead error:', err);
    return makeResponse(res, { ok: false, error: 'Erreur de stockage. Réessayez plus tard.' }, 500);
  }

  // Envoi asynchrone : ne doit pas faire échouer la requête API.
  sendGuideEmail(email).catch((err) => console.warn('Échec envoi email guide après stockage :', err));

  return makeResponse(res, { ok: true });
});

app.post(route('/scan'), async (req, res) => {
  const clientIp = getClientIp(req);
  if (!isAllowed(clientIp, 'scan', 10, 3600)) {
    return makeResponse(res, { ok: false, error: 'Quota de scans atteint. Réessayez dans une heure.' }, 429);
  }

  const url = normalizeUrl(req.body.url);
  const rawOffer = req.body.offer;

  if (!rawOffer || !VALID_OFFERS.has(rawOffer)) {
    return makeResponse(res, { ok: false, error: `Offre invalide. Valeurs acceptées : ${Array.from(VALID_OFFERS).join(', ')}.` }, 400);
  }

  const offer = rawOffer;

  const error = validateUrl(url);
  if (error) {
    return makeResponse(res, { ok: false, error }, 400);
  }

  try {
    const id = generateId();
    await createScan(id, url, offer);
    return makeResponse(res, { ok: true, id, url, offer, status: 'pending', message: 'Scan mis en file d\'attente.' }, 202);
  } catch (err) {
    console.error('createScan error:', err);
    return makeResponse(res, { ok: false, error: 'Erreur de stockage.' }, 500);
  }
});

// Scan gratuit depuis la page d'accueil (sans offre payante associée).
app.post(route('/free-scan'), async (req, res) => {
  const clientIp = getClientIp(req);
  if (!isAllowed(clientIp, 'free_scan', 5, 3600)) {
    return makeResponse(res, { ok: false, error: 'Quota de scans gratuits atteint. Réessayez dans une heure.' }, 429);
  }

  const url = normalizeUrl(req.body.url);
  const error = validateUrl(url);
  if (error) {
    return makeResponse(res, { ok: false, error }, 400);
  }

  try {
    const id = generateId();
    await createScan(id, url, 'free');
    return makeResponse(res, { ok: true, id, url, offer: 'free', status: 'pending', message: 'Scan gratuit mis en file d\'attente.' }, 202);
  } catch (err) {
    console.error('createFreeScan error:', err);
    return makeResponse(res, { ok: false, error: 'Erreur de stockage.' }, 500);
  }
});

app.get(route('/scan/:id'), async (req, res) => {
  try {
    const scan = await getScan(req.params.id);
    if (!scan) {
      return makeResponse(res, { ok: false, error: 'Scan non trouvé.' }, 404);
    }
    const response = {
      ok: true,
      id: scan.id,
      url: scan.url,
      offer: scan.offer,
      status: scan.status,
      created_at: scan.created_at,
      started_at: scan.started_at,
      finished_at: scan.finished_at,
    };
    if (scan.status === 'done' && scan.result) {
      response.result = JSON.parse(scan.result);
    }
    if (scan.status === 'failed' && scan.error) {
      response.error = scan.error;
    }
    return makeResponse(res, response);
  } catch (err) {
    console.error('getScan error:', err);
    return makeResponse(res, { ok: false, error: 'Erreur de lecture.' }, 500);
  }
});

// Alias GET /result/:id pour compatibilité spec
app.get(route('/result/:id'), async (req, res) => {
  req.url = `${BASE_PATH}/scan/${req.params.id}`;
  // Express ne relira pas req.url; on appelle directement le handler
  try {
    const scan = await getScan(req.params.id);
    if (!scan) {
      return makeResponse(res, { ok: false, error: 'Scan non trouvé.' }, 404);
    }
    const response = {
      ok: true,
      id: scan.id,
      url: scan.url,
      offer: scan.offer,
      status: scan.status,
      created_at: scan.created_at,
      started_at: scan.started_at,
      finished_at: scan.finished_at,
    };
    if (scan.status === 'done' && scan.result) {
      response.result = JSON.parse(scan.result);
    }
    if (scan.status === 'failed' && scan.error) {
      response.error = scan.error;
    }
    return makeResponse(res, response);
  } catch (err) {
    console.error('getScan error:', err);
    return makeResponse(res, { ok: false, error: 'Erreur de lecture.' }, 500);
  }
});

app.get(route('/report/:id'), async (req, res) => {
  const clientIp = getClientIp(req);
  if (!isAllowed(clientIp, 'report', 30, 3600)) {
    return makeResponse(res, { ok: false, error: 'Quota de rapports atteint. Réessayez dans une heure.' }, 429);
  }

  try {
    const scan = await getScan(req.params.id);
    if (!scan) {
      return makeResponse(res, { ok: false, error: 'Scan non trouvé.' }, 404);
    }
    if (scan.status !== 'done') {
      return makeResponse(res, { ok: false, error: 'Le scan n\'est pas encore terminé.', status: scan.status }, 425);
    }

    const format = (req.query.format || 'pdf').toLowerCase();
    if (format === 'html') {
      const html = await generateReportHtml(scan);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    }

    if (format !== 'pdf') {
      return makeResponse(res, { ok: false, error: 'Format invalide. Utilisez ?format=html ou ?format=pdf (par défaut).' }, 400);
    }

    const pdf = await generateReportPdf(scan);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="accessicheck-rapport-${scan.id}.pdf"`);
    return res.send(pdf);
  } catch (err) {
    console.error('generateReport error:', err);
    return makeResponse(res, { ok: false, error: 'Erreur lors de la génération du rapport.' }, 500);
  }
});

app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'Endpoint non trouvé.' });
});

// Worker asynchrone de scans --------------------------------------------------
let workerRunning = true;

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout du worker (${label} > ${ms}ms)`));
    }, ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function processOneScan(scan) {
  const id = scan.id;
  console.log(`[worker] démarrage scan ${id} : ${scan.url} (offre ${scan.offer})`);
  await updateScanStatus(id, 'running', { started_at: new Date().toISOString() });

  // Offres payantes = audit multi-pages (jusqu'à 5 pages clés, 1 seul quota
  // décompté à la création du scan). Le scan gratuit reste sur la page
  // d'accueil uniquement (différenciation d'offre).
  const multipage = scan.offer !== 'free';
  const timeoutMs = multipage ? MULTIPAGE_SCAN_TIMEOUT_MS : WORKER_SCAN_TIMEOUT_MS;

  try {
    const result = await withTimeout(
      multipage ? scanSiteWithRetry(scan.url) : scanWithRetry(scan.url),
      timeoutMs,
      `scan ${id}`
    );
    await updateScanStatus(id, 'done', {
      finished_at: new Date().toISOString(),
      result: JSON.stringify(result),
    });
    console.log(`[worker] scan ${id} terminé : score ${result.score}${result.pages_count ? ` (${result.pages_count} pages)` : ''}`);
  } catch (err) {
    const message = err && err.message ? err.message : 'Erreur inconnue.';
    console.error(`[worker] scan ${id} échoué :`, message);
    await updateScanStatus(id, 'failed', {
      finished_at: new Date().toISOString(),
      error: message,
    });
  }
}

async function workerLoop() {
  while (workerRunning) {
    try {
      const pending = await listPendingScans();
      if (pending.length === 0) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      // Traiter un scan à la fois pour maîtriser les ressources Puppeteer
      await processOneScan(pending[0]);
    } catch (err) {
      console.error('[worker] erreur boucle:', err);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

// Démarrage -------------------------------------------------------------------
(async () => {
  await initDb();
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`AccessiCheck API à l'écoute sur le port ${PORT}`);
  });

  workerLoop();

  async function shutdown() {
    console.log('Arrêt en cours...');
    workerRunning = false;
    server.close();
    await closeBrowser();
    process.exit(0);
  }

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
})();
