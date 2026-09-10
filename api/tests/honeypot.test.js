const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { describe, it } = require('node:test');

// Garde-fou anti-divergence : le prédicat estHoneypot doit être présent et
// IDENTIQUE dans scanner.js (constat form-missing-label) et semantic.js
// (signal IA). Un champ honeypot vu par l'un et pas l'autre = faux positif.
const HONEYPOT_RE = /(^|[\s_.:-])(hp|honeypot|anti-?spam)([\s_.:-]|$)/i;

function predicateOf(file) {
  const src = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const m = src.match(/const estHoneypot = \(el\) => \{[\s\S]*?\};/);
  return m ? m[0] : null;
}

describe('honeypot: exclusion anti-spam', () => {
  it('le regex reconnait les marqueurs hp/honeypot/anti-spam dans class/name/id', () => {
    assert.ok(HONEYPOT_RE.test('field hp'));
    assert.ok(HONEYPOT_RE.test('my-honeypot'));
    assert.ok(HONEYPOT_RE.test('antispam_field'));
    assert.ok(HONEYPOT_RE.test('anti-spam'));
    assert.ok(!HONEYPOT_RE.test('homepage'));
    assert.ok(!HONEYPOT_RE.test('php-mail'));
    assert.ok(!HONEYPOT_RE.test('champs'));
  });

  it('scanner.js et semantic.js portent le même prédicat estHoneypot', () => {
    const scanner = predicateOf('scanner.js');
    const semantic = predicateOf('semantic.js');
    assert.ok(scanner, 'estHoneypot absent de scanner.js');
    assert.ok(semantic, 'estHoneypot absent de semantic.js');
    assert.strictEqual(scanner, semantic, 'les deux prédicats ont divergé');
  });
});
