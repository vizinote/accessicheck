// Mapping explicite WCAG 2.1 ↔ RGAA 4.1.2 — AccessiCheck v4
//
// Le client français doit répondre au RGAA (référentiel national, obligation EAA
// depuis juin 2025 pour les entreprises de plus de 10 salariés), alors que les
// moteurs (axe-core, pa11y) parlent WCAG. Ce module fournit la grille de
// correspondance affichée dans les rapports.
//
// Sources : RGAA 4.1.2 (106 critères, 13 thématiques) — accessibilite.numerique.gouv.fr.
// Chaque correspondance pointe vers le CRITÈRE RGAA (ex : 3.2), pas vers un test.
// Les règles sans équivalent RGAA (WCAG 2.2 uniquement, ex : 2.5.8) sont signalées
// comme telles. RÈGLE D'OR : aucun texte généré par LLM ici non plus — la grille
// est figée et testée.

const { escapeHtml } = require('./corrections');
const { issueMessage } = require('./messages-fr');

// ---------------------------------------------------------------- référentiel RGAA 4.1.2
// Thématiques officielles (1 à 13).
const RGAA_THEMES = {
  1: 'Images', 2: 'Cadres', 3: 'Couleurs', 4: 'Multimédia', 5: 'Tableaux',
  6: 'Liens', 7: 'Scripts', 8: 'Éléments obligatoires', 9: 'Structuration de l’information',
  10: 'Présentation de l’information', 11: 'Formulaires', 12: 'Navigation', 13: 'Consultation',
};

// Thématiques en anglais (rapport EN).
const RGAA_THEMES_EN = {
  1: 'Images', 2: 'Frames', 3: 'Colours', 4: 'Multimedia', 5: 'Tables',
  6: 'Links', 7: 'Scripts', 8: 'Mandatory elements', 9: 'Information structure',
  10: 'Information presentation', 11: 'Forms', 12: 'Navigation', 13: 'Consultation',
};

// Libellés courts des critères cités par la grille (sous-ensemble des 106).
const RGAA_LABELS = {
  '1.1': 'Chaque image porteuse d\u2019information a une alternative textuelle',
  '1.8': 'Chaque image texte est si possible remplacée par du texte stylé',
  '2.1': 'Chaque cadre a un titre de cadre',
  '3.1': 'L\u2019information n\u2019est pas donnée uniquement par la couleur',
  '3.2': 'Contraste suffisant entre le texte et son arrière-plan',
  '3.3': 'Couleurs des composants d\u2019interface suffisamment contrastées',
  '4.1': 'Média temporel : transcription textuelle ou audiodescription',
  '4.3': 'Média temporel synchronisé : sous-titres synchronisés',
  '4.5': 'Média temporel pré-enregistré : audiodescription synchronisée',
  '4.8': 'Média non temporel : alternative',
  '4.10': 'Son déclenché automatiquement contrôlable',
  '5.4': 'Titre correctement associé au tableau de données',
  '5.6': 'En-têtes de colonne et de ligne correctement déclarés',
  '5.7': 'Association cellules/en-têtes avec la technique appropriée',
  '6.1': 'Chaque lien est explicite',
  '6.2': 'Chaque lien a un intitulé',
  '7.1': 'Chaque script est compatible avec les technologies d\u2019assistance',
  '7.3': 'Chaque script est contrôlable par le clavier',
  '7.4': 'Changement de contexte : utilisateur averti ou en contrôle',
  '7.5': 'Messages de statut correctement restitués',
  '8.2': 'Code source valide selon le type de document',
  '8.3': 'Langue par défaut présente',
  '8.4': 'Code de langue pertinent',
  '8.5': 'Chaque page a un titre de page',
  '8.7': 'Chaque changement de langue est indiqué',
  '8.8': 'Code de langue de chaque changement valide et pertinent',
  '8.9': 'Balises non utilisées uniquement à des fins de présentation',
  '9.1': 'Information structurée par l\u2019utilisation appropriée de titres',
  '9.2': 'Structure du document cohérente',
  '9.3': 'Chaque liste est correctement structurée',
  '10.3': 'Information compréhensible feuilles de styles désactivées',
  '10.4': 'Texte lisible à 200 %',
  '10.7': 'Prise de focus visible',
  '10.9': 'Information non donnée uniquement par la forme, taille ou position',
  '10.11': 'Contenu présentable sans défilement dans une fenêtre réduite',
  '10.12': 'Propriétés d\u2019espacement du texte redéfinissables',
  '10.13': 'Contenus additionnels au focus/survol contrôlables',
  '11.1': 'Chaque champ de formulaire a une étiquette',
  '11.3': 'Étiquettes cohérentes pour les champs de même fonction',
  '11.9': 'Intitulé de chaque bouton pertinent',
  '11.10': 'Contrôle de saisie utilisé de manière pertinente',
  '11.11': 'Contrôle de saisie accompagné de suggestions',
  '11.12': 'Données modifiables/récupérables (conséquences financières/juridiques)',
  '11.13': 'Finalité des champs déductible (remplissage automatique)',
  '12.1': 'Deux systèmes de navigation différents au moins',
  '12.2': 'Menu et barres de navigation toujours à la même place',
  '12.6': 'Zones de regroupement atteignables ou évitables',
  '12.7': 'Lien d\u2019évitement ou d\u2019accès rapide au contenu principal',
  '12.8': 'Ordre de tabulation cohérent',
  '12.9': 'Pas de piège au clavier dans la navigation',
  '12.10': 'Raccourcis clavier à touche unique contrôlables',
  '12.11': 'Contenus additionnels atteignables au clavier',
  '13.1': 'Contrôle de chaque limite de temps',
  '13.2': 'Pas d\u2019ouverture de nouvelle fenêtre sans action de l\u2019utilisateur',
  '13.3': 'Version accessible des documents bureautiques',
  '13.7': 'Changements brusques de luminosité correctement utilisés',
  '13.8': 'Contenu en mouvement ou clignotant contrôlable',
  '13.9': 'Contenu consultable quelle que soit l\u2019orientation',
  '13.10': 'Gestes complexes disponibles en geste simple',
  '13.11': 'Actions au pointage annulables',
  '13.12': 'Alternatives aux fonctionnalités par mouvement',
};

// Correspondance générique critère de succès WCAG 2.1 → critères RGAA 4.1.2.
const WCAG_TO_RGAA = {
  '1.1.1': ['1.1'],
  '1.2.1': ['4.1'], '1.2.2': ['4.3'], '1.2.3': ['4.3'], '1.2.4': ['4.3'], '1.2.5': ['4.5'],
  '1.3.1': ['9.2'], '1.3.2': ['10.3'], '1.3.3': ['10.9'], '1.3.4': ['13.9'], '1.3.5': ['11.13'],
  '1.4.1': ['3.1'], '1.4.2': ['4.10'], '1.4.3': ['3.2'], '1.4.4': ['10.4'], '1.4.5': ['1.8'],
  '1.4.10': ['10.11'], '1.4.11': ['3.3'], '1.4.12': ['10.12'], '1.4.13': ['10.13'],
  '2.1.1': ['7.3'], '2.1.2': ['12.9'], '2.1.4': ['12.10'],
  '2.2.1': ['13.1'], '2.2.2': ['13.8'], '2.3.1': ['13.7'],
  '2.4.1': ['12.6', '12.7'], '2.4.2': ['8.5'], '2.4.3': ['12.8'], '2.4.4': ['6.1'],
  '2.4.5': ['12.1'], '2.4.6': ['9.1'], '2.4.7': ['10.7'],
  '2.5.1': ['13.10'], '2.5.2': ['13.11'], '2.5.3': ['6.1'], '2.5.4': ['13.12'],
  '3.1.1': ['8.3'], '3.1.2': ['8.7'],
  '3.2.1': ['7.4'], '3.2.2': ['7.4'], '3.2.3': ['12.2'], '3.2.4': ['11.3'],
  '3.3.1': ['11.10'], '3.3.2': ['11.10'], '3.3.3': ['11.11'], '3.3.4': ['11.12'],
  '4.1.1': ['8.2'], '4.1.2': ['7.1'], '4.1.3': ['7.5'],
};

// Surcharges par règle (axe / pa11y / custom) : plus précises que la
// correspondance générique par critère WCAG. Clé = id axe ou code déduit.
const RULE_TO_RGAA = {
  'image-alt': ['1.1'], 'input-image-alt': ['1.1'], 'area-alt': ['1.1'],
  'svg-img-alt': ['1.1'], 'role-img-alt': ['1.1'], 'object-alt': ['4.8'],
  'color-contrast': ['3.2'],
  'label': ['11.1'], 'label-title-only': ['11.1'], 'select-name': ['11.1'],
  'form-field-multiple-labels': ['11.1'],
  'button-name': ['7.1', '11.9'], 'link-name': ['6.2'],
  'html-has-lang': ['8.3'], 'html-lang-valid': ['8.4'], 'valid-lang': ['8.8'],
  'document-title': ['8.5'],
  'frame-title': ['2.1'],
  'region': ['12.6'], 'landmark-one-main': ['12.6'], 'landmark-main-is-top-level': ['12.6'],
  'landmark-complementary-is-top-level': ['12.6'], 'landmark-contentinfo-is-top-level': ['12.6'],
  'landmark-no-duplicate-banner': ['12.6'], 'landmark-no-duplicate-contentinfo': ['12.6'],
  'page-has-heading-one': ['9.1'], 'heading-order': ['9.1'], 'empty-heading': ['9.1'], 'p-as-heading': ['9.1'],
  'list': ['9.3'], 'listitem': ['9.3'], 'definition-list': ['9.3'],
  'th-has-data-cells': ['5.6'], 'td-headers-attr': ['5.7'], 'scope-attr-valid': ['5.6'],
  'table-fake-caption': ['5.4'], 'table-duplicate-name': ['5.4'],
  'meta-viewport': ['10.4'], 'meta-refresh': ['13.1'],
  'duplicate-id': ['8.2'], 'duplicate-id-active': ['8.2'], 'duplicate-id-aria': ['8.2'],
  'aria-valid-attr': ['7.1'], 'aria-valid-attr-value': ['7.1'], 'aria-roles': ['7.1'],
  'aria-required-attr': ['7.1'], 'aria-required-children': ['7.1'], 'aria-required-parent': ['7.1'],
  'aria-prohibited-attr': ['7.1'], 'nested-interactive': ['7.1'],
  'audio-caption': ['4.3'], 'video-caption': ['4.3'],
  'blink': ['13.8'], 'marquee': ['13.8'],
  'bypass': ['12.7'], 'skip-link': ['12.7'],
  'tabindex': ['12.8'], 'focus-order-semantics': ['12.8'],
  'server-side-image-map': ['7.3'],
  'target-size': [], // WCAG 2.2 (2.5.8) — pas de critère RGAA 4.1 équivalent
};

// Notes spéciales hors grille (affichées à la place d'un critère RGAA).
const SPECIAL_NOTES = {
  'accessibility-statement-missing': 'Obligation légale (art. 47 de la loi pour une République numérique) — hors grille des 106 critères.',
  'small-touch-target': 'WCAG 2.2 (2.5.8) — pas de critère RGAA 4.1 équivalent.',
  'target-size': 'WCAG 2.2 (2.5.8) — pas de critère RGAA 4.1 équivalent.',
};

// Versions anglaises des notes hors grille.
const SPECIAL_NOTES_EN = {
  'accessibility-statement-missing': 'Legal requirement (art. 47 of the French digital republic law) — outside the 106-criteria grid.',
  'small-touch-target': 'WCAG 2.2 (2.5.8) — no equivalent RGAA 4.1 criterion.',
  'target-size': 'WCAG 2.2 (2.5.8) — no equivalent RGAA 4.1 criterion.',
};

// Libellés anglais courts des critères (traduction de RGAA_LABELS).
const RGAA_LABELS_EN = {
  '1.1': 'Every informative image has a text alternative',
  '1.8': 'Every text image is replaced with styled text where possible',
  '2.1': 'Every frame has a frame title',
  '3.1': 'Information is not conveyed by colour alone',
  '3.2': 'Sufficient contrast between text and its background',
  '3.3': 'Interface component colours are sufficiently contrasted',
  '4.1': 'Time-based media: text transcript or audio description',
  '4.3': 'Synchronised time-based media: synchronised captions',
  '4.5': 'Pre-recorded time-based media: synchronised audio description',
  '4.8': 'Non-time-based media: alternative',
  '4.10': 'Automatically triggered sound can be controlled',
  '5.4': 'Title correctly associated with the data table',
  '5.6': 'Column and row headers correctly declared',
  '5.7': 'Cell/header association with the appropriate technique',
  '6.1': 'Every link is explicit',
  '6.2': 'Every link has a label',
  '7.1': 'Every script is compatible with assistive technologies',
  '7.3': 'Every script is keyboard-controllable',
  '7.4': 'Context change: user warned or in control',
  '7.5': 'Status messages correctly conveyed',
  '8.2': 'Source code valid for the document type',
  '8.3': 'Default language present',
  '8.4': 'Relevant language code',
  '8.5': 'Every page has a page title',
  '8.7': 'Every language change is indicated',
  '8.8': 'Language code of every change valid and relevant',
  '8.9': 'Tags not used for presentation purposes only',
  '9.1': 'Information structured through appropriate headings',
  '9.2': 'Consistent document structure',
  '9.3': 'Every list correctly structured',
  '10.3': 'Information understandable with style sheets disabled',
  '10.4': 'Text readable at 200 %',
  '10.7': 'Focus is visible',
  '10.9': 'Information not conveyed by shape, size or position alone',
  '10.11': 'Content presentable without scrolling in a reduced window',
  '10.12': 'Text spacing properties can be overridden',
  '10.13': 'Additional content on focus/hover is controllable',
  '11.1': 'Every form field has a label',
  '11.3': 'Consistent labels for fields with the same function',
  '11.9': 'Relevant label for every button',
  '11.10': 'Input validation used appropriately',
  '11.11': 'Input validation accompanied by suggestions',
  '11.12': 'Data editable/recoverable (financial/legal consequences)',
  '11.13': 'Field purpose deductible (autofill)',
  '12.1': 'At least two different navigation systems',
  '12.2': 'Menu and navigation bars always in the same place',
  '12.6': 'Grouping regions reachable or skippable',
  '12.7': 'Skip link or quick access to main content',
  '12.8': 'Consistent tab order',
  '12.9': 'No keyboard trap in navigation',
  '12.10': 'Single-character keyboard shortcuts controllable',
  '12.11': 'Additional content reachable by keyboard',
  '13.1': 'Every time limit is controllable',
  '13.2': 'No new window opens without user action',
  '13.3': 'Accessible version of office documents',
  '13.7': 'Sudden brightness changes correctly used',
  '13.8': 'Moving or blinking content is controllable',
  '13.9': 'Content usable in any orientation',
  '13.10': 'Complex gestures available as simple gestures',
  '13.11': 'Pointer actions cancellable',
  '13.12': 'Alternatives to motion-based features',
};

function themeOf(criterionId, lang = 'fr') {
  const theme = parseInt(String(criterionId).split('.')[0], 10);
  const table = lang === 'en' ? RGAA_THEMES_EN : RGAA_THEMES;
  return table[theme] || '';
}

// Extrait le critère de succès WCAG d'une issue (champ explicite, ou tags axe
// du type wcag143 / wcag1411 / wcag258).
function wcagCriterionOf(issue) {
  if (issue.wcag) return String(issue.wcag);
  const tags = issue.tags || [];
  for (const tag of tags) {
    const m = String(tag).match(/^wcag(\d)(\d)(\d{1,2})$/);
    if (m) return `${m[1]}.${m[2]}.${m[3]}`;
  }
  return null;
}

// Critères RGAA applicables à une issue : [{ id, label, theme }].
// Ordre de résolution : champ rgaa explicite (issues custom) → surcharge par
// règle → correspondance générique par critère WCAG.
function rgaaCriteriaFor(issue, lang = 'fr') {
  const labels = lang === 'en' ? RGAA_LABELS_EN : RGAA_LABELS;
  const ids = [];
  const push = (id) => { if (id && RGAA_LABELS[id] && !ids.includes(id)) ids.push(id); };

  if (issue.rgaa) {
    // Normalise une référence de test (x.y.z) vers le critère (x.y).
    const parts = String(issue.rgaa).split('.');
    push(parts.slice(0, 2).join('.'));
  }
  const ruleId = String(issue.id || '').toLowerCase();
  if (ids.length === 0 && ruleId && RULE_TO_RGAA[ruleId]) {
    RULE_TO_RGAA[ruleId].forEach(push);
  }
  if (ids.length === 0) {
    const wcag = wcagCriterionOf(issue);
    if (wcag && WCAG_TO_RGAA[wcag]) WCAG_TO_RGAA[wcag].forEach(push);
  }
  return ids.map((id) => ({ id, label: labels[id], theme: themeOf(id, lang) }));
}

// Annotation courte pour la colonne RGAA du tableau des problèmes.
function rgaaAnnotation(issue, lang = 'fr') {
  const note = (lang === 'en' ? SPECIAL_NOTES_EN : SPECIAL_NOTES)[String(issue.id || '').toLowerCase()];
  const criteria = rgaaCriteriaFor(issue, lang);
  const wcag = wcagCriterionOf(issue);
  if (criteria.length === 0 && !note) {
    return wcag
      ? { text: lang === 'en' ? `WCAG ${wcag} — no direct RGAA criterion` : `WCAG ${wcag} — pas de critère RGAA direct`, wcag, criteria: [] }
      : { text: '—', wcag: null, criteria: [] };
  }
  const parts = criteria.map((c) => c.id);
  return {
    text: parts.length > 0 ? `RGAA ${parts.join(', ')}` : note,
    wcag,
    criteria,
    note: note || null,
  };
}

// ---------------------------------------------------------------- section rapport
// Synthèse « Correspondance RGAA 4.1 » : regroupe les problèmes détectés par
// critère RGAA, avec thématique et pages concernées (audit multi-pages).
const RGAA_SECTION_STRINGS = {
  fr: {
    title: 'Correspondance RGAA 4.1',
    empty: 'Aucun problème détecté : aucun critère RGAA 4.1.2 automatiquement testable n’est en échec sur le périmètre scanné.',
    emptyReminder: 'Rappel : le RGAA 4.1.2 compte 106 critères. Seule une partie est automatiquement testable — un audit humain reste nécessaire pour déclarer la conformité.',
    intro: 'Les moteurs de détection (axe-core, Pa11y) parlent WCAG ; votre obligation légale en France est le <strong>RGAA 4.1.2</strong> (106 critères, directive européenne EAA applicable depuis juin 2025 aux entreprises de plus de 10 salariés). Ce tableau traduit chaque problème détecté en critère(s) RGAA correspondant(s) : ce sont les références à utiliser dans votre déclaration d’accessibilité et votre plan de remédiation.',
    thCriterion: 'Critère RGAA', thTheme: 'Thématique', thRequirement: 'Exigence', thIssues: 'Problèmes', thPages: 'Pages concernées',
    legalTitle: 'Obligations hors grille des critères',
    summary: (n) => `${n} critère(s) RGAA en échec sur le périmètre scanné. Le RGAA 4.1.2 compte 106 critères : seule une partie est automatiquement testable, un audit humain reste nécessaire pour déclarer la conformité.`,
  },
  en: {
    title: 'RGAA 4.1 mapping',
    empty: 'No issue detected: no automatically testable RGAA 4.1.2 criterion is failing on the scanned perimeter.',
    emptyReminder: 'Reminder: RGAA 4.1.2 has 106 criteria. Only part of them can be tested automatically — a human audit is still required to declare compliance.',
    intro: 'The detection engines (axe-core, Pa11y) speak WCAG; your legal obligation in France is the <strong>RGAA 4.1.2</strong> (106 criteria, European EAA directive applicable since June 2025 to companies with more than 10 employees). This table translates each detected issue into the corresponding RGAA criterion/criteria: these are the references to use in your accessibility statement and remediation plan.',
    thCriterion: 'RGAA criterion', thTheme: 'Theme', thRequirement: 'Requirement', thIssues: 'Issues', thPages: 'Affected pages',
    legalTitle: 'Requirements outside the criteria grid',
    summary: (n) => `${n} RGAA criterion/criteria failing on the scanned perimeter. RGAA 4.1.2 has 106 criteria: only part of them can be tested automatically, a human audit is still required to declare compliance.`,
  },
};

function rgaaSectionHtml(issues, opts = {}) {
  const lang = opts.lang === 'en' ? 'en' : 'fr';
  const s = RGAA_SECTION_STRINGS[lang];
  const multipage = Array.isArray(opts.pages) && opts.pages.length > 1;
  if (!issues || issues.length === 0) {
    return `
    <section class="page-break rgaa-section">
      <h2>${s.title}</h2>
      <p class="good-news">${s.empty}</p>
      <p class="not-tested">${s.emptyReminder}</p>
    </section>`;
  }

  const byCriterion = new Map(); // id -> { id, label, theme, count, pages:Set, examples:[] }
  const unmapped = [];
  for (const issue of issues) {
    const criteria = rgaaCriteriaFor(issue, lang);
    if (criteria.length === 0) { unmapped.push(issue); continue; }
    for (const c of criteria) {
      if (!byCriterion.has(c.id)) {
        byCriterion.set(c.id, { ...c, count: 0, pages: new Set(), examples: [] });
      }
      const entry = byCriterion.get(c.id);
      entry.count += 1;
      (issue.pages || (issue.page ? [issue.page] : ['/'])).forEach((p) => entry.pages.add(p));
      if (entry.examples.length < 2) {
        entry.examples.push(issueMessage(issue, lang));
      }
    }
  }

  const rows = [...byCriterion.values()]
    .sort((a, b) => parseFloat(a.id) - parseFloat(b.id) || a.id.localeCompare(b.id));

  const specialTable = lang === 'en' ? SPECIAL_NOTES_EN : SPECIAL_NOTES;
  const legalNotes = issues.filter((i) => specialTable[String(i.id || '').toLowerCase()]);

  const tableRows = rows.map((c) => `
        <tr>
          <td><span class="rgaa-id">${escapeHtml(c.id)}</span></td>
          <td>${escapeHtml(c.theme)}</td>
          <td>${escapeHtml(c.label)}</td>
          <td class="rgaa-count">${c.count}</td>
          ${multipage ? `<td class="rgaa-pages">${escapeHtml([...c.pages].join(', '))}</td>` : ''}
        </tr>`).join('');

  const legalHtml = legalNotes.length > 0 ? `
    <h3>${s.legalTitle}</h3>
    <ul class="rgaa-legal-list">
      ${legalNotes.map((i) => `<li>${escapeHtml(issueMessage(i, lang))}<br><span class="ai-note">${escapeHtml(specialTable[String(i.id).toLowerCase()])}</span></li>`).join('')}
    </ul>` : '';

  return `
    <section class="page-break rgaa-section">
      <h2>${s.title}</h2>
      <p class="corrections-intro">${s.intro}</p>
      <table class="criteria-table rgaa-table">
        <thead>
          <tr><th>${s.thCriterion}</th><th>${s.thTheme}</th><th>${s.thRequirement}</th><th>${s.thIssues}</th>${multipage ? `<th>${s.thPages}</th>` : ''}</tr>
        </thead>
        <tbody>${tableRows}
        </tbody>
      </table>
      ${legalHtml}
      <p class="not-tested">${s.summary(rows.length)}</p>
    </section>`;
}

module.exports = {
  RGAA_THEMES,
  RGAA_THEMES_EN,
  RGAA_LABELS,
  RGAA_LABELS_EN,
  WCAG_TO_RGAA,
  RULE_TO_RGAA,
  SPECIAL_NOTES,
  SPECIAL_NOTES_EN,
  wcagCriterionOf,
  rgaaCriteriaFor,
  rgaaAnnotation,
  rgaaSectionHtml,
};
