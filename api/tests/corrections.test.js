const assert = require('assert');
const { describe, it } = require('node:test');
const { generateReportHtml } = require('../reports/reportGenerator');
const {
  failedElements,
  elementCount,
  elementsListHtml,
  correctionBoxHtml,
  correctionsSectionHtml,
  suggestedTextColor,
  escapeHtml,
} = require('../reports/corrections');

function scanWithIssues(issues) {
  return {
    id: 'test-corrections',
    url: 'https://example.com',
    offer: 'pro',
    status: 'done',
    created_at: '2026-08-11T10:00:00.000Z',
    finished_at: '2026-08-11T10:01:00.000Z',
    result: {
      url: 'https://example.com',
      pageTitle: 'Example',
      status: 200,
      score: 40,
      summary: { total: issues.length, byImpact: {}, byEngine: {} },
      issues,
      scanned_at: '2026-08-11T10:01:00.000Z',
      coverage_note: 'test',
    },
  };
}

describe('corrections: élément fautif extrait', () => {
  it('extrait sélecteur + extrait HTML des noeuds axe', () => {
    const issue = {
      id: 'image-alt', impact: 'serious',
      nodes: [
        { target: ['#hero > img'], html: '<img src="/a.png">' },
        { target: ['.card img'], html: '<img src="/b.jpg" alt="">' },
      ],
    };
    const els = failedElements(issue);
    assert.strictEqual(els.length, 2);
    assert.strictEqual(els[0].selector, '#hero > img');
    assert.strictEqual(els[1].html, '<img src="/b.jpg" alt="">');
    assert.strictEqual(elementCount(issue), 2);
  });

  it('respecte le cap de 5 éléments par issue', () => {
    const issue = {
      id: 'button-name', impact: 'critical',
      nodes: Array.from({ length: 9 }, (_, k) => ({ target: [`#b${k}`], html: '<button></button>' })),
    };
    const els = failedElements(issue, 5);
    assert.strictEqual(els.length, 5);
    assert.strictEqual(elementCount(issue), 9);
    const html = elementsListHtml(issue, 5);
    assert.ok(html.includes('+ 4 autre(s)'));
  });

  it('retombe sur selector/context pour les issues pa11y', () => {
    const issue = { code: 'color-contrast', selector: 'p.erreur', context: '<p>…</p>' };
    const els = failedElements(issue);
    assert.strictEqual(els.length, 1);
    assert.strictEqual(els[0].selector, 'p.erreur');
    assert.strictEqual(els[0].html, '<p>…</p>');
  });

  it('retombe sur samples s\'il n\'y a pas de DOM extrait', () => {
    const issue = { id: 'pdf-links', samples: ['/a.pdf', '/b.pdf', '/c.pdf'] };
    assert.strictEqual(elementCount(issue), 3);
    assert.strictEqual(failedElements(issue, 5).length, 3);
  });
});

describe('corrections: rendu échappé (sécurité)', () => {
  it('échappe tout HTML/snippet du site scanné (pas d\'injection)', () => {
    const malicious = { target: ['evil'], html: '<img src="x" onerror="alert(1)"><script>alert(2)</script>' };
    const html = elementsListHtml({ id: 'image-alt', nodes: [malicious] });
    // Les balises sont échappées : aucun vrai élément HTML exécutable, juste du texte.
    assert.ok(!html.includes('<script'));
    assert.ok(!/<img\s/.test(html));            // aucun <img> non échappé
    assert.ok(html.includes('&lt;script&gt;'));
    assert.ok(html.includes('&lt;img'));
    // onerror= reste en texte échappé (guillemets → &quot;) mais les balises sont inertes
    assert.ok(html.includes('onerror=&quot;alert(1)&quot;'));
  });

  it('gabarit de correction échappe les valeurs mesurées', () => {
    const issue = { id: 'color-contrast', nodes: [{ html: '<p style="color:#a0a0a0">x</p>', data: { fgColor: '#a0a0a0', bgColor: '#ffffff', contrastRatio: 2.6 } }] };
    const box = correctionBoxHtml(issue, issue.nodes[0]);
    assert.ok(!box.includes('<script'));
    assert.ok(box.includes('2.6:1') || box.includes('2.6'));
  });

  it('suggestedTextColor choisit une couleur lisible déterministe', () => {
    assert.strictEqual(suggestedTextColor('#ffffff').color, '#111827'); // fond clair -> texte sombre
    assert.strictEqual(suggestedTextColor('#000000').color, '#ffffff'); // fond sombre -> texte clair
    assert.ok(suggestedTextColor('pashex').color); // couleur de repli
  });
});

describe('corrections: section dans les rapports', () => {
  it('le rapport pro contient la section + sélecteur', async () => {
    const issues = [
      { engine: 'axe', id: 'image-alt', impact: 'serious', help: 'Images without alt',
        nodes: [{ target: ['#hero img'], html: '<img src="/x.png">' }] },
    ];
    const html = await generateReportHtml(scanWithIssues(issues));
    assert.ok(html.includes('Corrections détaillées'));
    assert.ok(html.includes('#hero img'));
    assert.ok(html.includes('Comment corriger'));
  });

  it('cap de 10 issues dans la section (par impact décroissant)', async () => {
    const issues = Array.from({ length: 14 }, (_, k) => ({
      engine: 'axe', id: 'button-name', impact: k < 3 ? 'critical' : 'moderate',
      help: `Problème ${k}`, nodes: [{ target: [`#b${k}`], html: '<button></button>' }],
    }));
    const html = await generateReportHtml(scanWithIssues(issues));
    // 10 corrections items max
    const count = (html.match(/class="correction-item"/g) || []).length;
    assert.ok(count <= 10, `attendu ≤ 10, obtenu ${count}`);
  });

  it("échappe les sélecteurs/issues dans la section finale", async () => {
    const issues = [
      { engine: 'axe', id: 'image-alt', impact: 'serious', help: '<script>x</script>',
        nodes: [{ target: ['bogus"], evil)'], html: '"><script>alert(1)</script>' }] },
    ];
    const html = await generateReportHtml(scanWithIssues(issues));
    assert.ok(!html.includes('<script'));
  });

  it('ne rend rien de cassé quand aucune issue n\'a de gabarit', async () => {
    const html = await generateReportHtml(scanWithIssues([]));
    assert.ok(html.includes('Corrections détaillées'));
    assert.ok(html.includes('Aucun problème détecté'));
  });
});

describe('escapeHtml', () => {
  it('échappe les caractères HTML', () => {
    assert.strictEqual(escapeHtml('<img src="x" onerror=\'a\'> &'), '&lt;img src=&quot;x&quot; onerror=&#39;a&#39;&gt; &amp;');
  });
});