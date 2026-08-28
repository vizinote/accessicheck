// Traduction systématique des messages moteur (axe-core, pa11y) en français.
//
// Les rapports sont rendus pour des clients français : un message brut anglais
// (« Elements must meet minimum color contrast ratio thresholds ») dans un
// rapport FR est un défaut produit. Ce module traduit de façon DÉTERMINISTE
// (table figée, aucun LLM) les règles axe-core et les codes pa11y/HTMLCS les
// plus courants. Repli : message générique français citant la règle — jamais
// d'anglais brut dans le rendu client.

// ---------------------------------------------------------------- axe-core
// Clé = id de règle axe (issue.id quand engine === 'axe').
const AXE_MESSAGES_FR = {
  // Images
  'image-alt': 'Les images doivent avoir un texte alternatif (attribut alt décrivant leur contenu, ou alt="" si décoratives).',
  'input-image-alt': 'Les boutons de type image (input type="image") doivent avoir un texte alternatif.',
  'area-alt': 'Les zones cliquables d\'une image réactive (area) doivent avoir un texte alternatif.',
  'svg-img-alt': 'Les images SVG porteuses d\'information doivent avoir un texte alternatif.',
  'role-img-alt': 'Les éléments avec role="img" doivent avoir un nom accessible.',
  'object-alt': 'Les éléments <object> doivent avoir un texte alternatif.',
  // Contrastes
  'color-contrast': 'Le contraste entre le texte et son arrière-plan est insuffisant : le ratio mesuré est inférieur au minimum requis (4,5:1 pour le texte courant, 3:1 pour les grands textes).',
  'link-in-text-block': 'Les liens dans un bloc de texte doivent se distinguer par autre chose que la seule couleur (ou avoir un contraste suffisant).',
  // Formulaires
  'label': 'Chaque champ de formulaire doit avoir un label associé (ou un nom accessible explicite).',
  'label-title-only': 'Le label d\'un champ ne doit pas reposer uniquement sur l\'attribut title.',
  'form-field-multiple-labels': 'Un champ de formulaire ne doit pas avoir plusieurs labels contradictoires.',
  'select-name': 'Les listes déroulantes (select) doivent avoir un nom accessible.',
  'autocomplete-valid': 'Les attributs autocomplete doivent avoir une valeur valide et adaptée au champ.',
  // Interactifs
  'button-name': 'Les boutons doivent avoir un texte ou un nom accessible explicite.',
  'link-name': 'Les liens doivent avoir un intitulé explicite (texte visible ou nom accessible).',
  'nested-interactive': 'Évitez d\'imbriquer des éléments interactifs (un contrôle dans un autre contrôle).',
  'frame-focusable-content': 'Une iframe avec tabindex="-1" ne doit pas contenir d\'éléments focusables.',
  'scrollable-region-focusable': 'Les zones déroulantes doivent être atteignables au clavier.',
  // Langue & document
  'html-has-lang': 'La balise <html> doit déclarer la langue principale de la page (attribut lang).',
  'html-lang-valid': 'La valeur de l\'attribut lang de la balise <html> doit être valide (ex : fr, en, fr-FR).',
  'html-xml-lang-mismatch': 'Les attributs lang et xml:lang de la balise <html> doivent être cohérents.',
  'valid-lang': 'Les codes de langue utilisés dans la page doivent être valides.',
  'document-title': 'Chaque page doit avoir un titre (<title>) descriptif.',
  // Titres & structure
  'page-has-heading-one': 'La page doit contenir un titre de niveau 1 (<h1>).',
  'heading-order': 'La hiérarchie des titres ne doit pas sauter de niveau (h1 → h2 → h3, jamais h1 → h3).',
  'empty-heading': 'Les titres ne doivent pas être vides.',
  'p-as-heading': 'Ne simulez pas un titre avec un paragraphe stylé : utilisez les balises h1-h6.',
  'list': 'Les listes (ul/ol) doivent être correctement structurées.',
  'listitem': 'Les éléments <li> doivent être contenus dans une liste <ul> ou <ol>.',
  'definition-list': 'Les listes de définitions (dl/dt/dd) doivent être correctement structurées.',
  // Landmarks
  'region': 'Tout le contenu de la page doit être contenu dans une région (landmark : main, nav, header, footer…).',
  'landmark-one-main': 'La page doit exposer un repère principal <main> unique.',
  'landmark-main-is-top-level': 'Le repère <main> doit être au premier niveau de la structure.',
  'landmark-complementary-is-top-level': 'Les repères complémentaires (aside) doivent être au premier niveau.',
  'landmark-contentinfo-is-top-level': 'Le repère de pied de page (contentinfo) doit être au premier niveau.',
  'landmark-banner-is-top-level': 'Le repère d\'en-tête (banner) doit être au premier niveau.',
  'landmark-no-duplicate-banner': 'La page ne doit pas avoir plusieurs repères d\'en-tête (banner).',
  'landmark-no-duplicate-contentinfo': 'La page ne doit pas avoir plusieurs repères de pied de page (contentinfo).',
  'landmark-no-duplicate-main': 'La page ne doit pas avoir plusieurs repères <main> visibles.',
  'landmark-unique': 'Chaque landmark du même type doit avoir un nom accessible distinct.',
  // Cadres
  'frame-title': 'Les iframes doivent avoir un titre (attribut title) décrivant leur contenu.',
  'frame-title-unique': 'Chaque iframe doit avoir un titre distinct.',
  // Tableaux
  'th-has-data-cells': 'Chaque cellule d\'en-tête (th) doit être associée à des cellules de données.',
  'td-headers-attr': 'L\'attribut headers d\'une cellule (td) doit pointer vers des en-têtes existants.',
  'scope-attr-valid': 'L\'attribut scope doit avoir une valeur valide (row, col, rowgroup, colgroup).',
  'table-fake-caption': 'Utilisez un vrai <caption> plutôt qu\'une ligne de tableau pour titrer un tableau.',
  'table-duplicate-name': 'Le titre (caption) et le résumé (summary) d\'un tableau ne doivent pas être identiques.',
  // ARIA
  'aria-valid-attr': 'Les attributs ARIA utilisés doivent exister (orthographe exacte).',
  'aria-valid-attr-value': 'Les valeurs des attributs ARIA doivent être valides.',
  'aria-roles': 'Les rôles ARIA utilisés doivent être des rôles valides.',
  'aria-required-attr': 'Les attributs ARIA obligatoires du rôle doivent être présents.',
  'aria-required-children': 'Ce rôle ARIA exige des éléments enfants avec des rôles précis.',
  'aria-required-parent': 'Ce rôle ARIA exige un élément parent avec un rôle précis.',
  'aria-prohibited-attr': 'Cet attribut ARIA est interdit sur cet élément ou ce rôle.',
  'aria-hidden-focus': 'Un élément en aria-hidden="true" ne doit pas contenir d\'éléments focusables.',
  'aria-hidden-body': 'L\'attribut aria-hidden="true" ne doit pas être appliqué au <body>.',
  'aria-input-field-name': 'Les champs ARIA doivent avoir un nom accessible.',
  'aria-toggle-field-name': 'Les cases à cocher / interrupteurs ARIA doivent avoir un nom accessible.',
  'aria-tooltip-name': 'Les infobulles ARIA doivent avoir un nom accessible.',
  'aria-progressbar-name': 'Les barres de progression ARIA doivent avoir un nom accessible.',
  'aria-meter-name': 'Les jauges ARIA (meter) doivent avoir un nom accessible.',
  'aria-command-name': 'Les commandes ARIA (liens, boutons) doivent avoir un nom accessible.',
  'aria-treeitem-name': 'Les éléments d\'arborescence ARIA doivent avoir un nom accessible.',
  'aria-dialog-name': 'Les boîtes de dialogue ARIA doivent avoir un nom accessible.',
  'duplicate-id': 'Les attributs id doivent être uniques dans la page.',
  'duplicate-id-active': 'Les id des éléments interactifs doivent être uniques.',
  'duplicate-id-aria': 'Les id référencés par des attributs ARIA doivent être uniques.',
  'empty-table-header': 'Les cellules d\'en-tête de tableau ne doivent pas être vides.',
  'input-button-name': 'Les boutons <input> doivent avoir un nom accessible (value ou aria-label).',
  'image-redundant-alt': 'Le texte alternatif ne doit pas répéter un texte adjacent (redondance).',
  // Médias
  'audio-caption': 'Les contenus audio doivent avoir une alternative (transcription).',
  'video-caption': 'Les vidéos doivent avoir des sous-titres synchronisés.',
  'no-autoplay-audio': 'Les contenus audio/vidéo lus automatiquement doivent pouvoir être contrôlés.',
  // Navigation & divers
  'bypass': 'La page doit permettre de contourner les blocs répétés (lien d\'évitement, landmarks).',
  'skip-link': 'Le lien d\'évitement doit avoir une cible existante et focusable.',
  'tabindex': 'Aucun élément ne doit avoir de tabindex supérieur à 0.',
  'focus-order-semantics': 'L\'ordre de tabulation doit suivre la sémantique de la page.',
  'server-side-image-map': 'N\'utilisez pas d\'images réactives côté serveur (ismap).',
  'meta-viewport': 'Le zoom ne doit pas être désactivé (user-scalable=no dans le viewport).',
  'meta-viewport-large': 'Le zoom ne doit pas être bridé (maximum-scale trop bas dans le viewport).',
  'meta-refresh': 'N\'utilisez pas de rafraîchissement automatique (meta refresh).',
  'blink': 'N\'utilisez pas la balise <blink>.',
  'marquee': 'N\'utilisez pas la balise <marquee>.',
  'accesskeys': 'Les valeurs d\'attribut accesskey doivent être uniques.',
  'presentation-role-conflict': 'Un élément marqué presentational ne doit pas être focusable ni sémantique.',
  'target-size': 'Les cibles tactiles doivent mesurer au moins 24×24 px (recommandé : 44×44 px) ou être suffisamment espacées.',
  'identical-links-same-purpose': 'Les liens ayant le même intitulé doivent mener à la même destination.',
  'landmark-is-unique': 'Chaque repère du même type doit être distingué par un nom accessible.',
};

// ---------------------------------------------------------------- pa11y / HTMLCS
// Les codes pa11y ressemblent à :
//   WCAG2AA.Principle1.Guideline1_4.1_4_3.G18.Fail
// On mappe par motif sur le code (guideline + technique), pas sur le message.
const PA11Y_PATTERNS_FR = [
  [/Guideline1_1\.1_1_1/i, 'Les contenus non textuels (images, zones, objets) doivent avoir une alternative textuelle.'],
  [/Guideline1_2/i, 'Les médias temporels (audio/vidéo) doivent avoir une alternative (sous-titres, transcription, audiodescription).'],
  [/Guideline1_3\.1_3_1\.F68/i, 'Chaque champ de formulaire doit avoir un label associé (attribut for/id ou imbrication).'],
  [/Guideline1_3\.1_3_1\.H44|Guideline1_3\.1_3_1\.H65|Guideline1_3\.1_3_1\.H71/i, 'Les champs de formulaire doivent avoir un label ou un nom accessible explicite.'],
  [/Guideline1_3\.1_3_1\.H42/i, 'Les titres doivent être balisés avec les éléments h1-h6 (pas de titres simulés).'],
  [/Guideline1_3\.1_3_1\.H48/i, 'Les contenus présentés comme des listes doivent utiliser les balises de liste (ul/ol/li).'],
  [/Guideline1_3\.1_3_1\.H49/i, 'Utilisez les balises sémantiques (em, strong) plutôt que des balises de présentation (b, i).'],
  [/Guideline1_3\.1_3_1\.H63/i, 'Les tableaux de données doivent utiliser des éléments d\'en-tête (th, scope).'],
  [/Guideline1_3\.1_3_1/i, 'L\'information et la structure doivent être restituables par les technologies d\'assistance (balisage sémantique).'],
  [/Guideline1_3\.1_3_2/i, 'L\'ordre de lecture du contenu doit rester logique (ordre du DOM cohérent).'],
  [/Guideline1_3\.1_3_3/i, 'Les consignes ne doivent pas reposer uniquement sur la forme, la taille ou la position visuelle.'],
  [/Guideline1_4\.1_4_1/i, 'L\'information ne doit pas être donnée uniquement par la couleur.'],
  [/Guideline1_4\.1_4_2/i, 'Le son joué automatiquement doit pouvoir être mis en pause ou coupé.'],
  [/Guideline1_4\.1_4_3/i, 'Le contraste entre le texte et son arrière-plan est insuffisant : le ratio mesuré est inférieur au minimum requis (4,5:1 pour le texte courant, 3:1 pour les grands textes).'],
  [/Guideline1_4\.1_4_4/i, 'Le texte doit pouvoir être agrandi à 200 % sans perte de contenu ni de fonctionnalité.'],
  [/Guideline1_4\.1_4_5/i, 'Évitez les images de texte : utilisez du vrai texte stylé.'],
  [/Guideline2_1\.2_1_1/i, 'Toutes les fonctionnalités doivent être utilisables au clavier.'],
  [/Guideline2_1\.2_1_2/i, 'Le focus clavier ne doit jamais être piégé dans une zone de la page.'],
  [/Guideline2_2\.2_2_1|Guideline2_2\.2_2_2/i, 'Les limites de temps et contenus en mouvement doivent être contrôlables par l\'utilisateur.'],
  [/Guideline2_3\.2_3_1/i, 'Aucun contenu ne doit clignoter plus de 3 fois par seconde (risque de crise).'],
  [/Guideline2_4\.2_4_1/i, 'La page doit permettre de contourner les blocs répétés (lien d\'évitement, landmarks).'],
  [/Guideline2_4\.2_4_2/i, 'Chaque page doit avoir un titre (<title>) descriptif.'],
  [/Guideline2_4\.2_4_3/i, 'L\'ordre de navigation au clavier doit être logique.'],
  [/Guideline2_4\.2_4_4/i, 'L\'intitulé de chaque lien doit être explicite hors contexte.'],
  [/Guideline2_4\.2_4_6/i, 'Les titres et labels doivent décrire le sujet ou la fonction.'],
  [/Guideline2_4\.2_4_7/i, 'L\'indicateur de focus clavier doit être visible.'],
  [/Guideline3_1\.3_1_1/i, 'La langue principale de la page doit être déclarée (attribut lang sur <html>).'],
  [/Guideline3_1\.3_1_2/i, 'Les changements de langue dans le contenu doivent être indiqués (attribut lang).'],
  [/Guideline3_2\.3_2_1/i, 'La prise de focus ne doit pas déclencher de changement de contexte inattendu.'],
  [/Guideline3_2\.3_2_2/i, 'La saisie ne doit pas déclencher de changement de contexte inattendu.'],
  [/Guideline3_2\.3_2_3/i, 'Les menus de navigation répétés doivent rester au même endroit d\'une page à l\'autre.'],
  [/Guideline3_2\.3_2_4/i, 'Les éléments de même fonction doivent avoir des intitulés cohérents.'],
  [/Guideline3_3\.3_3_1/i, 'Les erreurs de saisie doivent être identifiées et décrites à l\'utilisateur.'],
  [/Guideline3_3\.3_3_2/i, 'Les champs doivent être accompagnés de labels ou consignes.'],
  [/Guideline3_3\.3_3_3/i, 'En cas d\'erreur, une suggestion de correction doit être proposée.'],
  [/Guideline3_3\.3_3_4/i, 'Les actions engageantes (financières, juridiques) doivent être vérifiables ou réversibles.'],
  [/Guideline4_1\.4_1_1/i, 'Le code doit être valide : pas d\'attribut id dupliqué, balises correctement fermées.'],
  [/Guideline4_1\.4_1_2/i, 'Les composants d\'interface doivent exposer un nom, un rôle et une valeur accessibles (ARIA).'],
];

// ---------------------------------------------------------------- API
const ENGINE_FR = { axe: 'axe-core', pa11y: 'Pa11y', custom: 'contrôle AccessiCheck', ia: 'analyse IA' };
const ENGINE_EN = { axe: 'axe-core', pa11y: 'Pa11y', custom: 'AccessiCheck check', ia: 'AI analysis' };

// Messages anglais des contrôles custom AccessiCheck et de l'analyse IA, dont
// les messages source sont rédigés en français (clé = id du contrôle).
const CUSTOM_MESSAGES_EN = {
  'page-lang-missing': 'The page language (lang attribute on <html>) is missing.',
  'no-h1': 'The page has no level-1 heading (h1).',
  'multiple-h1': 'The page has several level-1 headings (h1): only one is expected.',
  'heading-skip': 'The heading hierarchy skips a level (e.g. h1 followed by h3).',
  'form-missing-label': 'Some form fields have no label or accessible name.',
  'landmark-main-missing': 'The page has no main landmark (<main>) around its main content.',
  'landmark-nav-missing': 'The page has no navigation landmark (<nav>).',
  'title-missing': 'The page has no <title> in its <head>.',
  'positive-tabindex': 'Elements with tabindex greater than 0 disturb the natural tab order.',
  'vague-link-text': 'Some link labels are not explicit out of context (“click here”, “read more”…).',
  'link-new-tab-no-warning': 'Some links open in a new tab without warning the user.',
  'skip-link-missing': 'The page has no skip link (“Skip to content”).',
  'skip-link-broken': 'The skip link points to a target that does not exist.',
  'focus-trap': 'Keyboard focus may be trapped in an area of the page.',
  'focus-not-visible': 'The keyboard focus indicator is not visible on all interactive elements.',
  'small-touch-target': 'Some touch targets are smaller than 44×44 px.',
  'horizontal-overflow-mobile': 'The page overflows horizontally on mobile (390 px viewport).',
  'media-missing-subtitles': 'Audio/video media have no subtitles or transcript.',
  'pdf-links': 'Links point to PDF documents that may not be accessible.',
  'accessibility-statement-missing': 'No accessibility statement page (French legal requirement, art. 47) was found.',
  'iframe-no-title': 'Some iframes have no title describing their content.',
  'text-alternatives': 'Some alternative texts are not informative (file names, empty keywords…).',
  'visual-and-relative-content': 'Some links/elements rely on visual position alone to be understood.',
};

// Message d'une issue dans la langue demandée.
// FR : table déterministe (aucun anglais brut dans un rapport client).
// EN : axe et pa11y émettent nativement en anglais (help/message) — on les
// utilise tels quels ; les contrôles custom/IA passent par CUSTOM_MESSAGES_EN.
function issueMessage(issue, lang = 'fr') {
  if (lang !== 'en') return issueMessageFr(issue);
  const engine = issue.engine || '';
  if (engine === 'custom' || engine === 'ia' || issue.ai) {
    const id = String(issue.id || issue.code || '').toLowerCase();
    if (CUSTOM_MESSAGES_EN[id]) return CUSTOM_MESSAGES_EN[id];
    // Repli : message source si déjà anglais (analyse IA configurable), sinon générique.
    const raw = issue.message_en || issue.help_en;
    if (raw) return raw;
    return `Accessibility issue detected by ${ENGINE_EN[engine] || engine || 'the detection engine'} (rule “${issue.id || issue.code || 'unknown'}”): see the related WCAG documentation for the fix.`;
  }
  // axe : help/description natifs en anglais. pa11y : message natif en anglais.
  const native = issue.help || issue.message || issue.description;
  if (native && /[a-z]/i.test(native)) return native;
  const rule = issue.id || issue.code || 'unknown';
  return `Accessibility issue detected by ${ENGINE_EN[engine] || engine || 'the detection engine'} (rule “${rule}”): see the related WCAG documentation for the fix.`;
}

// Extrait un id de règle axe depuis un code pa11y éventuel
// (ex : « WCAG2AA.Principle1.Guideline1_1.1_1_1.axe.image-alt » ou « image-alt »).
function axeIdFromCode(code) {
  const c = String(code || '').toLowerCase();
  const m = c.match(/([a-z][a-z0-9-]+)$/);
  return m ? m[1] : '';
}

// Message français d'une issue, quelle que soit la langue du message source.
// Ordre : message custom/IA (déjà FR) → table axe → motifs pa11y → repli FR.
function issueMessageFr(issue) {
  const engine = issue.engine || '';
  // Les contrôles custom AccessiCheck et l'analyse IA rédigent déjà en français.
  if (engine === 'custom' || engine === 'ia' || issue.ai) {
    return issue.message || issue.help || issue.description || 'Problème détecté.';
  }
  if (engine === 'axe') {
    const id = String(issue.id || '').toLowerCase();
    if (AXE_MESSAGES_FR[id]) return AXE_MESSAGES_FR[id];
  }
  if (engine === 'pa11y') {
    const code = String(issue.code || '');
    // pa11y peut encapsuler une règle axe dans son code (runner axe).
    const axeId = axeIdFromCode(code);
    if (AXE_MESSAGES_FR[axeId]) return AXE_MESSAGES_FR[axeId];
    for (const [re, fr] of PA11Y_PATTERNS_FR) {
      if (re.test(code)) return fr;
    }
  }
  // Repli systématique en français : on cite la règle pour permettre la recherche.
  const rule = issue.id || issue.code || 'inconnue';
  const engineName = ENGINE_FR[engine] || engine || 'le moteur de détection';
  return `Problème d'accessibilité détecté par ${engineName} (règle « ${rule} ») : voir la documentation WCAG associée pour le détail de la correction.`;
}

module.exports = { issueMessageFr, issueMessage, AXE_MESSAGES_FR, PA11Y_PATTERNS_FR, CUSTOM_MESSAGES_EN };
