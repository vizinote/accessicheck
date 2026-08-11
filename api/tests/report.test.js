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
});
