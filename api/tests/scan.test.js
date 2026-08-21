const { describe, it } = require('node:test');
const assert = require('node:assert');
const { normalizeUrl, validateUrl, isVagueLinkText, computeScore } = require('../scanner');
const { parseSemanticResult } = require('../semantic');

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
    const issues = Array(10).fill({ impact: 'critical' });
    assert.strictEqual(computeScore(issues), 0);
  });
});

describe('parseSemanticResult (built-in semantic parser)', () => {
  it('extrait les verdicts "ko" en issues étiquetées IA', () => {
    const out = parseSemanticResult(JSON.stringify({
      issues: [
        { id: 'img-0', verdict: 'ko', impact: 'moderate', reason: 'alt générique image' },
        { id: 'lnk-1', verdict: 'ok', reason: 'explicite' },
      ],
    }));
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].engine, 'ia');
    assert.strictEqual(out[0].ai, true);
    assert.match(out[0].message, /alt générique/);
  });

  it('accepte un objet plat indexé par id', () => {
    const out = parseSemanticResult(JSON.stringify({
      'img-0': { verdict: 'ko', reason: 'nom de fichier' },
      'lnk-1': { verdict: 'ok', reason: 'ok' },
    }));
    assert.strictEqual(out.length, 1);
    assert.match(out[0].id, /img-0/);
  });

  it('renvoie [] quand tout est correct', () => {
    const out = parseSemanticResult(JSON.stringify({ issues: [{ id: 'img-0', verdict: 'ok' }] }));
    assert.deepStrictEqual(out, []);
  });

  it('lève une erreur sur une réponse non structurée', () => {
    assert.throws(() => parseSemanticResult('pas de json'), /non structurée/);
  });
});