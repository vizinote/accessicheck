const express = require('express');
const { initDb, createScan, getScan, updateScanStatus, listPendingScans } = require('./db');
const { generateId, normalizeUrl, validateUrl } = require('./scanner');
const { validateOffer, runScan } = require('./engine/scan');

const app = express();
app.use(express.json({ limit: '1mb' }));

const PORT = parseInt(process.env.PORT || '8080', 10);
const BASE_PATH = process.env.BASE_PATH || '';
const WORKER_SCAN_TIMEOUT_MS = parseInt(process.env.WORKER_SCAN_TIMEOUT_MS || '120000', 10);
const ALLOWED_ORIGINS = new Set([
  'https://accessicheck.brozapi.com',
  'https://badgeia.brozapi.com',
  'https://brozapi.com',
  'https://www.brozapi.com',
  'http://localhost',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8080',
]);

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

app.post(route('/scan'), async (req, res) => {
  const clientIp = getClientIp(req);
  if (!isAllowed(clientIp, 'scan', 10, 3600)) {
    return makeResponse(res, { ok: false, error: 'Quota de scans atteint. Réessayez dans une heure.' }, 429);
  }

  const rawUrl = req.body.url;
  const rawOffer = req.body.offre;
  const url = normalizeUrl(rawUrl);

  const urlError = validateUrl(url);
  if (urlError) {
    return makeResponse(res, { ok: false, error: urlError }, 400);
  }

  const offerError = validateOffer(rawOffer);
  if (offerError) {
    return makeResponse(res, { ok: false, error: offerError }, 400);
  }

  try {
    const id = generateId();
    await createScan(id, url, rawOffer);
    return makeResponse(res, { ok: true, id, status: 'pending' }, 201);
  } catch (err) {
    console.error('createScan error:', err);
    return makeResponse(res, { ok: false, error: 'Erreur de stockage.' }, 500);
  }
});

app.get(route('/result/:id'), async (req, res) => {
  try {
    const scan = await getScan(req.params.id);
    if (!scan) {
      return makeResponse(res, { ok: false, error: 'Scan non trouvé.' }, 404);
    }

    if (scan.status === 'pending') {
      return makeResponse(res, { status: 'pending' });
    }

    if (scan.status === 'running') {
      return makeResponse(res, { status: 'running' });
    }

    if (scan.status === 'failed') {
      return makeResponse(res, { status: 'failed', error: scan.error || 'Erreur inconnue.' });
    }

    // done
    const response = {
      status: 'done',
      id: scan.id,
      url: scan.url,
      offer: scan.offer,
      created_at: scan.created_at,
      started_at: scan.started_at,
      finished_at: scan.finished_at,
    };
    if (scan.result) {
      try {
        response.result = JSON.parse(scan.result);
      } catch {
        response.result = scan.result;
      }
    }
    return makeResponse(res, response);
  } catch (err) {
    console.error('getScan error:', err);
    return makeResponse(res, { ok: false, error: 'Erreur de lecture.' }, 500);
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
  console.log(`[worker] démarrage scan ${id} : ${scan.url}`);
  await updateScanStatus(id, 'running', { started_at: new Date().toISOString() });

  try {
    const result = await withTimeout(
      runScan({ url: scan.url, offre: scan.offer }, (level, ...args) => {
        console.log(`[worker ${id}]`, level, ...args);
      }),
      WORKER_SCAN_TIMEOUT_MS,
      `scan ${id}`
    );
    await updateScanStatus(id, 'done', {
      finished_at: new Date().toISOString(),
      result: JSON.stringify(result),
    });
    console.log(`[worker] scan ${id} terminé : score ${result.score}`);
  } catch (err) {
    console.error(`[worker] scan ${id} échoué :`, err.message);
    await updateScanStatus(id, 'failed', {
      finished_at: new Date().toISOString(),
      error: err.message || 'Erreur inconnue.',
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
    process.exit(0);
  }

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
})();
