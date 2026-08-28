const assert = require('assert');
const { describe, it } = require('node:test');
const { generateReportHtml } = require('../reports/reportGenerator');

// Fixture riche : axe (contrast avec données mesurées), custom, hors-grille RGAA.
function makeScan(offer) {
  return {
    id: 'test-vulg-' + offer,
    url: 'https://example.com',
    offer,
    status: 'done',
    created_at: '2026-08-27T10:00:00.000Z',
    finished_at: '2026-08-27T10:01:00.000Z',
    result: {
      url: 'https://example.com',
      pageTitle: 'Example Domain',
      status: 200,
      score: 62,
      summary: { total: 4, byImpact: { serious: 2, moderate: 2 }, byEngine: { axe: 1, custom: 3 } },
      issues: [
        {
          engine: 'axe', id: 'color-contrast', impact: 'serious',
          help: 'Elements must meet minimum color contrast ratio thresholds',
          nodes: [{ target: ['.nav a'], html: '<a class="nav" href="/x">Lien</a>', data: { fgColor: '#a0a0a0', bgColor: '#ffffff', contrastRatio: 2.8, expectedContrastRatio: '4.5:1' } }],
        },
        { engine: 'custom', id: 'skip-link-missing', impact: 'serious', message: 'Aucun lien d’évitement détecté.', count: 1 },
        { engine: 'custom', id: 'accessibility-statement-missing', impact: 'moderate', message: 'Pas de déclaration d’accessibilité.', count: 1 },
        { engine: 'custom', id: 'small-touch-target', impact: 'moderate', message: '3 cibles trop petites.', count: 3 },
      ],
      scanned_at: '2026-08-27T10:01:00.000Z',
      coverage_note: 'Ce scan couvre uniquement les critères automatiquement testables.',
    },
  };
}

describe('vulgarisation du rapport (non-développeurs)', () => {
  it('encart « Comment lire ce rapport » en début de rapport FR (3 offres)', async () => {
    for (const offer of ['oneshot', 'pro', 'monitoring']) {
      const html = await generateReportHtml(makeScan(offer));
      assert(html.includes('Comment lire ce rapport'), `${offer} : encart FR manquant`);
      assert(html.includes('Ce que cet outil vérifie'), `${offer} : ce qui est vérifié`);
      assert(html.includes('Ce qu’il ne vérifie pas'), `${offer} : ce qui n'est pas vérifié`);
      assert(html.includes('Par où commencer'), `${offer} : par où commencer`);
      // L'encart précède le score (on cible le HTML, pas le CSS du <style>).
      assert(html.indexOf('Comment lire ce rapport') < html.indexOf('<div class="score-ring"'), `${offer} : encart avant le score`);
    }
  });

  it('encart « How to read this report » EN (3 offres)', async () => {
    for (const offer of ['oneshot', 'pro', 'monitoring']) {
      const html = await generateReportHtml(makeScan(offer), 'en');
      assert(html.includes('<html lang="en">'), `${offer} : lang=en`);
      assert(html.includes('How to read this report'), `${offer} : encart EN manquant`);
      assert(html.includes('What this tool checks'), `${offer}`);
      assert(html.includes('What it does not check'), `${offer}`);
      assert(html.includes('Where to start'), `${offer}`);
    }
  });

  it('chaque constat a une phrase en langage courant AVANT le code (FR)', async () => {
    const html = await generateReportHtml(makeScan('pro'));
    assert(html.includes('En clair :'));
    // La phrase simple précède le premier bloc de code de la section corrections.
    const section = html.slice(html.indexOf('corrections-section'));
    assert(section.indexOf('plain-explain') < section.indexOf('fix-code'), 'phrase simple avant le code');
    // Constat contraste : la phrase citée dans la carte.
    assert(html.includes('certains textes sont difficiles à lire'));
    assert(html.includes('voici la couleur exacte à appliquer') || html.includes('Voici la couleur exacte à appliquer'));
  });

  it('chaque constat a une phrase simple AVANT le code (EN)', async () => {
    const html = await generateReportHtml(makeScan('pro'), 'en');
    assert(html.includes('In plain terms:'));
    const section = html.slice(html.indexOf('corrections-section'));
    assert(section.indexOf('plain-explain') < section.indexOf('fix-code'), 'plain sentence before code');
    assert(html.includes('hard to read because its colour is too close to the background'));
  });

  it('anti-trou : un constat inconnu reçoit quand même une phrase simple (repli)', async () => {
    const scan = makeScan('oneshot');
    scan.result.issues = [{ engine: 'axe', id: 'regle-exotique-xyz', impact: 'minor' }]; // pas de nodes, pas de message
    const html = await generateReportHtml(scan);
    const m = html.match(/class="plain-explain">([^<]+)</);
    assert(m && m[1].trim().length > 20, 'phrase de repli non vide');
    assert(m[1].startsWith('En clair'), 'repli FR en langage courant');
    const htmlEn = await generateReportHtml(scan, 'en');
    const mEn = htmlEn.match(/class="plain-explain">([^<]+)</);
    assert(mEn && mEn[1].startsWith('In plain terms'), 'repli EN');
  });

  it('glossaire minimal en fin de rapport FR (4-6 termes)', async () => {
    const html = await generateReportHtml(makeScan('oneshot'));
    assert(html.includes('Glossaire'));
    for (const term of ['Skip-link', 'Ratio de contraste', 'ARIA', 'Cible tactile']) {
      assert(html.includes(term), `terme manquant : ${term}`);
    }
    const section = html.slice(html.indexOf('glossary-section'));
    const nTerms = (section.match(/<dt>/g) || []).length;
    assert(nTerms >= 4 && nTerms <= 6, `4-6 termes attendus, trouvé ${nTerms}`);
  });

  it('glossaire EN', async () => {
    const html = await generateReportHtml(makeScan('pro'), 'en');
    assert(html.includes('Glossary'));
    for (const term of ['Skip link', 'Contrast ratio', 'ARIA', 'Touch target']) {
      assert(html.includes(term), `term missing: ${term}`);
    }
  });

  it('rapport EN sans marqueur français non traduit', async () => {
    const html = await generateReportHtml(makeScan('pro'), 'en');
    for (const fr of ['Résumé pour le dirigeant', 'Corrections prêtes à coller', 'Correspondance RGAA 4.1', 'Plan de remédiation', 'Comment corriger', 'Avant', 'Éléments fautifs', 'Problèmes détectés']) {
      assert(!html.includes(fr), `reliquat FR dans le rapport EN : ${fr}`);
    }
    assert(html.includes('Executive summary'));
    assert(html.includes('Ready-to-paste fixes'));
    assert(html.includes('RGAA 4.1 mapping'));
    assert(html.includes('Prioritised remediation plan'));
  });

  it('messages custom traduits en EN (skip-link)', async () => {
    const html = await generateReportHtml(makeScan('pro'), 'en');
    assert(html.includes('skip link') || html.includes('Skip to content'), 'message custom EN');
    assert(!html.includes('Aucun lien d’évitement'), 'pas de message custom FR brut en EN');
  });

  it('le commentaire du correctif contraste est traduit (EN)', async () => {
    const html = await generateReportHtml(makeScan('pro'), 'en');
    assert(html.includes('measured ratio'), 'commentaire mesuré EN');
    assert(!html.includes('ratio mesuré'), 'pas de commentaire FR en EN');
  });

  it('langue inconnue → repli français', async () => {
    const html = await generateReportHtml(makeScan('oneshot'), 'de');
    assert(html.includes('<html lang="fr">'));
    assert(html.includes('Comment lire ce rapport'));
  });

  it('RGAA hors-grille traduit (déclaration d’accessibilité)', async () => {
    const htmlFr = await generateReportHtml(makeScan('pro'));
    assert(htmlFr.includes('Obligation légale'));
    const htmlEn = await generateReportHtml(makeScan('pro'), 'en');
    assert(htmlEn.includes('Legal requirement'));
    assert(htmlEn.includes('Requirements outside the criteria grid'));
  });

  it('note de couverture traduite en EN (multi-pages), FR préservée', async () => {
    const scan = makeScan('pro');
    scan.result.pages = [
      { url: 'https://example.com/', path: '/', pageTitle: 'Home', score: 60, issuesCount: 4, status: 'done', error: null },
      { url: 'https://example.com/contact', path: '/contact', pageTitle: 'Contact', score: 70, issuesCount: 2, status: 'done', error: null },
    ];
    const htmlFr = await generateReportHtml(scan);
    assert(htmlFr.includes('Ce scan couvre uniquement'), 'note FR conservée');
    const htmlEn = await generateReportHtml(scan, 'en');
    assert(htmlEn.includes('Multi-page audit: 2 key pages analysed'), 'note EN multi-pages');
    assert(htmlEn.includes('a human audit is still required'), 'note EN');
    assert(!htmlEn.includes('Ce scan couvre uniquement'), 'pas de note FR dans le rapport EN');
  });
});
