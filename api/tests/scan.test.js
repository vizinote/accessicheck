const { describe, it } = require('node:test');
const assert = require('node:assert');
const { normalizeUrl, validateUrl, isVagueLinkText, computeScore } = require('../scanner');

describe('scanner helpers', () => {
  it('normalise une URL sans protocole', () => {
    assert.strictEqual(normalizeUrl('example.com'), 'https://example.com/');
  });

  it('rejette une URL locale (localhost sans point)', () => {
    const err = validateUrl('http://localhost:3000');
    assert.ok(err); // renvoie une erreur (domaine invalide à défaut d'être privé)
  });

  it('rejette une adresse IP privée', () => {
    const err = validateUrl('http://192.168.1.1');
    assert.strictEqual(err, 'Adresse locale ou privée non autorisée.');
  });

  it('accepte une URL publique', () => {
    assert.strictEqual(validateUrl('https://example.com'), null);
  });

  it('rejette une URL invalide', () => {
    assert.ok(validateUrl('pas une url'));
  });
});

describe('isVagueLinkText (WCAG 2.4.4 / RGAA 7.5.1)', () => {
  it('détecte les libellés ambigus', () => {
    assert.strictEqual(isVagueLinkText('Cliquez ici'), true);
    assert.strictEqual(isVagueLinkText('cliquez ici.'), true);
    assert.strictEqual(isVagueLinkText('en savoir plus'), true);
    assert.strictEqual(isVagueLinkText('ICI !'), true);
    assert.strictEqual(isVagueLinkText('lire la suite…'), true);
  });

  it('ignore les libellés explicites', () => {
    assert.strictEqual(isVagueLinkText('Voir la notice RGAA PDF'), false);
    assert.strictEqual(isVagueLinkText('Tarifs'), false);
    assert.strictEqual(isVagueLinkText(''), false);
  });
});

describe('computeScore', () => {
  it('rend 100 sans issue', () => {
    assert.strictEqual(computeScore([]), 100);
  });

  it('proportionne la pénalité', () => {
    const issues = [
      { impact: 'serious' },
      { impact: 'moderate' },
      { type: 'error' },
      { type: 'notice' },
    ];
    const score = computeScore(issues);
    // 8 + 5 + 10 + 2 = 25 -> 75
    assert.strictEqual(score, 75);
    assert.ok(score >= 0 && score <= 100);
  });

  it('plancher à 0', () => {
    const issues = [
      { impact: 'critical' },
      { impact: 'critical' },
      { impact: 'critical' },
      { impact: 'critical' },
      { impact: 'critical' },
      { impact: 'critical' },
      { impact: 'critical' },
      { impact: 'critical' },
      { impact: 'critical' },
      { impact: 'critical' },
    ];
    assert.strictEqual(computeScore(issues), 0);
  });
});