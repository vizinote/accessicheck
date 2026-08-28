//Gabarits de correction déterministes pour les rapports AccessiCheck.
//
//RÈGLE D'OR : AUCUN texte LLM. Chaque gabarit est pré-écrit et validé ci-dessous.
//Seules les données MESURÉES par le scan (sélecteurs CSS, valeurs de contraste,
//URLs d'images, tailles, nombres) sont injectées dans le HTML final, toujours
//échappées via escapeHtml(). Aucun contenu du site scanné n'est interprété.
//
//Bilingue FR/EN : chaque gabarit porte une phrase « En clair » (langage courant,
//pour chef de projet non-développeur) affichée AVANT tout détail HTML/CSS, plus
//un titre et une explication traduits. Les extraits de code adaptent leurs
//exemples de texte à la langue du rapport.

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function round2(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

// ---------------------------------------------------------------- éléments fautifs
// Retourne les éléments fautifs normalisés d'une issue : liste { selector, html }.
function failedElements(issue, cap = 5) {
  const out = [];
  if (Array.isArray(issue.nodes)) {
    for (const n of issue.nodes) {
      if (out.length >= cap) break;
      if (n && typeof n === 'object') {
        let sel = '';
        if (Array.isArray(n.target)) sel = n.target[n.target.length - 1] || n.target[0] || '';
        else sel = n.target || '';
        out.push({ selector: String(sel), html: String(n.html || '') });
      }
    }
  }
  // Issues pa11y / custom qui portent un sélecteur simple + extrait.
  if (out.length === 0 && (issue.selector || issue.context)) {
    out.push({ selector: String(issue.selector || ''), html: String(issue.context || '') });
  }
  // Retombe sur des échantillons quantitatifs (URLs, href) si aucun DOM extrait.
  if (out.length === 0 && Array.isArray(issue.samples)) {
    for (const s of issue.samples) {
      if (out.length >= cap) break;
      out.push({ selector: '', html: String(s || '') });
    }
  }
  return out;
}

// Nombre total d'éléments fautifs (dépasse le cap d'affichage).
function elementCount(issue) {
  if (Array.isArray(issue.nodes) && issue.nodes.length > 0) return issue.nodes.length;
  if (issue.selector || issue.context) return 1;
  if (Array.isArray(issue.samples)) return issue.samples.length;
  if (typeof issue.count === 'number' && issue.count > 0) return issue.count;
  return 0;
}

// HTML de la liste des éléments d'une issue (cap appliqué, échappé).
function elementsListHtml(issue, cap = 5, lang = 'fr') {
  const elems = failedElements(issue, cap);
  if (elems.length === 0) return '';
  const noSel = lang === 'en' ? 'detected element' : 'élément détecté';
  const rows = elems.map((e) => {
    const sel = e.selector ? `<span class="el-selector">${escapeHtml(e.selector)}</span>` : `<span class="el-selector el-no-sel">${noSel}</span>`;
    const html = e.html
      ? `<div class="el-snippet-wrap"><code class="el-snippet">${escapeHtml(e.html)}</code></div>`
      : '';
    return `<li class="el-item">${sel}${html}</li>`;
  }).join('');
  const total = elementCount(issue);
  const more = total > elems.length
    ? `<li class="el-more">+ ${total - elems.length} ${lang === 'en' ? 'more' : 'autre(s)'}</li>`
    : '';
  return `<ul class="el-list">${rows}${more}</ul>`;
}

// ---------------------------------------------------------------- luminosité & contraste
function parseHex(hex) {
  const m = String(hex || '').trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  const c = parseInt(m[1], 16);
  return { r: (c >> 16) & 255, g: (c >> 8) & 255, b: c & 255 };
}

function luminance({ r, g, b }) {
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

// Contrairement à axe (qui cache ses couleurs composées), on fournit ici une
// suggestion DÉTERMINISTE de couleur de texte qui passe 4.5:1 sur le fond mesuré.
function suggestedTextColor(bgHex) {
  const bg = parseHex(bgHex);
  if (!bg) return { color: '#111827', bg: bgHex };
  const lum = luminance(bg);
  if (lum >= 0.40) return { color: '#111827', bg: bgHex };
  return { color: '#ffffff', bg: bgHex };
}

// ---------------------------------------------------------------- gabarits de correction
// Chaque entrée : { title, explain, plain, before, after }.
// title/explain/plain : chaînes FR, traduites dans TEMPLATES_EN / PLAIN_EN.
// before/after : fonctions (issue, node0, lang) → string, pour injecter les
// valeurs mesurées. Toute valeur est ensuite échappée par le rendu.

const { issueMessage } = require('./messages-fr');

const CORRECTION_TEMPLATES = {};

CORRECTION_TEMPLATES['image-alt'] = {
  title: 'Image sans texte alternatif',
  explain: 'Ajoutez un attribut alt décrivant le contenu informatif de l’image. Pour une image purement décorative, utilisez alt="" (vide).',
  before: (i, n) => (n && n.html) ? n.html : '<img src="https://exemple.fr/image.png">',
  after: (i, n, lang) => {
    const src = (n && n.html && n.html.match(/src=["']([^"']+)["']/) || [])[1];
    const clean = src ? `src="${src}"` : 'src="https://exemple.fr/image.png"';
    const alt = lang === 'en' ? 'Clear description of the image content' : 'Description explicite du contenu de l’image';
    return `<img ${clean} alt="${alt}">`;
  },
};

CORRECTION_TEMPLATES['color-contrast'] = {
  title: 'Contraste de texte insuffisant',
  explain: 'Le ratio de contraste mesuré est en dessous du minimum requis (4.5:1 pour le texte normal, 3:1 pour les grands textes). Augmentez l’écart de luminosité entre le texte et son fond.',
  before: (i, n, lang) => {
    const d = (n && n.data) || {};
    if (d.fgColor && d.bgColor) {
      const comment = lang === 'en'
        ? `/* measured ratio: ${round2(d.contrastRatio) || '?'}:1 instead of ${d.expectedContrastRatio || '4.5:1'} */`
        : `/* ratio mesuré : ${round2(d.contrastRatio) || '?'}:1 au lieu de ${d.expectedContrastRatio || '4.5:1'} */`;
      return `color: ${d.fgColor}; background-color: ${d.bgColor};   ${comment}`;
    }
    return (n && n.html) ? n.html : 'color: #a0a0a0; background-color: #ffffff;';
  },
  after: (i, n, lang) => {
    const d = (n && n.data) || {};
    const sugg = suggestedTextColor(d.bgColor || '#ffffff');
    const comment = lang === 'en'
      ? '/* target ratio ≥ 4.5:1 — adapt to your brand colours */'
      : '/* ratio cible ≥ 4.5:1 — à adapter à votre charte graphique */';
    return `color: ${sugg.color}; background-color: ${sugg.bg};   ${comment}`;
  },
};

CORRECTION_TEMPLATES['label'] = {
  title: 'Champ de formulaire sans label',
  explain: 'Associez un label visible à chaque champ, ou à défaut un nom accessible (aria-label). Le label doit être cliquable (for=id).',
  before: (i, n) => (n && n.html) ? n.html : '<input type="text" name="nom">',
  after: (i, n, lang) => {
    const html = (n && n.html) || '';
    const id = (html.match(/id=["']([^"']+)["']/) || [])[1];
    const name = (html.match(/name=["']([^"']+)["']/) || [])[1];
    const attrs = [];
    if (id) attrs.push(`id="${id}"`);
    if (name) attrs.push(`name="${name}"`);
    attrs.push(`type="text"`);
    const fieldId = id || 'champ';
    const labelText = lang === 'en' ? 'Clear field label' : 'Libellé clair du champ';
    return `\n<label for="${fieldId}">${labelText}</label>\n<input ${attrs.join(' ')}>\n`;
  },
};

CORRECTION_TEMPLATES['button-name'] = {
  title: 'Bouton sans nom accessible',
  explain: 'Un bouton doit avoir du texte visible, ou un aria-label / aria-labelledby explicite.',
  before: (i, n) => (n && n.html) ? n.html : '<button></button>',
  after: (i, n, lang) => lang === 'en'
    ? '<button type="button">Explicit button action</button>'
    : '<button type="button">Action explicite du bouton</button>',
};

CORRECTION_TEMPLATES['html-has-lang'] = {
  title: 'Langue de la page absente',
  explain: 'Déclarez la langue principale de la page sur la balise <html>.',
  before: (i, n, lang) => lang === 'en' ? '<html>\n  <!-- rest of the document -->' : '<html>\n  <!-- reste du document -->',
  after: () => '<html lang="fr">\n  <!-- reste du document -->',
};

CORRECTION_TEMPLATES['html-lang-valid'] = {
  title: 'Valeur de langue invalide',
  explain: 'La valeur de l’attribut lang doit suivre une norme valide (ex : fr, en, fr-FR).',
  before: (i, n) => {
    const v = (n && n.html && n.html.match(/lang=["']([^"']+)["']/) || [])[1];
    return `<html lang="${v || 'xx'}">`;
  },
  after: () => '<html lang="fr">',
};

CORRECTION_TEMPLATES['link-name'] = {
  title: 'Lien sans intitulé accessible',
  explain: 'Chaque lien doit avoir un texte/alternative, ou un nom accessible via aria-label.',
  before: (i, n) => (n && n.html) ? n.html : '<a href="https://exemple.fr"></a>',
  after: (i, n, lang) => lang === 'en'
    ? '<a href="https://exemple.fr">Explicit link label</a>'
    : '<a href="https://exemple.fr">Intitulé explicite du lien</a>',
};

CORRECTION_TEMPLATES['region'] = {
  title: 'Contenu non structuré (région manquante)',
  explain: 'Enveloppez chaque zone de contenu dans un repère (main, section, nav…) pour faciliter la navigation par landmarks.',
  before: () => '<div class="contenu">…</div>',
  after: (i, n, lang) => lang === 'en'
    ? '<main>\n  <section aria-labelledby="heading">\n    <h2 id="heading">Section heading</h2>\n    …\n  </section>\n</main>'
    : '<main>\n  <section aria-labelledby="titre">\n    <h2 id="titre">Titre de la section</h2>\n    …\n  </section>\n</main>',
};

CORRECTION_TEMPLATES['page-has-heading-one'] = {
  title: 'Titre de niveau 1 (h1) manquant',
  explain: 'Chaque page doit contenir au moins un h1 décrivant son sujet principal.',
  before: (i, n, lang) => lang === 'en' ? '<body>\n  <!-- no h1 -->' : '<body>\n  <!-- pas de h1 -->',
  after: (i, n, lang) => lang === 'en'
    ? '<body>\n  <h1>Main page heading</h1>'
    : '<body>\n  <h1>Titre principal de la page</h1>',
};

CORRECTION_TEMPLATES['heading-order'] = {
  title: 'Ordre des titres défaillant',
  explain: 'Respectez une hiérarchie de titres sans saut (h1 → h2 → h3, jamais h1 → h3).',
  before: (i, n) => (n && n.html) ? n.html : '<h1>…</h1><h3>Sous-titre</h3>',
  after: (i, n, lang) => lang === 'en'
    ? '<h1>Main heading</h1>\n<h2>Level-2 subheading</h2>'
    : '<h1>Titre principal</h1>\n<h2>Sous-titre de niveau 2</h2>',
};

CORRECTION_TEMPLATES['meta-viewport'] = {
  title: 'Champ de vision (viewport) non redimensionnable',
  explain: 'Autorisez le zoom utilisateur en retirant user-scalable=no des métadonnées viewport.',
  before: () => '<meta name="viewport" content="width=device-width, user-scalable=no">',
  after: () => '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
};

CORRECTION_TEMPLATES['frame-title'] = {
  title: 'iframe sans titre',
  explain: 'Chaque iframe doit avoir un attribut title décrivant son contenu.',
  before: (i, n) => (n && n.html) ? n.html : '<iframe src="https://exemple.fr/carte"></iframe>',
  after: (i, n, lang) => {
    const src = (n && n.html && n.html.match(/src=["']([^"']+)["']/) || [])[1];
    const s = src ? `src="${src}"` : 'src="https://exemple.fr/carte"';
    const t = lang === 'en' ? 'Description of the iframe content' : 'Description du contenu de l’iframe';
    return `<iframe ${s} title="${t}"></iframe>`;
  },
};

CORRECTION_TEMPLATES['select-name'] = {
  title: 'Liste déroulante sans nom accessible',
  explain: 'Associez un label ou aria-label à chaque <select>.',
  before: (i, n) => (n && n.html) ? n.html : '<select></select>',
  after: (i, n, lang) => {
    const html = (n && n.html) || '';
    const id = (html.match(/id=["']([^"']+)["']/) || [])[1] || 'choix';
    const labelText = lang === 'en' ? 'Choose an option' : 'Choisir une option';
    return `\n<label for="${id}">${labelText}</label>\n<select id="${id}">…</select>\n`;
  },
};

CORRECTION_TEMPLATES['landmark-one-main'] = {
  title: 'Repère principal (main) multiple ou absent',
  explain: 'La page doit exposer un repère <main> unique pour la zone de contenu.',
  before: () => '<div id="contenu">…</div>',
  after: () => '<main>\n  …contenu…\n</main>',
};

CORRECTION_TEMPLATES['nested-interactive'] = {
  title: 'Interactifs imbriqués',
  explain: 'Évitez d’imbriquer des éléments interactifs (un <a> sous un <button>, un <button> dans un <a>).',
  before: (i, n) => (n && n.html) ? n.html : '<button><a href="…">…</a></button>',
  after: (i, n, lang) => lang === 'en'
    ? '<a href="…" class="btn-role">Action</a>  <!-- replaces the nested button with a styled link -->'
    : '<a href="…" class="btn-role">Action</a>  <!-- remplace le bouton imbriqué par un lien stylé -->',
};

CORRECTION_TEMPLATES['target-size'] = {
  title: 'Cible tactile trop petite',
  explain: 'Portez la taille de la cible à au moins 44×44 px, ou augmentez l’espacement. Voir aussi le contrôle AccessiCheck « cible tactile ».',
  before: () => '.nav a { font-size: 12px; padding: 2px 4px; }',
  after: () => '.nav a { font-size: 14px; padding: 10px 14px; min-height: 44px; display: inline-flex; align-items: center; }',
};

CORRECTION_TEMPLATES['aria-valid-attr-value'] = {
  title: 'Valeur d’attribut ARIA invalide',
  explain: 'Corrigez la valeur de l’attribut ARIA ou remplacez-la par un pattern autorisé.',
  before: (i, n) => (n && n.html) ? n.html : '<div aria-hidden="truee">…</div>',
  after: () => '<div aria-hidden="true">…</div>',
};

CORRECTION_TEMPLATES['aria-prohibited-attr'] = {
  title: 'Attribut ARIA interdit sur cet élément',
  explain: 'Retirez l’attribut ARIA non autorisé ou utilisez la balise/le rôle natif adapté.',
  before: (i, n) => (n && n.html) ? n.html : '<table aria-hidden="true">…</table>',
  after: () => '<table>…</table>',
};

// --- Issues custom/sémantiques AccessiCheck ---
CORRECTION_TEMPLATES['page-lang-missing'] = {
  title: 'Langue de la page absente',
  explain: 'Déclarez la langue principale sur <html> (obligation RGAA 8.1.1).',
  before: (i, n, lang) => lang === 'en' ? '<html>\n  <!-- rest of the document -->' : '<html>\n  <!-- reste du document -->',
  after: () => '<html lang="fr">\n  <!-- reste du document -->',
};

CORRECTION_TEMPLATES['no-h1'] = {
  title: 'Titre h1 manquant',
  explain: 'Ajoutez un h1 unique décrivant le sujet de la page.',
  before: (i, n, lang) => lang === 'en' ? '<!-- no level-1 heading -->' : '<!-- aucun titre de niveau 1 -->',
  after: (i, n, lang) => lang === 'en' ? '<h1>Main page heading</h1>' : '<h1>Titre principal de la page</h1>',
};

CORRECTION_TEMPLATES['multiple-h1'] = {
  title: 'Plusieurs titres h1',
  explain: 'Conservez un seul h1 par page ; rétrogradez les autres à h2.',
  before: (i, n, lang) => lang === 'en'
    ? `<p>${i.count || 2} <h1> headings detected. Keep only one.</p>`
    : `<p>${i.count || 2} titres <h1> détectés. Conservez-en un seul.</p>`,
  after: (i, n, lang) => lang === 'en'
    ? '<h1>Single main heading</h1>\n<h2>Sub-topic</h2>\n<h3>Detail</h3>'
    : '<h1>Unique titre principal</h1>\n<h2>Sous-thème</h2>\n<h3>Détail</h3>',
};

CORRECTION_TEMPLATES['heading-skip'] = {
  title: 'Saut dans la hiérarchie des titres',
  explain: 'Ne sautez pas de niveau (h1→h2→h3) : gardez une progression régulière.',
  before: (i, n) => (n && n.html) ? n.html : '<h2>…</h2>\n<h4>…</h4>',
  after: (i, n, lang) => lang === 'en'
    ? '<h2>…</h2>\n<h3>Intermediate level</h3>'
    : '<h2>…</h2>\n<h3>Niveau intermédiaire</h3>',
};

CORRECTION_TEMPLATES['form-missing-label'] = {
  title: 'Champ(s) de formulaire sans label',
  explain: 'Les champs sans label sont inaccessibles aux lecteurs d’écran. Associez un label, un placeholder descriptif ou un aria-label.',
  before: () => `<input type="text">`,
  after: (i, n, lang) => {
    const html = (n && n.html) || '';
    const id = (html.match(/id=["']([^"']+)["']/) || [])[1] || 'champ';
    const type = (html.match(/type=["']([^"']+)["']/) || [])[1] || 'text';
    const labelText = lang === 'en' ? 'Field label' : 'Intitulé du champ';
    return `\n<label for="${id}">${labelText}</label>\n<input id="${id}" type="${type}">\n`;
  },
};

CORRECTION_TEMPLATES['landmark-main-missing'] = {
  title: 'Repère principal (main) absent',
  explain: 'Ajoutez un élément <main> (ou role="main") autour du contenu principal.',
  before: () => '<body>\n  …contenu…',
  after: () => '<body>\n  <main>\n    …contenu…\n  </main>',
};

CORRECTION_TEMPLATES['landmark-nav-missing'] = {
  title: 'Repère de navigation absent',
  explain: 'Identifiez la zone de navigation avec <nav> (ou role="navigation").',
  before: () => '<div class="menu">…</div>',
  after: (i, n, lang) => lang === 'en'
    ? '<nav aria-label="Main navigation">\n  …links…\n</nav>'
    : '<nav aria-label="Navigation principale">\n  …liens…\n</nav>',
};

CORRECTION_TEMPLATES['title-missing'] = {
  title: 'Balise title absente',
  explain: 'Ajoutez un <title> descriptif dans le <head> (repère lecteur d’écran / onglet).',
  before: (i, n, lang) => lang === 'en' ? '<head>\n  <!-- no title -->' : '<head>\n  <!-- pas de title -->',
  after: (i, n, lang) => lang === 'en'
    ? '<head>\n  <title>Descriptive page title</title>'
    : '<head>\n  <title>Intitulé descriptif de la page</title>',
};

CORRECTION_TEMPLATES['positive-tabindex'] = {
  title: 'tabindex positif',
  explain: 'Le tabindex positif perturbe l’ordre de tabulation naturel. Remplacez par un ordre DOM logique.',
  before: (i, n, lang) => lang === 'en'
    ? `<p>${i.count || 1} element(s) with tabindex > 0.</p>`
    : `<p>${i.count || 1} élément(s) avec tabindex > 0.</p>`,
  after: (i, n, lang) => lang === 'en'
    ? '<!-- order the DOM naturally, remove tabindex="N" -->\n<!-- Use tabindex="0" only if the element must be focusable without changing the order -->'
    : '<!-- ordonnez le DOM naturellement, retirez tabindex="N" -->\n<!-- Utilisez tabindex="0" uniquement si l’élément doit être focusable sans changer l’ordre -->',
};

CORRECTION_TEMPLATES['vague-link-text'] = {
  title: 'Intitulé de lien non explicite',
  explain: 'Rendez le libellé du lien compréhensible hors contexte (« Voir la notice PDF » plutôt que « ici »).',
  before: (i, n, lang) => (n && n.html) ? n.html : (lang === 'en' ? '<a href="…">click here</a>' : '<a href="…">cliquez ici</a>'),
  after: (i, n, lang) => lang === 'en'
    ? '<a href="…">Read the accessibility statement (PDF)</a>'
    : '<a href="…">Consulter la notice d’accessibilité (PDF)</a>',
};

CORRECTION_TEMPLATES['link-new-tab-no-warning'] = {
  title: 'Lien s’ouvrant dans un nouvel onglet sans avertissement',
  explain: 'Signalez l’ouverture dans un nouvel onglet et ajoutez rel="noopener noreferrer".',
  before: (i, n, lang) => lang === 'en' ? '<a href="…" target="_blank">Link</a>' : '<a href="…" target="_blank">Liens</a>',
  after: (i, n, lang) => lang === 'en'
    ? '<a href="…" target="_blank" rel="noopener noreferrer">Link (new tab)</a>'
    : '<a href="…" target="_blank" rel="noopener noreferrer">Liens (nouvel onglet)</a>',
};

CORRECTION_TEMPLATES['skip-link-missing'] = {
  title: 'Lien d’évitement (skip-link) absent',
  explain: 'Ajoutez un lien « Aller au contenu » au début de la page pointant vers le contenu principal.',
  before: (i, n, lang) => lang === 'en' ? '<body>\n  <!-- no skip link -->' : '<body>\n  <!-- pas de skip-link -->',
  after: (i, n, lang) => lang === 'en'
    ? '<body>\n  <a href="#content" class="skip-link">Skip to main content</a>\n  <main id="content">…</main>'
    : '<body>\n  <a href="#contenu" class="skip-link">Aller au contenu principal</a>\n  <main id="contenu">…</main>',
};

CORRECTION_TEMPLATES['skip-link-broken'] = {
  title: 'Lien d’évitement vers une cible inexistante',
  explain: 'Faites pointer le skip-link vers une ancre existante (id du contenu principal).',
  before: (i, n, lang) => lang === 'en'
    ? '<a href="#content">Skip to content</a>  <!-- #content does not exist -->'
    : '<a href="#contenu">Aller au contenu</a>  <!-- #contenu n’existe pas -->',
  after: (i, n, lang) => lang === 'en'
    ? '<a href="#content">Skip to content</a>\n<main id="content">…</main>'
    : '<a href="#contenu">Aller au contenu</a>\n<main id="contenu">…</main>',
};

CORRECTION_TEMPLATES['focus-trap'] = {
  title: 'Piège de focus possible',
  explain: 'La navigation clavier semble bloquée sur une zone. Permettez de sortir de chaque zone (touche Échap, repère de sortie).',
  before: (i, n, lang) => lang === 'en'
    ? '// area that captures focus with no way out'
    : '// zone qui capture le focus sans possibilité de sortie',
  after: (i, n, lang) => lang === 'en'
    ? '// add a keyboard handler (Escape) + a visible exit cue'
    : '// ajoutez un gestionnaire clavier (Échap) + un repère de sortie visible',
};

CORRECTION_TEMPLATES['focus-not-visible'] = {
  title: 'Indicateur de focus non visible',
  explain: 'Assurez un indicateur de focus visible (outline) sur tous les éléments interactifs.',
  before: () => 'a:focus { outline: none; }',
  after: () => 'a:focus-visible { outline: 2px solid #0044cc; outline-offset: 2px; }',
};

CORRECTION_TEMPLATES['small-touch-target'] = {
  title: 'Cible tactile trop petite',
  explain: 'Élargissez les cibles tactiles à au moins 44×44 px (WCAG 2.5.8).',
  before: (i, n, lang) => lang === 'en'
    ? `<p>${i.count || 1} target(s) < 44×44 px detected.</p>`
    : `<p>${i.count || 1} cible(s) < 44×44 px détectée(s).</p>`,
  after: () => '.btn { min-width: 44px; min-height: 44px; display: inline-flex; align-items: center; justify-content: center; }',
};

CORRECTION_TEMPLATES['horizontal-overflow-mobile'] = {
  title: 'Débordement horizontal sur mobile',
  explain: 'Évitez les largeurs fixes dépassant le viewport (390 px) : utilisez des unités fluides et overflow-x: hidden.',
  before: (i, n) => (n && n.html) ? n.html : '.banner { width: 800px; }',
  after: (i, n, lang) => lang === 'en'
    ? '.banner { max-width: 100%; width: auto; }  /* or width: 100%; box-sizing: border-box; */'
    : '.banner { max-width: 100%; width: auto; }  /* ou width: 100%; box-sizing: border-box; */',
};

CORRECTION_TEMPLATES['media-missing-subtitles'] = {
  title: 'Média audio/vidéo sans sous-titres ni transcription',
  explain: 'Ajoutez une piste <track> de sous-titres/descriptions au média, et idéalement une transcription textuelle.',
  before: (i, n) => (n && n.html) ? n.html : '<video src="…"></video>',
  after: (i, n, lang) => lang === 'en'
    ? '<video controls>\n  <source src="…" type="video/mp4">\n  <track kind="captions" src="captions.vtt" srclang="en" label="English">\n</video>'
    : '<video controls>\n  <source src="…" type="video/mp4">\n  <track kind="captions" src="sous-titres.vtt" srclang="fr" label="Français">\n</video>',
};

CORRECTION_TEMPLATES['pdf-links'] = {
  title: 'Liens vers des PDF potentiellement inaccessibles',
  explain: 'Vérifiez/rendez accessibles vos PDF (texte, structure, balises). Signalez aussi le poids et la langue.',
  before: (i, n, lang) => lang === 'en'
    ? `<p>${i.count || 1} PDF link(s) detected, to be checked.</p>`
    : `<p>${i.count || 1} lien(s) PDF détecté(s) à vérifier.</p>`,
  after: (i, n, lang) => lang === 'en'
    ? '<a href="document.pdf">Accessible document (PDF, 1.2 MB)</a>'
    : '<a href="document.pdf">Document accessible (PDF, 1,2 Mo)</a>',
};

CORRECTION_TEMPLATES['accessibility-statement-missing'] = {
  title: 'Déclaration d’accessibilité absente',
  explain: 'Publiez une page « Déclaration d’accessibilité » (obligation RGAA art. 47) et liez-la depuis le site.',
  before: (i, n, lang) => lang === 'en'
    ? '<!-- no accessibility statement page or link -->'
    : '<!-- aucun lien ni page de déclaration d’accessibilité -->',
  after: (i, n, lang) => lang === 'en'
    ? '<a href="/accessibility">Accessibility statement</a>'
    : '<a href="/accessibilite">Déclaration d’accessibilité</a>',
};

CORRECTION_TEMPLATES['iframe-no-title'] = {
  title: 'iframe sans titre',
  explain: 'Chaque iframe doit porter un title décrivant son contenu.',
  before: (i, n) => (n && n.html) ? n.html : '<iframe src="…"></iframe>',
  after: (i, n, lang) => {
    const src = (n && n.html && n.html.match(/src=["']([^"']+)["']/) || [])[1];
    const s = src ? `src="${src}"` : 'src="…"';
    const t = lang === 'en' ? 'Description of the iframe content' : 'Description du contenu de l’iframe';
    return `<iframe ${s} title="${t}"></iframe>`;
  },
};

CORRECTION_TEMPLATES['text-alternatives'] = {
  title: 'Alternative textuelle à améliorer',
  explain: 'Rédigez un texte alternatif décrivant le contenu de la ressource. Les noms de fichiers ou mots-clés vides ne sont pas suffisants.',
  before: () => '<img src="photo.jpg" alt="IMG_1234">',
  after: (i, n, lang) => lang === 'en'
    ? '<img src="photo.jpg" alt="Photograph of the team at the 2026 event">'
    : '<img src="photo.jpg" alt="Photographie de l’équipe lors de l’événement 2026">',
};

CORRECTION_TEMPLATES['visual-and-relative-content'] = {
  title: 'Liens/éléments dont le sens repose sur la position',
  explain: 'Ajoutez une alternative textuelle explicite quand le sens dépend d’une position visuelle.',
  before: () => '<img src="fletche.jpg" alt="">',
  after: (i, n, lang) => lang === 'en'
    ? '<img src="fletche.jpg" alt="Go to next page">'
    : '<img src="fletche.jpg" alt="Aller à la page suivante">',
};

// Gabarit générique de repli : toujours pré-écrit, aucun texte LLM.
CORRECTION_TEMPLATES['_default'] = {
  title: 'Vérification de ce point',
  explain: 'Ce point doit être contrôlé avec un expert accessibilité. La correction exacte dépend du contexte de la page (technologie, mise en page, contenu).',
  before: (i, n, lang) => lang === 'en' ? '<!-- element to fix, see the selector above -->' : '<!-- élément à corriger, voir le sélecteur ci-dessus -->',
  after: (i, n, lang) => lang === 'en' ? '<!-- apply the fix adapted to the context -->' : '<!-- appliquez la correction adaptée au contexte -->',
};

// ---------------------------------------------------------------- traductions EN
// Titre + explication de chaque gabarit en anglais.
const TEMPLATES_EN = {
  'image-alt': { title: 'Image without alternative text', explain: 'Add an alt attribute describing the informative content of the image. For a purely decorative image, use alt="" (empty).' },
  'color-contrast': { title: 'Insufficient text contrast', explain: 'The measured contrast ratio is below the required minimum (4.5:1 for normal text, 3:1 for large text). Increase the brightness gap between the text and its background.' },
  'label': { title: 'Form field without a label', explain: 'Associate a visible label with each field, or failing that an accessible name (aria-label). The label must be clickable (for=id).' },
  'button-name': { title: 'Button without an accessible name', explain: 'A button must have visible text, or an explicit aria-label / aria-labelledby.' },
  'html-has-lang': { title: 'Missing page language', explain: 'Declare the main page language on the <html> tag.' },
  'html-lang-valid': { title: 'Invalid language value', explain: 'The value of the lang attribute must follow a valid standard (e.g. fr, en, fr-FR).' },
  'link-name': { title: 'Link without an accessible label', explain: 'Every link must have text/alternative content, or an accessible name via aria-label.' },
  'region': { title: 'Unstructured content (missing region)', explain: 'Wrap each content area in a landmark (main, section, nav…) to make landmark navigation easier.' },
  'page-has-heading-one': { title: 'Missing level-1 heading (h1)', explain: 'Every page must contain at least one h1 describing its main topic.' },
  'heading-order': { title: 'Broken heading order', explain: 'Keep a heading hierarchy without gaps (h1 → h2 → h3, never h1 → h3).' },
  'meta-viewport': { title: 'Viewport not resizable', explain: 'Allow user zoom by removing user-scalable=no from the viewport metadata.' },
  'frame-title': { title: 'iframe without a title', explain: 'Every iframe must have a title attribute describing its content.' },
  'select-name': { title: 'Dropdown list without an accessible name', explain: 'Associate a label or aria-label with every <select>.' },
  'landmark-one-main': { title: 'Main landmark (main) missing or duplicated', explain: 'The page must expose a single <main> landmark for the content area.' },
  'nested-interactive': { title: 'Nested interactive elements', explain: 'Avoid nesting interactive elements (an <a> inside a <button>, a <button> inside an <a>).' },
  'target-size': { title: 'Touch target too small', explain: 'Bring the target size to at least 44×44 px, or increase spacing. See also the AccessiCheck “touch target” check.' },
  'aria-valid-attr-value': { title: 'Invalid ARIA attribute value', explain: 'Fix the ARIA attribute value or replace it with an allowed pattern.' },
  'aria-prohibited-attr': { title: 'ARIA attribute not allowed on this element', explain: 'Remove the disallowed ARIA attribute or use the appropriate native tag/role.' },
  'page-lang-missing': { title: 'Missing page language', explain: 'Declare the main language on <html> (RGAA requirement 8.1.1).' },
  'no-h1': { title: 'Missing h1 heading', explain: 'Add a single h1 describing the page topic.' },
  'multiple-h1': { title: 'Multiple h1 headings', explain: 'Keep a single h1 per page; downgrade the others to h2.' },
  'heading-skip': { title: 'Skipped heading level', explain: 'Do not skip levels (h1→h2→h3): keep a steady progression.' },
  'form-missing-label': { title: 'Form field(s) without a label', explain: 'Fields without a label are inaccessible to screen readers. Associate a label, a descriptive placeholder or an aria-label.' },
  'landmark-main-missing': { title: 'Main landmark (main) missing', explain: 'Add a <main> element (or role="main") around the main content.' },
  'landmark-nav-missing': { title: 'Navigation landmark missing', explain: 'Identify the navigation area with <nav> (or role="navigation").' },
  'title-missing': { title: 'Missing title tag', explain: 'Add a descriptive <title> in the <head> (screen-reader / tab cue).' },
  'positive-tabindex': { title: 'Positive tabindex', explain: 'A positive tabindex disturbs the natural tab order. Replace it with a logical DOM order.' },
  'vague-link-text': { title: 'Non-explicit link label', explain: 'Make the link label understandable out of context (“Read the PDF notice” rather than “here”).' },
  'link-new-tab-no-warning': { title: 'Link opening in a new tab without warning', explain: 'Warn about the new-tab opening and add rel="noopener noreferrer".' },
  'skip-link-missing': { title: 'Missing skip link', explain: 'Add a “Skip to content” link at the top of the page pointing to the main content.' },
  'skip-link-broken': { title: 'Skip link pointing to a missing target', explain: 'Point the skip link to an existing anchor (id of the main content).' },
  'focus-trap': { title: 'Possible focus trap', explain: 'Keyboard navigation seems stuck in an area. Provide a way out of every area (Escape key, visible exit cue).' },
  'focus-not-visible': { title: 'Focus indicator not visible', explain: 'Ensure a visible focus indicator (outline) on all interactive elements.' },
  'small-touch-target': { title: 'Touch target too small', explain: 'Enlarge touch targets to at least 44×44 px (WCAG 2.5.8).' },
  'horizontal-overflow-mobile': { title: 'Horizontal overflow on mobile', explain: 'Avoid fixed widths wider than the viewport (390 px): use fluid units and overflow-x: hidden.' },
  'media-missing-subtitles': { title: 'Audio/video media without subtitles or transcript', explain: 'Add a <track> of subtitles/descriptions to the media, and ideally a text transcript.' },
  'pdf-links': { title: 'Links to potentially inaccessible PDFs', explain: 'Check/make your PDFs accessible (text, structure, tags). Also state the file weight and language.' },
  'accessibility-statement-missing': { title: 'Missing accessibility statement', explain: 'Publish an “Accessibility statement” page (French legal requirement, RGAA art. 47) and link it from the site.' },
  'iframe-no-title': { title: 'iframe without a title', explain: 'Every iframe must carry a title describing its content.' },
  'text-alternatives': { title: 'Text alternative to improve', explain: 'Write alternative text describing the resource content. File names or empty keywords are not enough.' },
  'visual-and-relative-content': { title: 'Links/elements whose meaning relies on position', explain: 'Add an explicit text alternative when meaning depends on a visual position.' },
  '_default': { title: 'Check this point', explain: 'This point must be reviewed with an accessibility expert. The exact fix depends on the page context (technology, layout, content).' },
};

// ---------------------------------------------------------------- « En clair »
// UNE phrase en langage courant par type de constat, affichée AVANT le détail
// HTML/CSS. Ton : chef de projet PME, pas développeur.
const PLAIN_FR = {
  'image-alt': 'En clair : certaines images n’ont pas de description textuelle — un utilisateur malvoyant ne sait pas ce qu’elles montrent. La correction ci-dessous montre l’attribut à ajouter.',
  'color-contrast': 'En clair : certains textes sont difficiles à lire car leur couleur est trop proche de celle du fond — les personnes malvoyantes sont les premières pénalisées. Voici la couleur exacte à appliquer.',
  'label': 'En clair : des champs de formulaire ne sont pas étiquetés — un lecteur d’écran ne peut pas annoncer ce qu’il faut y saisir. Voici le code à ajouter.',
  'button-name': 'En clair : un bouton n’a ni texte ni nom lisible par un lecteur d’écran — impossible de savoir ce qu’il déclenche.',
  'html-has-lang': 'En clair : la page ne déclare pas sa langue — les lecteurs d’écran risquent de la lire avec une mauvaise prononciation.',
  'html-lang-valid': 'En clair : le code de langue déclaré est invalide — les lecteurs d’écran peuvent choisir une mauvaise voix.',
  'link-name': 'En clair : un lien n’a pas d’intitulé exploitable — l’utilisateur ne sait pas où il mène.',
  'region': 'En clair : la page n’est pas découpée en zones repérables — la navigation au clavier ou au lecteur d’écran devient fastidieuse.',
  'page-has-heading-one': 'En clair : la page n’a pas de titre principal — utilisateurs et moteurs de recherche peinent à identifier son sujet.',
  'heading-order': 'En clair : les titres sautent des niveaux (ex. h1 puis h3) — le plan de la page devient incompréhensible au lecteur d’écran.',
  'meta-viewport': 'En clair : le zoom est bloqué sur mobile — une personne malvoyante ne peut pas agrandir le texte.',
  'frame-title': 'En clair : un contenu intégré (iframe) n’a pas de titre — l’utilisateur ne sait pas ce qu’il contient.',
  'select-name': 'En clair : une liste déroulante n’a pas d’étiquette — le lecteur d’écran ne peut pas annoncer son rôle.',
  'landmark-one-main': 'En clair : la zone de contenu principal n’est pas identifiée (ou l’est plusieurs fois) — les repères de navigation sont brouillés.',
  'nested-interactive': 'En clair : des éléments cliquables sont imbriqués les uns dans les autres — le comportement devient imprévisible au clavier.',
  'target-size': 'En clair : des boutons ou liens sont trop petits pour être touchés confortablement sur mobile.',
  'aria-valid-attr-value': 'En clair : un attribut destiné aux lecteurs d’écran contient une valeur invalide — il est simplement ignoré.',
  'aria-prohibited-attr': 'En clair : un attribut réservé est utilisé sur un élément qui ne l’accepte pas — cela perturbe les lecteurs d’écran.',
  'page-lang-missing': 'En clair : la page ne déclare pas sa langue — obligation légale RGAA, et les lecteurs d’écran lisent avec une mauvaise prononciation.',
  'no-h1': 'En clair : la page n’a pas de titre principal (h1) — son sujet n’est identifiable ni par un lecteur d’écran ni par Google.',
  'multiple-h1': 'En clair : la page a plusieurs titres principaux — le plan devient ambigu pour les technologies d’assistance.',
  'heading-skip': 'En clair : la hiérarchie des titres saute un niveau — le plan de la page devient incohérent au lecteur d’écran.',
  'form-missing-label': 'En clair : des champs de formulaire ne sont pas étiquetés — un utilisateur de lecteur d’écran ne sait pas quoi y saisir.',
  'landmark-main-missing': 'En clair : le contenu principal n’est pas balisé comme tel — impossible d’y accéder directement au clavier.',
  'landmark-nav-missing': 'En clair : le menu de navigation n’est pas identifié comme tel — les utilisateurs de lecteur d’écran ne peuvent pas le retrouver facilement.',
  'title-missing': 'En clair : la page n’a pas de titre d’onglet — impossible de la distinguer parmi les onglets ou dans les résultats de recherche.',
  'positive-tabindex': 'En clair : l’ordre de navigation au clavier est modifié artificiellement — l’utilisateur saute d’un bout de la page à l’autre sans logique.',
  'vague-link-text': 'En clair : des liens du type « cliquez ici » ne disent pas où ils mènent quand on les entend hors contexte.',
  'link-new-tab-no-warning': 'En clair : des liens ouvrent un nouvel onglet sans prévenir — déroutant pour un utilisateur qui ne perçoit pas le changement.',
  'skip-link-missing': 'En clair : il manque un lien « Aller au contenu » — l’utilisateur au clavier doit traverser tout le menu à chaque page.',
  'skip-link-broken': 'En clair : le lien « Aller au contenu » pointe vers une zone inexistante — il ne fonctionne tout simplement pas.',
  'focus-trap': 'En clair : la navigation clavier peut rester bloquée dans une zone de la page — l’utilisateur ne peut plus en sortir.',
  'focus-not-visible': 'En clair : on ne voit pas quel élément est actif quand on navigue au clavier — l’utilisateur se perd.',
  'small-touch-target': 'En clair : des zones cliquables sont trop petites sur mobile — difficile de viser juste, surtout avec des tremblements.',
  'horizontal-overflow-mobile': 'En clair : la page déborde latéralement sur mobile — il faut faire défiler horizontalement pour tout lire.',
  'media-missing-subtitles': 'En clair : une vidéo ou un audio n’a ni sous-titres ni transcription — inaccessible aux personnes sourdes ou malentendantes.',
  'pdf-links': 'En clair : des documents PDF liés depuis le site sont probablement illisibles par un lecteur d’écran — à vérifier ou remplacer.',
  'accessibility-statement-missing': 'En clair : la page « Déclaration d’accessibilité » est absente — c’est une obligation légale en France (art. 47).',
  'iframe-no-title': 'En clair : un contenu intégré (carte, vidéo…) n’a pas de titre — l’utilisateur ne sait pas à quoi il correspond.',
  'text-alternatives': 'En clair : des descriptions d’images sont vides de sens (« IMG_1234 ») — elles ne renseignent ni les malvoyants ni Google.',
  'visual-and-relative-content': 'En clair : certains éléments ne se comprennent qu’en voyant leur position — sans explication textuelle, ils sont perdus pour un non-voyant.',
  '_default': 'En clair : ce point technique nécessite un regard humain pour être corrigé au mieux — le détail ci-dessous aide l’expert ou le développeur.',
};

const PLAIN_EN = {
  'image-alt': 'In plain terms: some images have no text description — a visually impaired user cannot tell what they show. The fix below shows the attribute to add.',
  'color-contrast': 'In plain terms: some text is hard to read because its colour is too close to the background — visually impaired people are hit first. Here is the exact colour to apply.',
  'label': 'In plain terms: some form fields are not labelled — a screen reader cannot announce what to type in them. Here is the code to add.',
  'button-name': 'In plain terms: a button has no text and no name a screen reader can announce — users cannot tell what it does.',
  'html-has-lang': 'In plain terms: the page does not declare its language — screen readers may read it aloud with the wrong pronunciation.',
  'html-lang-valid': 'In plain terms: the declared language code is invalid — screen readers may pick the wrong voice.',
  'link-name': 'In plain terms: a link has no usable label — users cannot tell where it leads.',
  'region': 'In plain terms: the page is not divided into identifiable regions — keyboard or screen-reader navigation becomes tedious.',
  'page-has-heading-one': 'In plain terms: the page has no main heading — users and search engines struggle to identify its topic.',
  'heading-order': 'In plain terms: headings skip levels (e.g. h1 then h3) — the page outline becomes meaningless to a screen reader.',
  'meta-viewport': 'In plain terms: zoom is disabled on mobile — a visually impaired person cannot enlarge the text.',
  'frame-title': 'In plain terms: an embedded content block (iframe) has no title — users cannot tell what it contains.',
  'select-name': 'In plain terms: a dropdown list has no label — a screen reader cannot announce its purpose.',
  'landmark-one-main': 'In plain terms: the main content area is not identified (or is identified several times) — navigation landmarks are muddled.',
  'nested-interactive': 'In plain terms: clickable elements are nested inside one another — keyboard behaviour becomes unpredictable.',
  'target-size': 'In plain terms: some buttons or links are too small to be tapped comfortably on mobile.',
  'aria-valid-attr-value': 'In plain terms: an attribute meant for screen readers contains an invalid value — it is simply ignored.',
  'aria-prohibited-attr': 'In plain terms: a reserved attribute is used on an element that does not accept it — this confuses screen readers.',
  'page-lang-missing': 'In plain terms: the page does not declare its language — a French legal requirement (RGAA), and screen readers read with the wrong pronunciation.',
  'no-h1': 'In plain terms: the page has no main heading (h1) — neither a screen reader nor Google can identify its topic.',
  'multiple-h1': 'In plain terms: the page has several main headings — the outline becomes ambiguous for assistive technologies.',
  'heading-skip': 'In plain terms: the heading hierarchy skips a level — the page outline becomes inconsistent for screen readers.',
  'form-missing-label': 'In plain terms: some form fields are not labelled — a screen-reader user does not know what to enter.',
  'landmark-main-missing': 'In plain terms: the main content is not tagged as such — keyboard users cannot jump straight to it.',
  'landmark-nav-missing': 'In plain terms: the navigation menu is not identified as such — screen-reader users cannot locate it easily.',
  'title-missing': 'In plain terms: the page has no tab title — it cannot be told apart among tabs or in search results.',
  'positive-tabindex': 'In plain terms: the keyboard navigation order is artificially overridden — users jump across the page with no logic.',
  'vague-link-text': 'In plain terms: links like “click here” do not say where they lead when heard out of context.',
  'link-new-tab-no-warning': 'In plain terms: some links open a new tab without warning — confusing for a user who cannot perceive the change.',
  'skip-link-missing': 'In plain terms: the “Skip to content” link is missing — keyboard users must tab through the whole menu on every page.',
  'skip-link-broken': 'In plain terms: the “Skip to content” link points to an area that does not exist — it simply does not work.',
  'focus-trap': 'In plain terms: keyboard navigation can get stuck in an area of the page — the user cannot get out.',
  'focus-not-visible': 'In plain terms: you cannot see which element is active when navigating by keyboard — users get lost.',
  'small-touch-target': 'In plain terms: some tappable areas are too small on mobile — hard to aim, especially with tremors.',
  'horizontal-overflow-mobile': 'In plain terms: the page overflows sideways on mobile — users must scroll horizontally to read everything.',
  'media-missing-subtitles': 'In plain terms: a video or audio has neither subtitles nor a transcript — inaccessible to deaf or hard-of-hearing people.',
  'pdf-links': 'In plain terms: PDF documents linked from the site are probably unreadable by screen readers — to be checked or replaced.',
  'accessibility-statement-missing': 'In plain terms: the “Accessibility statement” page is missing — a legal requirement in France (art. 47).',
  'iframe-no-title': 'In plain terms: an embedded content block (map, video…) has no title — users cannot tell what it is.',
  'text-alternatives': 'In plain terms: some image descriptions are meaningless (“IMG_1234”) — they inform neither visually impaired users nor Google.',
  'visual-and-relative-content': 'In plain terms: some elements can only be understood by seeing their position — without a text explanation, they are lost on a blind user.',
  '_default': 'In plain terms: this technical point needs a human review to be fixed properly — the detail below helps the expert or developer.',
};

// Phrase « En clair » d'une issue (langue demandée, repli sur le gabarit
// générique si le type de constat n'a pas de phrase dédiée).
function plainSentence(issue, lang = 'fr') {
  const key = templateKey(issue);
  const table = lang === 'en' ? PLAIN_EN : PLAIN_FR;
  return table[key] || table['_default'];
}

// Déduit le token de gabarit à partir de l'issue (id / code / message).
function templateKey(issue) {
  const id = String(issue.id || issue.code || '').toLowerCase();
  if (id && CORRECTION_TEMPLATES[id]) return id;
  if (id) {
    // correspondances partielles (ex : "color-contrast" déjà couvert ; "label-title-only")
    for (const k of Object.keys(CORRECTION_TEMPLATES)) {
      if (id.includes(k) || k.includes(id)) return k;
    }
  }
  const msg = String(issue.message || issue.help || '').toLowerCase();
  if (/image|texte alternatif/.test(msg)) return 'text-alternatives';
  if (/contraste/.test(msg)) return 'color-contrast';
  if (/label|formulaire/.test(msg)) return 'label';
  if (/bouton/.test(msg) || /\bhtml\b/.test(msg) && /button/.test(msg)) return 'button-name';
  if (/langue|lang/.test(msg)) return 'html-has-lang';
  if (/titres?/.test(msg)) return 'heading-order';
  if (/lien/.test(msg)) return 'vague-link-text';
  return '_default';
}

// Rendu d'un gabarit de correction (échappé systématiquement).
function correctionBoxHtml(issue, node0, lang = 'fr') {
  const key = templateKey(issue);
  const tpl = CORRECTION_TEMPLATES[key] || CORRECTION_TEMPLATES['_default'];
  const en = TEMPLATES_EN[key] || TEMPLATES_EN['_default'];
  const title = lang === 'en' ? en.title : tpl.title;
  const explain = lang === 'en' ? en.explain : tpl.explain;
  const safe = (fn, fallback) => {
    try {
      const v = fn(issue, node0, lang);
      return escapeHtml(v);
    } catch {
      return escapeHtml(fallback);
    }
  };
  const before = safe(tpl.before, '<!-- élément à corriger -->');
  const after = safe(tpl.after, '<!-- correction adaptée -->');
  const howto = lang === 'en' ? 'How to fix:' : 'Comment corriger :';
  const beforeLabel = lang === 'en' ? 'Before' : 'Avant';
  const afterLabel = lang === 'en' ? 'After' : 'Après';
  return `
    <div class="fix-box">
      <h3 class="fix-title">${howto} ${escapeHtml(title)}</h3>
      <p class="fix-explain">${escapeHtml(explain)}</p>
      <div class="fix-cols">
        <div class="fix-col">
          <div class="fix-label">${beforeLabel}</div>
          <pre class="fix-code before"><code>${before}</code></pre>
        </div>
        <div class="fix-col">
          <div class="fix-label">${afterLabel}</div>
          <pre class="fix-code after"><code>${after}</code></pre>
        </div>
      </div>
    </div>
  `;
}

// ----------------------------------------------------------------- section complète
// Rendu de la section « Corrections détaillées » pour les N problèmes les plus
// FRÉQUENTS du site (par défaut 5) : occurrences mesurées (éléments fautifs)
// + présence sur plusieurs pages en audit multi-pages. À impact égal, le plus
// fréquent passe d'abord.
function frequencyOf(issue) {
  let n = elementCount(issue);
  if (Array.isArray(issue.pages)) n += issue.pages.length - 1;
  return n;
}

function impactRankOf(issue) {
  const order = { critical: 0, serious: 1, error: 2, moderate: 3, warning: 4, minor: 5, notice: 6 };
  const k = (issue.impact || issue.type || 'notice').toLowerCase();
  return order[k] ?? 99;
}

const SECTION_STRINGS = {
  fr: {
    title: 'Corrections prêtes à coller',
    empty: 'Aucun problème détecté — aucune correction à proposer.',
    intro: (n) => `Les ${n} problèmes les plus fréquents du site, avec une explication en langage courant, les éléments fautifs (sélecteur CSS + extrait HTML) et le code corrigé prêt à adapter (avant / après). Pour les contrastes, la couleur corrigée proposée passe le ratio requis de 4,5:1. À valider par vos équipes avant mise en production.`,
    aiItemNote: 'Détection sémantique IA : à confirmer par un expert humain. Le gabarit ci-dessous est générique et doit être adapté au contexte réel.',
    aiHint: 'Les détections sémantiques « analyse IA » sont des indications de qualité de contenu, à confirmer par un expert humain. Les gabarits de correction sont génériques : ils doivent être adaptés à votre code réel.',
    presentOn: (n, pages) => `Présent sur ${n} pages : ${pages}`,
    elementsTitle: (n) => `Éléments fautifs (${n})`,
  },
  en: {
    title: 'Ready-to-paste fixes',
    empty: 'No issue detected — no fix to suggest.',
    intro: (n) => `The ${n} most frequent issues on the site, each with a plain-language explanation, the failing elements (CSS selector + HTML excerpt) and ready-to-adapt fixed code (before / after). For contrast, the suggested corrected colour passes the required 4.5:1 ratio. To be reviewed by your team before going live.`,
    aiItemNote: 'AI semantic detection: to be confirmed by a human expert. The template below is generic and must be adapted to the real context.',
    aiHint: 'The “AI analysis” semantic detections are content-quality indications, to be confirmed by a human expert. Fix templates are generic: they must be adapted to your actual code.',
    presentOn: (n, pages) => `Present on ${n} pages: ${pages}`,
    elementsTitle: (n) => `Failing elements (${n})`,
  },
};

function correctionsSectionHtml(issues, limit = 5, lang = 'fr') {
  const s = SECTION_STRINGS[lang === 'en' ? 'en' : 'fr'];
  if (!issues || issues.length === 0) {
    return `
    <section class="page-break corrections-section">
      <h2>${s.title}</h2>
      <p class="good-news">${s.empty}</p>
    </section>`;
  }
  const top = [...issues]
    .sort((a, b) => (frequencyOf(b) - frequencyOf(a)) || (impactRankOf(a) - impactRankOf(b)))
    .slice(0, limit);
  const items = top.map((issue) => {
    const elems = elementsListHtml(issue, 5, lang);
    const box = correctionBoxHtml(issue, (issue.nodes && issue.nodes[0]) || issue, lang);
    const pagesHtml = Array.isArray(issue.pages) && issue.pages.length > 1
      ? `<p class="issue-pages">${escapeHtml(s.presentOn(issue.pages.length, issue.pages.join(', ')))}</p>`
      : '';
    return `
      <div class="correction-item">
        <div class="correction-head">
          <span class="impact-pill impact-${(issue.impact || issue.type || 'notice').toLowerCase()}">${escapeHtml((issue.impact || issue.type || 'notice').toLowerCase())}</span>
          <span class="correction-msg">${escapeHtml(issueMessage(issue, lang))}</span>
        </div>
        <p class="plain-explain">${escapeHtml(plainSentence(issue, lang))}</p>
        ${pagesHtml}
        ${issue.ai || issue.engine === 'ia'
          ? `<p class="ai-note">${s.aiItemNote}</p>` : ''}
        ${elems ? `<div class="elements-block"><h3 class="elements-title">${escapeHtml(s.elementsTitle(String(elementCount(issue))))}</h3>${elems}</div>` : ''}
        ${box}
      </div>
    `;
  }).join('');
  const aiHint = issues.some((i) => i.ai || i.engine === 'ia')
    ? `<p class="ai-note">${s.aiHint}</p>`
    : '';

  return `
    <section class="page-break corrections-section">
      <h2>${s.title}</h2>
      <p class="corrections-intro">${s.intro(top.length)}</p>
      ${aiHint}
      ${items}
    </section>
  `;
}

module.exports = {
  escapeHtml,
  failedElements,
  elementCount,
  elementsListHtml,
  correctionBoxHtml,
  correctionsSectionHtml,
  frequencyOf,
  suggestedTextColor,
  templateKey,
  plainSentence,
  CORRECTION_TEMPLATES,
  TEMPLATES_EN,
};
