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
});
