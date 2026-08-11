const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const { normalizeUrl, validateUrl } = require('../scanner');
const { validateOffer } = require('../engine/scan');

describe('scanner helpers', () => {
  it('normalise une URL sans protocole', () => {
    assert.strictEqual(normalizeUrl('example.com'), 'https://example.com/');
  });

  it('rejette une URL privée', () => {
    const err = validateUrl('http://localhost:3000');
    assert.strictEqual(err, 'Adresse locale ou privée non autorisée.');
  });

  it('accepte une URL publique', () => {
    assert.strictEqual(validateUrl('https://example.com'), null);
  });

  it('rejette une URL invalide', () => {
    assert.ok(validateUrl('pas une url'));
  });
});

describe('offer validation', () => {
  it('accepte les offres connues', () => {
    assert.strictEqual(validateOffer('oneshot'), null);
    assert.strictEqual(validateOffer('pro'), null);
    assert.strictEqual(validateOffer('monitoring'), null);
  });

  it('rejette une offre inconnue', () => {
    assert.ok(validateOffer('enterprise'));
  });
});
