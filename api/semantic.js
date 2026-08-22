// Analyse sémantique IA — AccessiCheck v3
// Couche LLM : juge la pertinence des textes alternatifs, l'explicabilité des intitulés
// de liens, et la clarté des labels/messages d'erreur. UN SEUL appel par scan, sur un
// extrait structuré (JSON), pour rester sous ~0,005 $/scan.
// Échec gracieux obligatoire : si le LLM échoue, le scan technique est rendu intact.
// Anti-faux-positifs : les libellés courts de menu de navigation (repère nav/header/footer)
// sont EXEMPTÉS du jugement « vague », car leur contexte d'usage donne le sens (WCAG 2.4.4).

// Le modèle est lu À CHAQUE APPEL (rebasculement à chaud possible via SCANNER_LLM_MODEL)
function currentModel() {
  return process.env.SCANNER_LLM_MODEL || 'deepseek/deepseek-v4-flash-0731';
}
const SCANNER_LLM_BASE = process.env.SCANNER_LLM_BASE || 'https://openrouter.ai/api/v1/chat/completions';
const SCANNER_LLM_TIMEOUT_MS = parseInt(process.env.SCANNER_LLM_TIMEOUT_MS || '25000', 10);
const SCANNER_AI_MAX_ISSUES = parseInt(process.env.SCANNER_AI_MAX_ISSUES || '12', 10);

const PRICING = {
  'mistralai/mistral-nemo': { in: 0.019, out: 0.030 },
  'deepseek/deepseek-v4-flash-0731': { in: 0.076, out: 0.151 },
  'deepseek/deepseek-v4-flash-latest': { in: 0.076, out: 0.151 },
  'moonshotai/kimi-k2.6': { in: 0.5415, out: 2.28 },
  'qwen/qwen3.7-flash': { in: 0.030, out: 0.130 },
  'google/gemini-3.1-flash-lite': { in: 0.250, out: 1.500 },
};

function estimateCost(model, inTok, outTok) {
  const p = PRICING[model] || { in: 0.08, out: 0.16 };
  return (inTok / 1e6) * p.in + (outTok / 1e6) * p.out;
}

// --- Collecte de l'extrait structuré (ciblée, sans PII sensible) ---
async function collectSemanticSignal(page) {
  return page.evaluate(() => {
    const out = { imgs: [], links: [], fields: [] };

    for (const img of document.querySelectorAll('img')) {
      const alt = img.getAttribute('alt');
      const parent = img.closest('a, button, p, figcaption, h1, h2, h3, li');
      const altText = alt !== null ? alt.trim() : '';
      if (altText !== '') {
        out.imgs.push({ kind: 'alt', val: altText.slice(0, 120) });
      } else if (alt === null) {
        out.imgs.push({ kind: 'no-alt', src: (img.getAttribute('src') || '').slice(0, 80) });
      } else {
        const deco = img.hasAttribute('aria-hidden') || img.getAttribute('role') === 'presentation';
        const inLink = !!img.closest('a');
        out.imgs.push({ kind: 'empty-alt', decorative: deco, inLink });
      }
      if (out.imgs.length >= 20) break;
    }

    for (const a of document.querySelectorAll('a[href]')) {
      const text = (a.innerText || a.textContent || '').trim();
      const acc = (a.getAttribute('aria-label') || a.getAttribute('title') || '').trim();
      // contexte landmark : nav/header/footer/menu = liens de navigation dont label est acceptable
      const isNav = !!(a.closest('nav, header, footer, [role="navigation"], [role="menu"], [role="menubar"]'));
      const href = a.getAttribute('href') || '';
      // saut d'ancrage interne (skip-link type "Aller au contenu") : intitulé fonctionnel acceptable
      const isAnchor = href.startsWith('#') && href.length > 1;
      out.links.push({
        text: text.slice(0, 80),
        acc: acc.slice(0, 80),
        href: href.slice(0, 100),
        nav: isNav || isAnchor,
      });
      if (out.links.length >= 20) break;
    }

    for (const f of document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=image]), select, textarea')) {
      const id = f.id;
      let label = '';
      if (id) {
        const esc = String(id).replace(/[^a-zA-Z0-9_-]/g, (c) => '\\' + c);
        const l = document.querySelector('label[for="' + esc + '"]');
        label = (l && l.innerText) || '';
      }
      const entry = {
        field: f.tagName.toLowerCase(),
        label: label.trim().slice(0, 80),
        placeholder: (f.placeholder || '').trim().slice(0, 80),
        aria: (f.getAttribute('aria-label') || '').trim().slice(0, 80),
        type: f.type || '',
      };
      const db = f.getAttribute('aria-describedby');
      if (db) {
        entry.errorHint = db.split(/\s+/)
          .map((i2) => { const el = document.getElementById(i2); return (el && el.innerText || ''); })
          .join(' ').trim().slice(0, 120);
      }
      out.fields.push(entry);
      if (out.fields.length >= 15) break;
    }

    return out;
  });
}

// --- Appel unique au LLM (one-shot) ---
async function callSemanticAI(signal) {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.SCANNER_LLM_API_KEY || '';
  if (!apiKey) throw new Error('Clé API LLM manquante (OPENROUTER_API_KEY/SCANNER_LLM_API_KEY)');

  const systemPrompt = [
    'Tu es un expert RGAA/WCAG en accessibilité web.', '',
    'Analyse le JSON (extrait sémantique d\'une page) et signale UNIQUEMENT les problèmes nets ',
    '    de qualité de contenu. Ne sois pas sur-réactif : ne signale que ce qui est clairement fautif.',
    '',
    'RÈGLES :',
    '- ALT (imgs) : alt générique (« image », « IMG_1234 », « photo.jpg », nom de fichier seul) = KO ; ',
    '  alt descriptif rédigé = OK ; alt vide = OK seulement si decorative=true, sinon KO.',
    '- LIENS (links) : si "nav":true (item de menu de navigation / header / footer), NE PAS signaler ',
    '  un intitulé court : le contexte de navigation rend l\'intitulé compréhensible (WCAG 2.4.4).',
    '  Pour les liens de contenu (nav:false), un intitulé seul vague (« cliquez ici », « ici »,',
    '  « en savoir plus », « lire la suite », « suite », « plus d\'infos », « télécharger ») = KO.',
    '- FORMULAIRES (fields) : champ SANS label visible, SANS placeholder et SANS aria-label = KO ;',
    '  si un placeholder descriptif OU un aria-label existe = OK (pas de flag).',
    '',
    'Réponds sous TRÈS strict JSON, sans markdown, sans texte hors JSON :',
    '{"issues":[{"id":"img-0|lnk-0|fld-0","verdict":"ok|ko","impact":"minor|moderate","reason":"une courte justification FR"}]}',
    'Ne liste QUE les verdicts "ko". Si rien n\'est fautif, {"issues":[]}.',
  ].join('\n');

  const body = {
    model: currentModel(),
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify(signal) },
    ],
    temperature: 0.1,
    response_format: { type: 'json_object' },
    max_tokens: 2000,
    // 22/08 : l'endpoint Baidu d'OpenRouter produit des generations degenerees/vides - on l'exclut
    provider: { order: ['DeepSeek', 'GMICloud', 'StreamLake'], ignore: ['Baidu'], allow_fallbacks: true },
  };

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), SCANNER_LLM_TIMEOUT_MS) : null;
  try {
    const resp = await fetch(SCANNER_LLM_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + apiKey,
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller ? controller.signal : undefined,
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error('LLM HTTP ' + resp.status + ': ' + errText.slice(0, 200));
    }
    const json = await resp.json();
    const usage = (json && json.usage) || {};
    const content = ((json && json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content) || '').trim();
    return {
      content,
      usage: {
        prompt_tokens: usage.prompt_tokens || 0,
        completion_tokens: usage.completion_tokens || 0,
        total_tokens: usage.total_tokens || 0,
      },
      cost_usd: estimateCost(currentModel(), usage.prompt_tokens || 0, usage.completion_tokens || 0),
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// --- Parser : verdicts "ko" -> issues scanner étiquetées analyse IA ---
function parseSemanticResult(content) {
  const t = (content || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  const tryParse = (s) => { try { return JSON.parse(s); } catch { return null; } };
  let data = tryParse(t);
  if (!data && t) {
    let m = t.match(/\{[\s\S]*\}/);
    if (m) data = tryParse(m[0]);
  }
  // rassemble les verdicts "ko" quelle que soit la forme (nested "issues" ou objet plat)
  let items = [];
  if (Array.isArray(data)) items = data;
  else if (data && Array.isArray(data.issues)) items = data.issues;
  else if (data && typeof data === 'object') {
    // objet plat indexé par id avec {verdict, reason} OU {id: {verdict}}
    for (const k of Object.keys(data)) {
      const v = data[k];
      if (v && typeof v === 'object' && ('verdict' in v || 'reason' in v || 'ok' in v)) {
        const vd = v.verdict !== undefined ? v.verdict : (v.ok !== undefined ? (v.ok ? 'ok' : 'ko') : '');
        items.push({ id: k, verdict: vd, reason: v.reason || v.message || v.raison || '', impact: v.impact });
      }
    }
  }
  if (data === null || data === undefined || typeof data !== 'object') {
    throw new Error('Réponse IA non structurée (JSON attendu)');
  }
  const issues = items
    .filter((i) => i && ['ko', 'bad', 'no', 'false'].includes(String(i.verdict || i.ok || '').toLowerCase().trim()))
    .map((i) => {
      const v = String(i.verdict || (i.ok === false ? 'ko' : '') || '').toLowerCase();
      const impact = (v === 'bad' || String(i.impact || '').toLowerCase() === 'major' || String(i.severity || '').toLowerCase() === 'high') ? 'moderate' : 'minor';
      const rawId = String(i.id || 'x').toLowerCase().slice(0, 40);
      const safeId = rawId.replace(/[^a-z0-9_-]/g, '');
      return {
        engine: 'ia',
        id: 'ai-semantique-' + (safeId || 'x'),
        impact,
        message: i.reason || i.message || i.raison || 'Problème sémantique détecté par analyse IA.',
        rgaa: '6.1.1',
        wcag: '1.1.1',
        ai: true,
        evidence: i.reason || i.raison || '',
        reference: String(i.ref || i.id || ''),
      };
    });
  return issues.slice(0, SCANNER_AI_MAX_ISSUES);
}

// Point d'entrée — renvoie un résultat d'analyse (jamais d'exception vers le scan)
// Retry unique si la réponse est mal structurée (JSON tronqué / exécution instable) : un
// second appel fournit le plus souvent une réponse exploitable sans casser le budget.
async function runSemanticAnalysis(page) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const signal = await collectSemanticSignal(page);
      const llm = await callSemanticAI(signal);
      const issues = parseSemanticResult(llm.content);
      return {
        status: 'ok',
        model: currentModel(),
        issues,
        usage: llm.usage,
        cost_usd: llm.cost_usd,
      };
    } catch (err) {
      if (attempt === 1) {
        return {
          status: 'error',
          model: currentModel(),
          issues: [],
          error: (err && err.message) || String(err),
        };
      }
      // premier échec : nouvelle tentative (la collecte est recalculée de toute façon)
    }
  }
  return { status: 'error', model: currentModel(), issues: [], error: 'appel IA impossible' };
}

module.exports = { runSemanticAnalysis, collectSemanticSignal, parseSemanticResult, callSemanticAI };