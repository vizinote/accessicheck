const assert = require('assert');
const { describe, it } = require('node:test');
const { generateReportHtml } = require('../reports/reportGenerator');

function makeScan(offer) {
  return {
    id: 'test-report-' + offer,
    url: 'https://example.com',
    offer,
    status: 'done',
    created_at: '2026-08-11T10:00:00.000Z',
    finished_at: '2026-08-11T10:01:00.000Z',
    result: {
      url: 'https://example.com',
      pageTitle: 'Example Domain',
      status: 200,
      score: 65,
      summary: { total: 5, byImpact: { moderate: 3, minor: 2 }, byEngine: { axe: 3, custom: 2 } },
      issues: [
        { engine: 'axe', id: 'color-contrast', impact: 'moderate', help: 'Contraste insuffisant' },
        { engine: 'custom', id: 'no-h1', impact: 'moderate', message: 'Aucun h1.' },
      ],
      scanned_at: '2026-08-11T10:01:00.000Z',
      coverage_note: 'Ce scan couvre uniquement les critères automatiquement testables. Un audit humain reste nécessaire pour une conformité RGAA complète.',
    },
  };
}

describe('report generator', () => {
  it('renders oneshot HTML', async () => {
    const html = await generateReportHtml(makeScan('oneshot'));
    assert(html.includes('Diagnostic express'));
    assert(html.includes('One-Shot'));
    assert(html.includes('65<small>/100</small>'));
    assert(html.includes('Ce scan couvre uniquement'));
    assert(!html.includes('<script'));
  });

  it('renders pro HTML', async () => {
    const html = await generateReportHtml(makeScan('pro'));
    assert(html.includes('Rapport d\'audit détaillé'));
    assert(html.includes('Pro'));
    assert(html.includes('Résumé pour le dirigeant'));
    assert(html.includes('Plan de remédiation'));
  });

  it('parses string result from DB', async () => {
    const scan = makeScan('oneshot');
    scan.result = JSON.stringify(scan.result);
    const html = await generateReportHtml(scan);
    assert(html.includes('65<small>/100</small>'));
  });

  it('renders monitoring HTML', async () => {
    const html = await generateReportHtml(makeScan('monitoring'));
    assert(html.includes('Synthèse mensuelle'));
    assert(html.includes('Monitoring'));
    assert(html.includes('Alertes régression'));
  });

  it('rejects unknown offer', async () => {
    await assert.rejects(() => generateReportHtml(makeScan('unknown')));
  });

  it('affiche la correspondance RGAA 4.1 dans le rapport', async () => {
    const scan = makeScan('pro');
    scan.result.issues = [
      { engine: 'axe', id: 'color-contrast', impact: 'moderate', help: 'Contraste insuffisant', tags: ['wcag143'] },
    ];
    const html = await generateReportHtml(scan);
    assert(html.includes('Correspondance RGAA 4.1'));
    assert(html.includes('3.2'));
    assert(html.includes('RGAA 3.2'));
  });

  it('affiche le tableau multi-pages quand le résultat contient des pages', async () => {
    const scan = makeScan('oneshot');
    scan.result.pages = [
      { url: 'https://example.com/', path: '/', pageTitle: 'Home', score: 80, issuesCount: 3, status: 'done', error: null },
      { url: 'https://example.com/contact', path: '/contact', pageTitle: 'Contact', score: 55, issuesCount: 9, status: 'done', error: null },
    ];
    scan.result.pages_count = 2;
    const html = await generateReportHtml(scan);
    assert(html.includes('Audit multi-pages'));
    assert(html.includes('/contact'));
    assert(html.includes('55/100'));
    assert(html.includes('Score global'));
  });

  it('n\u2019affiche pas de section multi-pages pour un résultat mono-page (rétro-compat)', async () => {
    const html = await generateReportHtml(makeScan('monitoring'));
    assert(!html.includes('Audit multi-pages'));
  });

  it('traduit les messages axe bruts en français dans le rendu', async () => {
    const scan = makeScan('pro');
    scan.result.issues = [
      { engine: 'axe', id: 'color-contrast', impact: 'serious', help: 'Elements must meet minimum color contrast ratio thresholds' },
    ];
    const html = await generateReportHtml(scan);
    assert(!html.includes('Elements must meet minimum color contrast'));
    assert(html.includes('contraste'));
  });

  it('les couleurs du score passent le ratio 4,5:1 sur les fonds du gabarit', async () => {
    const { scoreColor } = require('../reports/templates');
    assert(typeof scoreColor === 'function');
    const lum = (hex) => {
      const c = parseInt(hex.slice(1), 16);
      const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      return 0.2126 * f((c >> 16) & 255) + 0.7152 * f((c >> 8) & 255) + 0.0722 * f(c & 255);
    };
    const ratio = (fg, bg) => {
      const [l1, l2] = [lum(fg), lum(bg)].sort((a, b) => b - a);
      return (l1 + 0.05) / (l2 + 0.05);
    };
    const fonds = ['#ffffff', '#f0fdfa', '#f9fafb']; // corps, résumé dirigeant, cartes
    for (const score of [95, 75, 55, 20]) {
      const color = scoreColor(score);
      for (const fond of fonds) {
        assert(ratio(color, fond) >= 4.5, `score ${score} : ${color} sur ${fond} = ${ratio(color, fond).toFixed(2)}:1 < 4,5:1`);
      }
    }
  });
});
