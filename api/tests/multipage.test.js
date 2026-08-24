const assert = require('assert');
const { describe, it } = require('node:test');
const { canonicalize, rankLinks, pagePath, mergeIssues, mergeSummary } = require('../multipage');

const BASE = 'https://exemple.fr/';

describe('multipage: canonicalize', () => {
  it('accepte un lien interne et le normalise', () => {
    assert.strictEqual(canonicalize('/contact', BASE), 'https://exemple.fr/contact');
    assert.strictEqual(canonicalize('https://exemple.fr/contact/', BASE), 'https://exemple.fr/contact');
    assert.strictEqual(canonicalize('https://www.exemple.fr/contact', BASE), 'https://exemple.fr/contact');
  });

  it('rejette les liens externes, ancres, fichiers et protocols non http', () => {
    assert.strictEqual(canonicalize('https://autre.fr/page', BASE), null);
    assert.strictEqual(canonicalize('mailto:x@exemple.fr', BASE), null);
    assert.strictEqual(canonicalize('tel:+33600000000', BASE), null);
    assert.strictEqual(canonicalize('/brochure.pdf', BASE), null);
    assert.strictEqual(canonicalize('/img/logo.png', BASE), null);
    assert.strictEqual(canonicalize('/wp-admin/options.php', BASE), null);
  });

  it('retire les ancres et les paramètres de tracking', () => {
    assert.strictEqual(canonicalize('/contact#form', BASE), 'https://exemple.fr/contact');
    assert.strictEqual(canonicalize('/services?utm_source=nl&id=12', BASE), 'https://exemple.fr/services?id=12');
  });

  it('écarte les pages de démonstration / exemple du crawl', () => {
    assert.strictEqual(canonicalize('/exemple-rapport.html', BASE), null);
    assert.strictEqual(canonicalize('/exemple_rapport', BASE), null);
    assert.strictEqual(canonicalize('/demo/produit', BASE), null);
    assert.strictEqual(canonicalize('/examples/grid', BASE), null);
    assert.strictEqual(canonicalize('/maquettes/v2', BASE), null);
    // Les vraies pages métier ne sont pas affectées
    assert.strictEqual(canonicalize('/contact', BASE), 'https://exemple.fr/contact');
    assert.strictEqual(canonicalize('/demarrage', BASE), 'https://exemple.fr/demarrage');
  });
});

describe('multipage: rankLinks', () => {
  it('priorise contact, services, mentions légales puis navigation', () => {
    const links = [
      { href: 'https://exemple.fr/blog/article-1', text: 'Article', nav: false },
      { href: 'https://exemple.fr/mentions-legales', text: 'Mentions légales', nav: false },
      { href: 'https://exemple.fr/tarifs', text: 'Nos tarifs', nav: true },
      { href: 'https://exemple.fr/contact', text: 'Contact', nav: true },
      { href: 'https://exemple.fr/', text: 'Accueil', nav: true },
      { href: 'https://externe.fr/x', text: 'Externe', nav: true },
    ];
    const ranked = rankLinks(links, BASE);
    assert.deepStrictEqual(ranked.slice(0, 3), [
      'https://exemple.fr/contact',
      'https://exemple.fr/tarifs',
      'https://exemple.fr/mentions-legales',
    ]);
    // La home et les externes sont exclus
    assert.ok(!ranked.includes('https://exemple.fr/'));
    assert.ok(!ranked.includes('https://externe.fr/x'));
    assert.strictEqual(ranked.length, 4);
  });

  it('déduplique les URLs canoniques', () => {
    const links = [
      { href: 'https://exemple.fr/contact', text: 'Contact', nav: true },
      { href: 'https://exemple.fr/contact#form', text: 'Écrivez-nous', nav: false },
      { href: 'https://exemple.fr/contact/', text: 'Nous joindre', nav: false },
    ];
    const ranked = rankLinks(links, BASE);
    assert.strictEqual(ranked.length, 1);
  });
});

describe('multipage: pagePath', () => {
  it('rend le chemin relatif pour le même hôte', () => {
    assert.strictEqual(pagePath('https://exemple.fr/contact', BASE), '/contact');
    assert.strictEqual(pagePath('https://exemple.fr/', BASE), '/');
  });
});

describe('multipage: mergeIssues', () => {
  it('fusionne une même issue présente sur plusieurs pages', () => {
    const pageResults = [
      { path: '/', result: { issues: [{ engine: 'axe', id: 'color-contrast', nodes: [{ target: ['.nav a'] }] }] } },
      { path: '/contact', result: { issues: [{ engine: 'axe', id: 'color-contrast', nodes: [{ target: ['.nav a'] }] }] } },
      { path: '/tarifs', result: { issues: [{ engine: 'custom', id: 'no-h1' }] } },
    ];
    const merged = mergeIssues(pageResults);
    assert.strictEqual(merged.length, 2);
    const contrast = merged.find((i) => i.id === 'color-contrast');
    assert.deepStrictEqual(contrast.pages, ['/', '/contact']);
    assert.strictEqual(contrast.page, '/');
  });

  it('conserve des issues distinctes si les sélecteurs diffèrent', () => {
    const pageResults = [
      { path: '/', result: { issues: [{ engine: 'axe', id: 'image-alt', nodes: [{ target: ['#a'] }] }] } },
      { path: '/p2', result: { issues: [{ engine: 'axe', id: 'image-alt', nodes: [{ target: ['#b'] }] }] } },
    ];
    assert.strictEqual(mergeIssues(pageResults).length, 2);
  });
});

describe('multipage: mergeSummary', () => {
  it('agrège impact, moteur et couche', () => {
    const summary = mergeSummary([
      { impact: 'serious', engine: 'axe' },
      { impact: 'serious', engine: 'custom', layer: 'interaction' },
      { type: 'notice', engine: 'ia', ai: true },
    ]);
    assert.strictEqual(summary.total, 3);
    assert.strictEqual(summary.byImpact.serious, 2);
    assert.strictEqual(summary.byLayer.ia, 1);
    assert.strictEqual(summary.byLayer.interaction, 1);
  });
});
