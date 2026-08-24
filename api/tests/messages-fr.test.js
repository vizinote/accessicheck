const assert = require('assert');
const { describe, it } = require('node:test');
const { issueMessageFr, AXE_MESSAGES_FR } = require('../reports/messages-fr');

describe('messages-fr: traduction des messages moteur', () => {
  it('traduit les règles axe courantes', () => {
    const fr = issueMessageFr({
      engine: 'axe', id: 'color-contrast', impact: 'serious',
      help: 'Elements must meet minimum color contrast ratio thresholds',
    });
    assert(fr.includes('contraste'));
    assert(fr.includes('4,5:1'));
    assert(!/Elements must meet/.test(fr));
  });

  it('traduit plusieurs règles axe sans fuite anglaise', () => {
    for (const id of ['image-alt', 'label', 'button-name', 'link-name', 'html-has-lang', 'document-title', 'heading-order', 'region']) {
      const fr = issueMessageFr({ engine: 'axe', id, help: 'Some raw english help text' });
      assert(AXE_MESSAGES_FR[id], `règle ${id} dans la table`);
      assert.strictEqual(fr, AXE_MESSAGES_FR[id]);
    }
  });

  it('traduit les codes pa11y/HTMLCS par motif', () => {
    const fr = issueMessageFr({
      engine: 'pa11y', code: 'WCAG2AA.Principle1.Guideline1_4.1_4_3.G18.Fail',
      message: 'This element has insufficient contrast at this conformance level.',
    });
    assert(fr.includes('contraste'));
    assert(!/insufficient contrast at this conformance/.test(fr));
  });

  it('conserve les messages custom AccessiCheck (déjà en français)', () => {
    const msg = 'Aucun lien d\'évitement (skip-link) détecté.';
    assert.strictEqual(issueMessageFr({ engine: 'custom', id: 'skip-link-missing', message: msg }), msg);
  });

  it('conserve les messages de l\'analyse IA', () => {
    const msg = 'Texte alternatif générique « image1.jpg » à réécrire.';
    assert.strictEqual(issueMessageFr({ engine: 'ia', ai: true, message: msg }), msg);
  });

  it('rejette en français toute règle inconnue (jamais d\'anglais brut)', () => {
    const fr = issueMessageFr({ engine: 'axe', id: 'regle-inconnue-xyz', help: 'Raw english message' });
    assert(!/Raw english/.test(fr));
    assert(fr.includes('regle-inconnue-xyz'));
    assert(/détecté par/.test(fr));
  });
});
