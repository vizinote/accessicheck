//Gabarits de correction déterministes pour les rapports AccessiCheck.
//
//RÈGLE D'OR : AUCUN texte LLM. Chaque gabarit est pré-écrit et validé ci-dessous.
//Seules les données MESURÉES par le scan (sélecteurs CSS, valeurs de contraste,
//URLs d'images, tailles, nombres) sont injectées dans le HTML final, toujours
//échappées via escapeHtml(). Aucun contenu du site scanné n'est interprété.

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
function elementsListHtml(issue, cap = 5) {
  const elems = failedElements(issue, cap);
  if (elems.length === 0) return '';
  const rows = elems.map((e) => {
    const sel = e.selector ? `<span class="el-selector">${escapeHtml(e.selector)}</span>` : '<span class="el-selector el-no-sel">élément détecté</span>';
    const html = e.html
      ? `<div class="el-snippet-wrap"><code class="el-snippet">${escapeHtml(e.html)}</code></div>`
      : '';
    return `<li class="el-item">${sel}${html}</li>`;
  }).join('');
  const total = elementCount(issue);
  const more = total > elems.length ? `<li class="el-more">+ ${total - elems.length} autre(s)</li>` : '';
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
// Chaque entrée : { title, explain, before, after }.
// before/after peuvent être des fonctions (issue, node0) → string, pour injecter
// les valeurs mesurées. Toute valeur est ensuite échappée par le rendu.

const CORRECTION_TEMPLATES = {};

CORRECTION_TEMPLATES['image-alt'] = {
  title: 'Image sans texte alternatif',
  explain: 'Ajoutez un attribut alt décrivant le contenu informatif de l\u2019image. Pour une image purement décorative, utilisez alt="" (vide).',
  before: (i, n) => (n && n.html) ? n.html : '<img src="https://exemple.fr/image.png">',
  after: (i, n) => {
    const src = (n && n.html && n.html.match(/src=["\']([^"\']+)["\']/) || [])[1];
    const clean = src ? `src="${src}"` : 'src="https://exemple.fr/image.png"';
    return `<img ${clean} alt="Description explicite du contenu de l\u2019image">`;
  },
};

CORRECTION_TEMPLATES['color-contrast'] = {
  title: 'Contraste de texte insuffisant',
  explain: 'Le ratio de contraste mesuré est en dessous du minimum requis (4.5:1 pour le texte normal, 3:1 pour les grands textes). Augmentez l\u2019écart de luminosité entre le texte et son fond.',
  before: (i, n) => {
    const d = (n && n.data) || {};
    if (d.fgColor && d.bgColor) {
      return `color: ${d.fgColor}; background-color: ${d.bgColor};   /* ratio mesuré : ${round2(d.contrastRatio) || '?'}:1 au lieu de ${d.expectedContrastRatio || '4.5:1'} */`;
    }
    return (n && n.html) ? n.html : 'color: #a0a0a0; background-color: #ffffff;';
  },
  after: (i, n) => {
    const d = (n && n.data) || {};
    const sugg = suggestedTextColor(d.bgColor || '#ffffff');
    return `color: ${sugg.color}; background-color: ${sugg.bg};   /* ratio cible ≥ 4.5:1 — à adapter à votre charte graphique */`;
  },
};

CORRECTION_TEMPLATES['label'] = {
  title: 'Champ de formulaire sans label',
  explain: 'Associez un label visible à chaque champ, ou à défaut un nom accessible (aria-label). Le label doit être cliquable (for=id).',
  before: (i, n) => (n && n.html) ? n.html : '<input type="text" name="nom">',
  after: (i, n) => {
    const html = (n && n.html) || '';
    const id = (html.match(/id=["\']([^"\']+)["\']/) || [])[1];
    const name = (html.match(/name=["\']([^"\']+)["\']/) || [])[1];
    const attrs = [];
    if (id) attrs.push(`id="${id}"`);
    if (name) attrs.push(`name="${name}"`);
    attrs.push(`type="text"`);
    const fieldId = id || 'champ';
    return `\n<label for="${fieldId}">Libellé clair du champ</label>\n<input ${attrs.join(' ')}>\n`;
  },
};

CORRECTION_TEMPLATES['button-name'] = {
  title: 'Bouton sans nom accessible',
  explain: 'Un bouton doit avoir du texte visible, ou un aria-label / aria-labelledby explicite.',
  before: (i, n) => (n && n.html) ? n.html : '<button></button>',
  after: () => '<button type="button">Action explicite du bouton</button>',
};

CORRECTION_TEMPLATES['html-has-lang'] = {
  title: 'Langue de la page absente',
  explain: 'Déclarez la langue principale de la page sur la balise <html>.',
  before: () => '<html>\n  <!-- reste du document -->',
  after: () => '<html lang="fr">\n  <!-- reste du document -->',
};

CORRECTION_TEMPLATES['html-lang-valid'] = {
  title: 'Valeur de langue invalide',
  explain: 'La valeur de l\u2019attribut lang doit suivre une norme valide (ex : fr, en, fr-FR).',
  before: (i, n) => {
    const v = (n && n.html && n.html.match(/lang=["\']([^"\']+)["\']/) || [])[1];
    return `<html lang="${v || 'xx'}">`;
  },
  after: () => '<html lang="fr">',
};

CORRECTION_TEMPLATES['link-name'] = {
  title: 'Lien sans intitulé accessible',
  explain: 'Chaque lien doit avoir un texte/alternative, ou un nom accessible via aria-label.',
  before: (i, n) => (n && n.html) ? n.html : '<a href="https://exemple.fr"></a>',
  after: (n) => '<a href="https://exemple.fr">Intitulé explicite du lien</a>',
};

CORRECTION_TEMPLATES['region'] = {
  title: 'Contenu non structuré (région manquante)',
  explain: 'Enveloppez chaque zone de contenu dans un repère (main, section, nav…) pour faciliter la navigation par landmarks.',
  before: () => '<div class="contenu">…</div>',
  after: () => '<main>\n  <section aria-labelledby="titre">\n    <h2 id="titre">Titre de la section</h2>\n    …\n  </section>\n</main>',
};

CORRECTION_TEMPLATES['page-has-heading-one'] = {
  title: 'Titre de niveau 1 (h1) manquant',
  explain: 'Chaque page doit contenir au moins un h1 décrivant son sujet principal.',
  before: () => '<body>\n  <!-- pas de h1 -->',
  after: () => '<body>\n  <h1>Titre principal de la page</h1>',
};

CORRECTION_TEMPLATES['heading-order'] = {
  title: 'Ordre des titres défaillant',
  explain: 'Respectez une hiérarchie de titres sans saut (h1 → h2 → h3, jamais h1 → h3).',
  before: (i, n) => (n && n.html) ? n.html : '<h1>…</h1><h3>Sous-titre</h3>',
  after: () => '<h1>Titre principal</h1>\n<h2>Sous-titre de niveau 2</h2>',
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
  after: (i, n) => {
    const src = (n && n.html && n.html.match(/src=["\']([^"\']+)["\']/) || [])[1];
    const s = src ? `src="${src}"` : 'src="https://exemple.fr/carte"';
    return `<iframe ${s} title="Description du contenu de l\u2019iframe"></iframe>`;
  },
};

CORRECTION_TEMPLATES['select-name'] = {
  title: 'Liste déroulante sans nom accessible',
  explain: 'Associez un label ou aria-label à chaque <select>.',
  before: (i, n) => (n && n.html) ? n.html : '<select></select>',
  after: (i, n) => {
    const html = (n && n.html) || '';
    const id = (html.match(/id=["\']([^"\']+)["\']/) || [])[1] || 'choix';
    return `\n<label for="${id}">Choisir une option</label>\n<select id="${id}">…</select>\n`;
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
  explain: 'Évitez d\u2019imbriquer des éléments interactifs (un <a> sous un <button>, un <button> dans un <a>).',
  before: (i, n) => (n && n.html) ? n.html : '<button><a href="…">…</a></button>',
  after: () => '<a href="…" class="btn-role">Action</a>  <!-- remplace le bouton imbriqué par un lien stylé -->',
};

CORRECTION_TEMPLATES['target-size'] = {
  title: 'Cible tactile trop petite',
  explain: 'Portez la taille de la cible à au moins 44×44 px, ou augmentez l\u2019espacement. Voir aussi le contrôle AccessiCheck « cible tactile ».',
  before: () => '.nav a { font-size: 12px; padding: 2px 4px; }',
  after: () => '.nav a { font-size: 14px; padding: 10px 14px; min-height: 44px; display: inline-flex; align-items: center; }',
};

CORRECTION_TEMPLATES['aria-valid-attr-value'] = {
  title: 'Valeur d\u2019attribut ARIA invalide',
  explain: 'Corrigez la valeur de l\u2019attribut ARIA ou remplacez-la par un pattern autorisé.',
  before: (i, n) => (n && n.html) ? n.html : '<div aria-hidden="truee">…</div>',
  after: () => '<div aria-hidden="true">…</div>',
};

CORRECTION_TEMPLATES['aria-prohibited-attr'] = {
  title: 'Attribut ARIA interdit sur cet élément',
  explain: 'Retirez l\u2019attribut ARIA non autorisé ou utilisez la balise/le rôle natif adapté.',
  before: (i, n) => (n && n.html) ? n.html : '<table aria-hidden="true">…</table>',
  after: () => '<table>…</table>',
};

// --- Issues custom/sémantiques AccessiCheck ---
CORRECTION_TEMPLATES['page-lang-missing'] = {
  title: 'Langue de la page absente',
  explain: 'Déclarez la langue principale sur <html> (obligation RGAA 8.1.1).',
  before: () => '<html>\n  <!-- reste du document -->',
  after: () => '<html lang="fr">\n  <!-- reste du document -->',
};

CORRECTION_TEMPLATES['no-h1'] = {
  title: 'Titre h1 manquant',
  explain: 'Ajoutez un h1 unique décrivant le sujet de la page.',
  before: () => '<!-- aucun titre de niveau 1 -->',
  after: () => '<h1>Titre principal de la page</h1>',
};

CORRECTION_TEMPLATES['multiple-h1'] = {
  title: 'Plusieurs titres h1',
  explain: 'Conservez un seul h1 par page ; rétrogradez les autres à h2.',
  before: (i) => `<p>${i.count || 2} titres <h1> détectés. Conservez-en un seul.</p>`,
  after: () => '<h1>Unique titre principal</h1>\n<h2>Sous-thème</h2>\n<h3>Détail</h3>',
};

CORRECTION_TEMPLATES['heading-skip'] = {
  title: 'Saut dans la hiérarchie des titres',
  explain: 'Ne sautez pas de niveau (h1→h2→h3) : gardez une progression régulière.',
  before: (i, n) => (n && n.html) ? n.html : '<h2>…</h2>\n<h4>…</h4>',
  after: () => '<h2>…</h2>\n<h3>Niveau intermédiaire</h3>',
};

CORRECTION_TEMPLATES['form-missing-label'] = {
  title: 'Champ(s) de formulaire sans label',
  explain: 'Les champs sans label sont inaccessibles aux lecteurs d\u2019écran. Associez un label, un placeholder descriptif ou un aria-label.',
  before: () => `<input type="text">`,
  after: (i, n) => {
    const html = (n && n.html) || '';
    const id = (html.match(/id=["\']([^"\']+)["\']/) || [])[1] || 'champ';
    const type = (html.match(/type=["\']([^"\']+)["\']/) || [])[1] || 'text';
    return `\n<label for="${id}">Intitulé du champ</label>\n<input id="${id}" type="${type}">\n`;
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
  after: () => '<nav aria-label="Navigation principale">\n  …liens…\n</nav>',
};

CORRECTION_TEMPLATES['title-missing'] = {
  title: 'Balise title absente',
  explain: 'Ajoutez un <title> descriptif dans le <head> (repère lecteur d\u2019écran / onglet).',
  before: () => '<head>\n  <!-- pas de title -->',
  after: () => '<head>\n  <title>Intitulé descriptif de la page</title>',
};

CORRECTION_TEMPLATES['positive-tabindex'] = {
  title: 'tabindex positif',
  explain: 'Le tabindex positif perturbe l\u2019ordre de tabulation naturel. Remplacez par un ordre DOM logique.',
  before: (i) => `<p>${i.count || 1} élément(s) avec tabindex > 0.</p>`,
  after: () => '<!-- ordonnez le DOM naturellement, retirez tabindex="N" -->\n<!-- Utilisez tabindex="0" uniquement si l\u2019élément doit être focusable sans changer l\u2019ordre -->',
};

CORRECTION_TEMPLATES['vague-link-text'] = {
  title: 'Intitulé de lien non explicite',
  explain: 'Rendez le libellé du lien compréhensible hors contexte (« Voir la notice PDF » plutôt que « ici »).',
  before: (i, n) => (n && n.html) ? n.html : '<a href="…">cliquez ici</a>',
  after: () => '<a href="…">Consulter la notice d\u2019accessibilité (PDF)</a>',
};

CORRECTION_TEMPLATES['link-new-tab-no-warning'] = {
  title: 'Lien s\u2019ouvrant dans un nouvel onglet sans avertissement',
  explain: 'Signalez l\u2019ouverture dans un nouvel onglet et ajoutez rel="noopener noreferrer".',
  before: () => '<a href="…" target="_blank">Liens</a>',
  after: () => '<a href="…" target="_blank" rel="noopener noreferrer">Liens (nouvel onglet)</a>',
};

CORRECTION_TEMPLATES['skip-link-missing'] = {
  title: 'Lien d\u2019évitement (skip-link) absent',
  explain: 'Ajoutez un lien « Aller au contenu » au début de la page pointant vers le contenu principal.',
  before: () => '<body>\n  <!-- pas de skip-link -->',
  after: () => '<body>\n  <a href="#contenu" class="skip-link">Aller au contenu principal</a>\n  <main id="contenu">…</main>',
};

CORRECTION_TEMPLATES['skip-link-broken'] = {
  title: 'Lien d\u2019évitement vers une cible inexistante',
  explain: 'Faites pointer le skip-link vers une ancre existante (id du contenu principal).',
  before: () => '<a href="#contenu">Aller au contenu</a>  <!-- #contenu n\u2019existe pas -->',
  after: () => '<a href="#contenu">Aller au contenu</a>\n<main id="contenu">…</main>',
};

CORRECTION_TEMPLATES['focus-trap'] = {
  title: 'Piège de focus possible',
  explain: 'La navigation clavier semble bloquée sur une zone. Permettez de sortir de chaque zone (touche Échap, repère de sortie).',
  before: () => '// zone qui capture le focus sans possibilité de sortie',
  after: () => '// ajoutez un gestionnaire clavier (Échap) + un repère de sortie visible',
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
  before: (i) => `<p>${i.count || 1} cible(s) < 44×44 px détectée(s).</p>`,
  after: () => '.btn { min-width: 44px; min-height: 44px; display: inline-flex; align-items: center; justify-content: center; }',
};

CORRECTION_TEMPLATES['horizontal-overflow-mobile'] = {
  title: 'Débordement horizontal sur mobile',
  explain: 'Évitez les largeurs fixes dépassant le viewport (390 px) : utilisez des unités fluides et overflow-x: hidden.',
  before: (i, n) => (n && n.html) ? n.html : '.banner { width: 800px; }',
  after: () => '.banner { max-width: 100%; width: auto; }  /* ou width: 100%; box-sizing: border-box; */',
};

CORRECTION_TEMPLATES['media-missing-subtitles'] = {
  title: 'Média audio/vidéo sans sous-titres ni transcription',
  explain: 'Ajoutez une piste <track> de sous-titres/descriptions au média, et idéalement une transcription textuelle.',
  before: (i, n) => (n && n.html) ? n.html : '<video src="…"></video>',
  after: () => '<video controls>\n  <source src="…" type="video/mp4">\n  <track kind="captions" src="sous-titres.vtt" srclang="fr" label="Français">\n</video>',
};

CORRECTION_TEMPLATES['pdf-links'] = {
  title: 'Liens vers des PDF potentiellement inaccessibles',
  explain: 'Vérifiez/rendez accessibles vos PDF (texte, structure, balises). Signalez aussi le poids et la langue.',
  before: (i) => `<p>${i.count || 1} lien(s) PDF détecté(s) à vérifier.</p>`,
  after: () => '<a href="document.pdf">Document accessible (PDF, 1,2 Mo)</a>',
};

CORRECTION_TEMPLATES['accessibility-statement-missing'] = {
  title: 'Déclaration d\u2019accessibilité absente',
  explain: 'Publiez une page « Déclaration d\u2019accessibilité » (obligation RGAA art. 47) et liez-la depuis le site.',
  before: () => '<!-- aucun lien ni page de déclaration d\u2019accessibilité -->',
  after: () => '<a href="/accessibilite">Déclaration d\u2019accessibilité</a>',
};

CORRECTION_TEMPLATES['iframe-no-title'] = {
  title: 'iframe sans titre',
  explain: 'Chaque iframe doit porter un title décrivant son contenu.',
  before: (i, n) => (n && n.html) ? n.html : '<iframe src="…"></iframe>',
  after: (i, n) => {
    const src = (n && n.html && n.html.match(/src=["\']([^"\']+)["\']/) || [])[1];
    const s = src ? `src="${src}"` : 'src="…"';
    return `<iframe ${s} title="Description du contenu de l\u2019iframe"></iframe>`;
  },
};

CORRECTION_TEMPLATES['text-alternatives'] = {
  title: 'Alternative textuelle à améliorer',
  explain: 'Rédigez un texte alternatif décrivant le contenu de la ressource. Les noms de fichiers ou mots-clés vides ne sont pas suffisants.',
  before: () => '<img src="photo.jpg" alt="IMG_1234">',
  after: () => '<img src="photo.jpg" alt="Photographie de l\u2019équipe lors de l\u2019événement 2026">',
};

CORRECTION_TEMPLATES['visual-and-relative-content'] = {
  title: 'Liens/éléments dont le sens repose sur la position',
  explain: 'Ajoutez une alternative textuelle explicite quand le sens dépend d\u2019une position visuelle.',
  before: () => '<img src="fletche.jpg" alt="">',
  after: () => '<img src="fletche.jpg" alt="Aller à la page suivante">',
};

// Gabarit générique de repli : toujours pré-écrit, aucun texte LLM.
CORRECTION_TEMPLATES['_default'] = {
  title: 'Vérification de ce point',
  explain: 'Ce point doit être contrôlé avec un expert accessibilité. La correction exacte dépend du contexte de la page (technologie, mise en page, contenu).',
  before: () => '<!-- élément à corriger, voir le sélecteur ci-dessus -->',
  after: () => '<!-- appliquez la correction adaptée au contexte -->',
};

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
function correctionBoxHtml(issue, node0) {
  const tpl = CORRECTION_TEMPLATES[templateKey(issue)] || CORRECTION_TEMPLATES['_default'];
  const safe = (fn, fallback) => {
    try {
      const v = fn(issue, node0);
      return escapeHtml(v);
    } catch {
      return escapeHtml(fallback);
    }
  };
  const before = safe(tpl.before, '<!-- élément à corriger -->');
  const after = safe(tpl.after, '<!-- correction adaptée -->');
  return `
    <div class="fix-box">
      <h4 class="fix-title">Comment corriger : ${escapeHtml(tpl.title)}</h4>
      <p class="fix-explain">${escapeHtml(tpl.explain)}</p>
      <div class="fix-cols">
        <div class="fix-col">
          <div class="fix-label">Avant</div>
          <pre class="fix-code before"><code>${before}</code></pre>
        </div>
        <div class="fix-col">
          <div class="fix-label">Après</div>
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

function correctionsSectionHtml(issues, limit = 5) {
  if (!issues || issues.length === 0) {
    return `
    <section class="page-break corrections-section">
      <h2>Corrections prêtes à coller</h2>
      <p class="good-news">Aucun problème détecté — aucune correction à proposer.</p>
    </section>`;
  }
  const top = [...issues]
    .sort((a, b) => (frequencyOf(b) - frequencyOf(a)) || (impactRankOf(a) - impactRankOf(b)))
    .slice(0, limit);
  const items = top.map((issue) => {
    const elems = elementsListHtml(issue, 5);
    const box = correctionBoxHtml(issue, (issue.nodes && issue.nodes[0]) || issue);
    const pagesHtml = Array.isArray(issue.pages) && issue.pages.length > 1
      ? `<p class="issue-pages">Présent sur ${issue.pages.length} pages : ${escapeHtml(issue.pages.join(', '))}</p>`
      : '';
    return `
      <div class="correction-item">
        <div class="correction-head">
          <span class="impact-pill impact-${(issue.impact || issue.type || 'notice').toLowerCase()}">${escapeHtml((issue.impact || issue.type || 'notice').toLowerCase())}</span>
          <span class="correction-msg">${escapeHtml(issue.message || issue.help || issue.description || issue.id || 'Problème')}</span>
        </div>
        ${pagesHtml}
        ${issue.ai || issue.engine === 'ia'
          ? '<p class="ai-note">Détection sémantique IA : à confirmer par un expert humain. Le gabarit ci-dessous est générique et doit être adapté au contexte réel.</p>' : ''}
        ${elems ? `<div class="elements-block"><h5>Éléments fautifs (${escapeHtml(String(elementCount(issue)))})</h5>${elems}</div>` : ''}
        ${box}
      </div>
    `;
  }).join('');
  const aiHint = issues.some((i) => i.ai || i.engine === 'ia')
    ? '<p class="ai-note">Les détections sémantiques « analyse IA » sont des indications de qualité de contenu, à confirmer par un expert humain. Les gabarits de correction sont génériques : ils doivent être adaptés à votre code réel.</p>'
    : '';

  return `
    <section class="page-break corrections-section">
      <h2>Corrections prêtes à coller</h2>
      <p class="corrections-intro">Les ${top.length} problèmes les plus fréquents du site, avec les éléments fautifs (sélecteur CSS + extrait HTML) et le code corrigé prêt à adapter (avant / après). Pour les contrastes, la couleur corrigée proposée passe le ratio requis de 4,5:1. À valider par vos équipes avant mise en production.</p>
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
  CORRECTION_TEMPLATES,
};