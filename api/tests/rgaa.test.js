const assert = require('assert');
const { describe, it } = require('node:test');
const {
  wcagCriterionOf,
  rgaaCriteriaFor,
  rgaaAnnotation,
  rgaaSectionHtml,
} = require('../reports/rgaa');

describe('rgaa: wcagCriterionOf', () => {
  it('lit le champ wcag explicite', () => {
    assert.strictEqual(wcagCriterionOf({ wcag: '3.1.1' }), '3.1.1');
  });
  it('parse les tags axe (wcag143, wcag1411, wcag258)', () => {
    assert.strictEqual(wcagCriterionOf({ tags: ['wcag2aa', 'wcag143'] }), '1.4.3');
    assert.strictEqual(wcagCriterionOf({ tags: ['wcag1411'] }), '1.4.11');
    assert.strictEqual(wcagCriterionOf({ tags: ['wcag258'] }), '2.5.8');
  });
  it('ignore les tags de niveau (wcag2a, wcag21aa)', () => {
    assert.strictEqual(wcagCriterionOf({ tags: ['wcag2a', 'wcag21aa'] }), null);
  });
});

describe('rgaa: rgaaCriteriaFor', () => {
  it('utilise le champ rgaa explicite des issues custom', () => {
    const c = rgaaCriteriaFor({ id: 'no-h1', rgaa: '9.1' });
    assert.strictEqual(c[0].id, '9.1');
    assert.strictEqual(c[0].theme, 'Structuration de l\u2019information');
  });
  it('normalise une référence de test (x.y.z) vers le critère (x.y)', () => {
    const c = rgaaCriteriaFor({ id: 'form-missing-label', rgaa: '11.1.2' });
    assert.strictEqual(c[0].id, '11.1');
  });
  it('applique la surcharge par règle axe', () => {
    const c = rgaaCriteriaFor({ id: 'color-contrast', tags: ['wcag143'] });
    assert.deepStrictEqual(c.map((x) => x.id), ['3.2']);
    const b = rgaaCriteriaFor({ id: 'button-name', tags: ['wcag412'] });
    assert.deepStrictEqual(b.map((x) => x.id), ['7.1', '11.9']);
  });
  it('retombe sur la correspondance générique WCAG', () => {
    const c = rgaaCriteriaFor({ id: 'regle-inconnue', tags: ['wcag111'] });
    assert.deepStrictEqual(c.map((x) => x.id), ['1.1']);
  });
  it('rend [] quand rien ne correspond', () => {
    assert.deepStrictEqual(rgaaCriteriaFor({ id: 'inconnu' }), []);
  });
});

describe('rgaa: rgaaAnnotation', () => {
  it('formate RGAA + critères', () => {
    const a = rgaaAnnotation({ id: 'color-contrast', tags: ['wcag143'] });
    assert.strictEqual(a.text, 'RGAA 3.2');
  });
  it('signale les règles WCAG 2.2 hors RGAA 4.1', () => {
    const a = rgaaAnnotation({ id: 'small-touch-target', wcag: '2.5.8' });
    assert.match(a.text, /hors RGAA|WCAG 2\.2/);
  });
  it('signale l\u2019obligation légale de déclaration', () => {
    const a = rgaaAnnotation({ id: 'accessibility-statement-missing', rgaa: null });
    assert.match(a.text, /art\. 47|Obligation légale/);
  });
});

describe('rgaa: section rapport', () => {
  const issues = [
    { engine: 'axe', id: 'color-contrast', tags: ['wcag143'], message: 'Contraste insuffisant', pages: ['/', '/contact'] },
    { engine: 'custom', id: 'no-h1', rgaa: '9.1', message: 'Aucun h1.', pages: ['/'] },
    { engine: 'custom', id: 'accessibility-statement-missing', rgaa: null, message: 'Déclaration absente.', pages: ['/'] },
  ];

  it('groupe les problèmes par critère RGAA avec pages (multi-pages)', () => {
    const html = rgaaSectionHtml(issues, { pages: [{}, {}] });
    assert.ok(html.includes('Correspondance RGAA 4.1'));
    assert.ok(html.includes('3.2'));
    assert.ok(html.includes('Couleurs'));
    assert.ok(html.includes('9.1'));
    assert.ok(html.includes('/, /contact'));
    assert.ok(html.includes('art. 47'));
    assert.ok(!html.includes('<script'));
  });

  it('sans la colonne pages en audit mono-page', () => {
    const html = rgaaSectionHtml(issues, { pages: [{}] });
    assert.ok(!html.includes('Pages concernées'));
  });

  it('affiche une bonne nouvelle sans problème', () => {
    const html = rgaaSectionHtml([], {});
    assert.ok(html.includes('Aucun problème détecté'));
  });

  it('échappe les messages du site scanné', () => {
    const html = rgaaSectionHtml([
      { engine: 'axe', id: 'color-contrast', tags: ['wcag143'], message: '<script>alert(1)</script>', pages: ['/'] },
    ], {});
    assert.ok(!html.includes('<script'));
  });
});
