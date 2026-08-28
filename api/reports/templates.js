const fs = require('fs');
const path = require('path');

const STYLE_CSS = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');
const { correctionsSectionHtml } = require('./corrections');
const { rgaaSectionHtml, rgaaAnnotation } = require('./rgaa');
const { issueMessage } = require('./messages-fr');

// ------------------------------------------------------------------ i18n
// Rapports bilingues FR/EN : tout libellé passe par T[lang]. Le FR reste la
// langue par défaut (rétro-compat : aucun appelant ne passait de langue avant).
const LANGS = ['fr', 'en'];
function normalizeLang(lang) {
  return LANGS.includes(String(lang || '').toLowerCase()) ? String(lang).toLowerCase() : 'fr';
}

const T = {
  fr: {
    htmlLang: 'fr',
    locale: 'fr-FR',
    impacts: { critical: 'Critique', serious: 'Sérieux', error: 'Erreur', moderate: 'Moyen', warning: 'Avertissement', minor: 'Mineur', notice: 'Information' },
    scoreLabels: { good: 'Bon', improve: 'À améliorer', poor: 'Insuffisant', critical: 'Critique' },
    legalFooter: 'Mention légale :',
    defaultCoverage: 'Ce scan couvre uniquement les critères automatiquement testables. Un audit humain reste nécessaire pour une conformité RGAA complète.',
    // Encart « Comment lire ce rapport »
    howtoTitle: 'Comment lire ce rapport',
    howtoChecks: '<strong>Ce que cet outil vérifie</strong> : les critères d’accessibilité testables automatiquement (contrastes de couleurs, structure des titres, formulaires, navigation clavier, textes alternatifs…) sur la ou les pages analysées.',
    howtoNotChecks: '<strong>Ce qu’il ne vérifie pas</strong> : tout ce qui demande un jugement humain (navigation réelle au lecteur d’écran, contenus complexes, pertinence fine des textes). Un audit humain reste nécessaire pour déclarer la conformité RGAA.',
    howtoStart: '<strong>Par où commencer</strong> : lisez le résumé ci-dessous, puis traitez d’abord les problèmes marqués « Critique » ou « Sérieux ». Chaque problème commence par une explication en langage courant ; le code prêt à adapter vient ensuite — transmettez-le tel quel à votre développeur ou votre agence.',
    // Glossaire
    glossaryTitle: 'Glossaire (pour les non-développeurs)',
    glossary: [
      ['Skip-link (lien d’évitement)', 'Lien « Aller au contenu » placé en tout début de page : il permet aux utilisateurs de clavier ou de lecteur d’écran de sauter les menus répétitifs.'],
      ['Ratio de contraste', 'Mesure de l’écart de luminosité entre un texte et son fond. Minimum légal : 4,5:1 pour le texte courant (3:1 pour les grands textes).'],
      ['ARIA', 'Attributs invisibles ajoutés au code pour décrire les éléments aux technologies d’assistance (lecteurs d’écran).'],
      ['Cible tactile', 'Zone cliquable d’un bouton ou lien. Sur mobile, elle doit mesurer au moins 44×44 px pour être utilisable confortablement.'],
      ['Texte alternatif (alt)', 'Texte attaché à une image, lu par les lecteurs d’écran et affiché si l’image ne charge pas.'],
      ['RGAA', 'Référentiel français d’accessibilité (106 critères). C’est lui qui fait foi pour l’obligation légale en France.'],
    ],
    multipageTitle: (n) => `Audit multi-pages (${n} page${n > 1 ? 's' : ''} analysée${n > 1 ? 's' : ''})`,
    multipageIntro: 'Page d’accueil + pages clés découvertes automatiquement (contact, produits/services, mentions légales, pages principales). Le score global est la moyenne des pages analysées. Un seul audit décompté de votre quota.',
    thPage: 'Page', thScore: 'Score', thIssues: 'Problèmes',
    scanFailed: 'échec',
    scanImpossible: 'scan impossible',
    cardProblems: 'Problèmes détectés', cardCritical: 'Critiques', cardSerious: 'Sérieux', cardLevels: 'Niveaux d’impact',
    goodNewsNone: 'Aucun problème détecté. Excellent travail !',
    goodNewsNoAction: 'Aucune action requise.',
    actions: {
      contrast: 'Améliorer les contrastes de couleur',
      alt: 'Rédiger des textes alternatifs pour les images',
      label: 'Associer des labels aux champs de formulaire',
      heading: 'Revoir la hiérarchie des titres',
      lang: 'Déclarer la langue principale de la page',
      landmark: 'Structurer la page avec des landmarks ARIA',
      name: 'Améliorer les noms accessibles des éléments interactifs',
      link: 'Rendre les liens explicites et accessibles',
      button: 'Vérifier les boutons et leur nom accessible',
      aria: 'Corriger les attributs ARIA',
      fallback: 'Vérifier ce point avec un expert accessibilité',
    },
    thCriterion: 'Critère testé automatiquement', thState: 'État',
    statusOk: '✓ Conforme', statusKo: '✗ Problème détecté',
    notTested: 'La détection automatisée technique + analyse IA couvre une part importante mais non exhaustive des critères RGAA/WCAG : lecteur d’écran réel, contenus très complexes, tableaux de données, changements de langue, etc. restent du ressort d’un audit humain.',
    criteria: {
      contrast: 'Contrastes de couleur',
      images: 'Textes alternatifs aux images (technique + sémantique)',
      headings: 'Hiérarchie des titres',
      forms: 'Labels et formulaires',
      lang: 'Langue de la page',
      landmarks: 'Structure et landmarks',
      navigation: 'Navigation clavier, skip-link, focus',
      media: 'Médias sous-titrés + documents PDF',
      declaration: 'Déclaration d’accessibilité + iframes titrées',
    },
    execTitle: 'Résumé pour le dirigeant',
    execSite: (site, score, color, label) => `Le site <strong>${site}</strong> a obtenu un score de <strong style="color:${color}">${score}/100</strong> (${label}).`,
    execIa: (n) => `➡ Dont <strong>${n}</strong> point(s) signalé(s) par l’analyse IA sémantique (qualité des textes alternatifs, intitulés de liens, labels). Ces points relèvent du jugement qualitatif : à confirmer lors d’un audit humain.`,
    execText90: (count) => `Avec ${count} problème(s) détecté(s), la base d’accessibilité est solide. Une passe de vérification manuelle permettra de confirmer la conformité RGAA.`,
    execText70: (count) => `${count} problèmes ont été détectés. Les principaux leviers sont visuels et structurels : contrastes, titres et alternatives textuelles. Des corrections rapides amélioreront significativement le score.`,
    execText50: (count) => `${count} problèmes sont à traiter en priorité. L’accessibilité n’est pas conforme et impacte une partie des utilisateurs. Un plan de remédiation est recommandé dans les 30 jours.`,
    execText0: (count) => `${count} problèmes critiques ont été détectés. Le site présente des blocages importants pour les utilisateurs en situation de handicap. Une intervention rapide est nécessaire.`,
    aiSubtitle: '🔎 Analyse IA (pertinence sémantique)',
    aiNote: 'Détections issues d’un modèle de langue vérifiant la pertinence des textes alternatifs, des intitulés de liens et des labels de formulaires. À confirmer par un expert.',
    techSubtitle: '🧰 Détection technique automatisée',
    techNote: 'Détections issues de vérifications techniques (contraste, structure, ARIA, formulaires, images, liens, navigation clavier, contenus). La colonne RGAA 4.1 traduit chaque problème dans le référentiel français.',
    thImpact: 'Impact', thProblem: 'Problème', thRgaa: 'RGAA 4.1', thOrigin: 'Origine',
    tagAi: 'Analyse IA',
    engineAi: 'Analyse IA', engineInteraction: 'Interaction', engineContenu: 'Contenu', engineCustom: 'Technique',
    oneshotTitle: 'Diagnostic express',
    oneshotOffer: 'One-Shot · 29 €',
    scoreGlobalNote: 'Score global (moyenne des pages)',
    top5Title: 'Top 5 des problèmes à corriger',
    actionsTitle: 'Actions prioritaires',
    testedTitle: 'Ce qui a été testé',
    proTitle: 'Rapport d\'audit détaillé',
    proOffer: 'Pro · 49 €',
    gridTitle: 'Grille des critères automatiquement testés',
    planTitle: 'Plan de remédiation priorisé',
    fullListTitle: 'Liste complète des problèmes détectés',
    monitoringTitle: 'Synthèse mensuelle',
    monitoringOffer: 'Monitoring · 9 €/mois',
    period: 'Période :',
    evolution: 'Évolution :',
    activeProblems: 'Problèmes actifs :',
    firstScan: 'Premier scan de référence',
    points: 'points',
    alertsTitle: 'Alertes régression',
    trendsTitle: 'Tendances et recommandations',
    watchedTitle: 'Critères surveillés',
    noRegression: 'Aucune régression détectée ce mois-ci.',
    regressionDetected: (pts) => `<strong>⚠ Régression détectée</strong> : le score a baissé de ${pts} points.`,
    criticalToTreat: (n) => `${n} problème(s) critique(s) à traiter en priorité.`,
    stableOrUp: '<strong>Stabilité ou amélioration</strong> : le score est stable ou en hausse. Surveillance des points restants.',
  },
  en: {
    htmlLang: 'en',
    locale: 'en-GB',
    impacts: { critical: 'Critical', serious: 'Serious', error: 'Error', moderate: 'Moderate', warning: 'Warning', minor: 'Minor', notice: 'Notice' },
    scoreLabels: { good: 'Good', improve: 'Needs improvement', poor: 'Poor', critical: 'Critical' },
    legalFooter: 'Legal notice:',
    defaultCoverage: 'This scan only covers automatically testable criteria. A human audit is still required for full RGAA compliance.',
    howtoTitle: 'How to read this report',
    howtoChecks: '<strong>What this tool checks</strong>: the accessibility criteria that can be tested automatically (colour contrast, heading structure, forms, keyboard navigation, alternative texts…) on the analysed page(s).',
    howtoNotChecks: '<strong>What it does not check</strong>: anything that requires human judgement (real screen-reader navigation, complex content, fine wording quality). A human audit is still required to declare RGAA compliance.',
    howtoStart: '<strong>Where to start</strong>: read the summary below, then fix the problems marked “Critical” or “Serious” first. Each problem starts with a plain-language explanation; the ready-to-adapt code follows — hand it to your developer or agency as-is.',
    glossaryTitle: 'Glossary (for non-developers)',
    glossary: [
      ['Skip link', 'A “Skip to content” link at the very top of the page: it lets keyboard and screen-reader users jump past repeated menus.'],
      ['Contrast ratio', 'A measure of the brightness gap between text and its background. Legal minimum: 4.5:1 for body text (3:1 for large text).'],
      ['ARIA', 'Invisible code attributes that describe elements to assistive technologies (screen readers).'],
      ['Touch target', 'The tappable area of a button or link. On mobile it must be at least 44×44 px to be comfortably usable.'],
      ['Alternative text (alt)', 'Text attached to an image, read aloud by screen readers and shown if the image fails to load.'],
      ['RGAA', 'The French accessibility standard (106 criteria). It is the legal reference in France.'],
    ],
    multipageTitle: (n) => `Multi-page audit (${n} page${n > 1 ? 's' : ''} analysed)`,
    multipageIntro: 'Home page + key pages discovered automatically (contact, products/services, legal notice, main pages). The overall score is the average of the analysed pages. A single audit is deducted from your quota.',
    thPage: 'Page', thScore: 'Score', thIssues: 'Issues',
    scanFailed: 'failed',
    scanImpossible: 'scan impossible',
    cardProblems: 'Issues detected', cardCritical: 'Critical', cardSerious: 'Serious', cardLevels: 'Impact levels',
    goodNewsNone: 'No issue detected. Excellent work!',
    goodNewsNoAction: 'No action required.',
    actions: {
      contrast: 'Improve colour contrast',
      alt: 'Write alternative texts for images',
      label: 'Associate labels with form fields',
      heading: 'Fix the heading hierarchy',
      lang: 'Declare the main page language',
      landmark: 'Structure the page with ARIA landmarks',
      name: 'Improve accessible names of interactive elements',
      link: 'Make links explicit and accessible',
      button: 'Check buttons and their accessible name',
      aria: 'Fix ARIA attributes',
      fallback: 'Check this point with an accessibility expert',
    },
    thCriterion: 'Automatically tested criterion', thState: 'Status',
    statusOk: '✓ Compliant', statusKo: '✗ Issue detected',
    notTested: 'Automated technical detection + AI analysis covers a significant but non-exhaustive share of RGAA/WCAG criteria: real screen readers, very complex content, data tables, language changes, etc. remain the scope of a human audit.',
    criteria: {
      contrast: 'Colour contrast',
      images: 'Image alternative texts (technical + semantic)',
      headings: 'Heading hierarchy',
      forms: 'Labels and forms',
      lang: 'Page language',
      landmarks: 'Structure and landmarks',
      navigation: 'Keyboard navigation, skip link, focus',
      media: 'Captioned media + PDF documents',
      declaration: 'Accessibility statement + titled iframes',
    },
    execTitle: 'Executive summary',
    execSite: (site, score, color, label) => `The site <strong>${site}</strong> scored <strong style="color:${color}">${score}/100</strong> (${label}).`,
    execIa: (n) => `➡ Including <strong>${n}</strong> point(s) flagged by the semantic AI analysis (quality of alternative texts, link labels, form labels). These are qualitative judgements: to be confirmed by a human audit.`,
    execText90: (count) => `With ${count} issue(s) detected, the accessibility baseline is solid. A manual verification pass will confirm RGAA compliance.`,
    execText70: (count) => `${count} issues were detected. The main levers are visual and structural: contrast, headings and text alternatives. Quick fixes will significantly improve the score.`,
    execText50: (count) => `${count} issues must be addressed as a priority. Accessibility is not compliant and affects some users. A remediation plan is recommended within 30 days.`,
    execText0: (count) => `${count} critical issues were detected. The site has major blockers for users with disabilities. Swift action is required.`,
    aiSubtitle: '🔎 AI analysis (semantic relevance)',
    aiNote: 'Detections from a language model checking the relevance of alternative texts, link labels and form labels. To be confirmed by an expert.',
    techSubtitle: '🧰 Automated technical detection',
    techNote: 'Detections from technical checks (contrast, structure, ARIA, forms, images, links, keyboard navigation, content). The RGAA 4.1 column translates each issue into the French standard.',
    thImpact: 'Impact', thProblem: 'Issue', thRgaa: 'RGAA 4.1', thOrigin: 'Source',
    tagAi: 'AI analysis',
    engineAi: 'AI analysis', engineInteraction: 'Interaction', engineContenu: 'Content', engineCustom: 'Technical',
    oneshotTitle: 'Express diagnostic',
    oneshotOffer: 'One-Shot · €29',
    scoreGlobalNote: 'Overall score (average of pages)',
    top5Title: 'Top 5 issues to fix',
    actionsTitle: 'Priority actions',
    testedTitle: 'What was tested',
    proTitle: 'Detailed audit report',
    proOffer: 'Pro · €49',
    gridTitle: 'Grid of automatically tested criteria',
    planTitle: 'Prioritised remediation plan',
    fullListTitle: 'Full list of detected issues',
    monitoringTitle: 'Monthly summary',
    monitoringOffer: 'Monitoring · €9/month',
    period: 'Period:',
    evolution: 'Change:',
    activeProblems: 'Active issues:',
    firstScan: 'First reference scan',
    points: 'points',
    alertsTitle: 'Regression alerts',
    trendsTitle: 'Trends and recommendations',
    watchedTitle: 'Monitored criteria',
    noRegression: 'No regression detected this month.',
    regressionDetected: (pts) => `<strong>⚠ Regression detected</strong>: the score dropped by ${pts} points.`,
    criticalToTreat: (n) => `${n} critical issue(s) to fix first.`,
    stableOrUp: '<strong>Stable or improving</strong>: the score is stable or rising. Remaining points stay under watch.',
  },
};

const IMPACT_ORDER = { critical: 0, serious: 1, error: 2, moderate: 3, warning: 4, minor: 5, notice: 6 };

function impactRank(issue) {
  const key = (issue.impact || issue.type || 'notice').toLowerCase();
  return IMPACT_ORDER[key] ?? 99;
}

function impactLabel(issue, lang) {
  const key = (issue.impact || issue.type || 'notice').toLowerCase();
  return T[lang].impacts[key] ?? key;
}

function engineLabel(issue, lang) {
  const t = T[lang];
  if (issue.ai || issue.engine === 'ia') return t.engineAi;
  if (issue.layer === 'interaction') return t.engineInteraction;
  if (issue.layer === 'contenu') return t.engineContenu;
  if (issue.engine === 'custom') return t.engineCustom;
  return issue.engine || '-';
}

// Palette volontairement plus foncée que la charte marketing : chaque couleur
// passe le ratio 4,5:1 sur fond blanc ET sur #f0fdfa (résumé dirigeant) ET sur
// #f9fafb (cartes) — vérifié par calcul WCAG (tests/report.test.js).
function scoreColor(score) {
  if (score >= 90) return '#15803d';
  if (score >= 70) return '#a16207';
  if (score >= 50) return '#c2410c';
  return '#b91c1c';
}

function scoreLabel(score, lang = 'fr') {
  const l = T[normalizeLang(lang)].scoreLabels;
  if (score >= 90) return l.good;
  if (score >= 70) return l.improve;
  if (score >= 50) return l.poor;
  return l.critical;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(iso, lang = 'fr') {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(T[lang].locale, { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateTime(iso, lang = 'fr') {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString(T[lang].locale, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function logo() {
  return `
    <div class="logo">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
      </svg>
      <span>AccessiCheck</span>
    </div>
  `;
}

function layout({ title, offerLabel, scan, body, footerExtra = '', lang = 'fr' }) {
  const t = T[lang];
  const result = scan.result || {};
  return `
<!DOCTYPE html>
<html lang="${t.htmlLang}">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <style>${STYLE_CSS}</style>
</head>
<body>
  <header class="report-header">
    ${logo()}
    <div class="meta">
      <span class="offer-badge">${escapeHtml(offerLabel)}</span>
      <span class="date">${formatDate(result.scanned_at || scan.finished_at || scan.created_at, lang)}</span>
    </div>
  </header>
  ${body}
  <footer class="report-footer">
    <p><strong>${t.legalFooter}</strong> ${escapeHtml(result.coverage_note || t.defaultCoverage)}</p>
    <p>AccessiCheck — Brozapi — SIRET actif</p>
    ${footerExtra}
  </footer>
</body>
</html>
  `;
}

// Encart « Comment lire ce rapport » — destiné au lecteur non-développeur,
// placé en tout début de rapport (avant le score).
function howtoBox(lang) {
  const t = T[lang];
  return `
    <section class="howto-box">
      <h2>${t.howtoTitle}</h2>
      <ul>
        <li>${t.howtoChecks}</li>
        <li>${t.howtoNotChecks}</li>
        <li>${t.howtoStart}</li>
      </ul>
    </section>
  `;
}

// Glossaire minimal en fin de rapport (une ligne par terme).
function glossarySection(lang) {
  const t = T[lang];
  return `
    <section class="glossary-section">
      <h2>${t.glossaryTitle}</h2>
      <dl>
        ${t.glossary.map(([term, def]) => `<dt>${escapeHtml(term)}</dt><dd>${escapeHtml(def)}</dd>`).join('\n        ')}
      </dl>
    </section>
  `;
}

function scoreSection(score, lang) {
  const color = scoreColor(score);
  const label = scoreLabel(score, lang);
  return `
    <section class="score-section">
      <div class="score-ring" style="--score-color: ${color}; --score-percent: ${score}">
        <div class="score-value">${score}<small>/100</small></div>
      </div>
      <div class="score-label" style="color:${color}">${label}</div>
    </section>
  `;
}

// Audit multi-pages : score par page + score global (moyenne des pages scannées).
function multiPageSection(result, lang) {
  const t = T[lang];
  const pages = result.pages || [];
  if (pages.length <= 1) return '';
  const rows = pages.map((p) => {
    const scoreCell = p.status === 'done'
      ? `<strong style="color:${scoreColor(p.score)}">${p.score}/100</strong>`
      : `<span class="status-ko">${t.scanFailed}</span>`;
    const issuesCell = p.status === 'done' ? String(p.issuesCount) : escapeHtml(p.error || t.scanImpossible);
    const label = p.pageTitle ? `${escapeHtml(p.path)} <span class="page-title-note">— ${escapeHtml(p.pageTitle)}</span>` : escapeHtml(p.path);
    return `
        <tr>
          <td>${label}</td>
          <td>${scoreCell}</td>
          <td>${issuesCell}</td>
        </tr>`;
  }).join('');
  const doneCount = pages.filter((p) => p.status === 'done').length;
  return `
    <section class="multipage-section">
      <h2>${t.multipageTitle(doneCount)}</h2>
      <p class="corrections-intro">${t.multipageIntro}</p>
      <table class="criteria-table pages-table">
        <thead>
          <tr><th>${t.thPage}</th><th>${t.thScore}</th><th>${t.thIssues}</th></tr>
        </thead>
        <tbody>${rows}
        </tbody>
      </table>
    </section>
  `;
}

function summaryCards(result, lang) {
  const t = T[lang];
  const summary = result.summary || {};
  const byImpact = summary.byImpact || {};
  const total = result.issues ? result.issues.length : 0;
  return `
    <div class="cards">
      <div class="card"><div class="card-number">${total}</div><div class="card-label">${t.cardProblems}</div></div>
      <div class="card"><div class="card-number">${byImpact.critical || 0}</div><div class="card-label">${t.cardCritical}</div></div>
      <div class="card"><div class="card-number">${byImpact.serious || byImpact.error || 0}</div><div class="card-label">${t.cardSerious}</div></div>
      <div class="card"><div class="card-number">${Object.keys(byImpact).length}</div><div class="card-label">${t.cardLevels}</div></div>
    </div>
  `;
}

function topIssuesList(issues, limit = 5, lang = 'fr') {
  if (!issues || issues.length === 0) {
    return `<p class="good-news">${T[lang].goodNewsNone}</p>`;
  }
  const sorted = [...issues].sort((a, b) => impactRank(a) - impactRank(b)).slice(0, limit);
  return `
    <ol class="issue-list">
      ${sorted.map((issue) => `
        <li>
          <span class="impact-pill impact-${(issue.impact || issue.type || 'notice').toLowerCase()}">${impactLabel(issue, lang)}</span>
          <span class="issue-message">${escapeHtml(issueMessage(issue, lang))}</span>
        </li>
      `).join('')}
    </ol>
  `;
}

function remediationPlan(issues, lang = 'fr') {
  if (!issues || issues.length === 0) {
    return `<p class="good-news">${T[lang].goodNewsNoAction}</p>`;
  }
  const grouped = {};
  for (const issue of issues) {
    const action = actionForIssue(issue, lang);
    grouped[action] = (grouped[action] || 0) + 1;
  }
  const entries = Object.entries(grouped).sort((a, b) => b[1] - a[1]);
  return `
    <ol class="plan-list">
      ${entries.map(([action, count]) => `
        <li>
          <span class="plan-count">${count}</span>
          <span class="plan-action">${escapeHtml(action)}</span>
        </li>
      `).join('')}
    </ol>
  `;
}

function actionForIssue(issue, lang = 'fr') {
  const a = T[lang].actions;
  const msg = (issue.message || issue.help || issue.description || issue.id || issue.code || '').toLowerCase();
  const id = (issue.id || issue.code || '').toLowerCase();
  if (id.includes('contrast') || msg.includes('contraste') || msg.includes('contrast')) return a.contrast;
  if (id.includes('alt') || msg.includes('alt') || msg.includes('image')) return a.alt;
  if (id.includes('label') || msg.includes('label') || msg.includes('formulaire') || msg.includes('form')) return a.label;
  if (id.includes('heading') || msg.includes('h1') || msg.includes('titre') || msg.includes('heading')) return a.heading;
  if (id.includes('lang') || msg.includes('langue') || msg.includes('language')) return a.lang;
  if (id.includes('landmark') || msg.includes('region') || msg.includes('navigation') || msg.includes('landmark')) return a.landmark;
  if (id.includes('name') || msg.includes('nom accessible') || msg.includes('accessible name')) return a.name;
  if (id.includes('link') || msg.includes('lien') || msg.includes('link')) return a.link;
  if (id.includes('button') || msg.includes('bouton') || msg.includes('button')) return a.button;
  if (msg.includes('aria')) return a.aria;
  return a.fallback;
}

function criteriaTable(result, lang = 'fr') {
  const t = T[lang];
  const c = t.criteria;
  const criteria = [
    { label: c.contrast, ok: !hasIssueLike(result.issues, 'contrast') },
    { label: c.images, ok: !hasIssueLike(result.issues, 'alt') && !hasIssueLike(result.issues, 'semantique') },
    { label: c.headings, ok: !hasIssueLike(result.issues, 'heading') && !hasIssueLike(result.issues, 'no-h1') && !hasIssueLike(result.issues, 'multiple-h1') },
    { label: c.forms, ok: !hasIssueLike(result.issues, 'label') },
    { label: c.lang, ok: !hasIssueLike(result.issues, 'lang') },
    { label: c.landmarks, ok: !hasIssueLike(result.issues, 'landmark') },
    { label: c.navigation, ok: !hasIssueLike(result.issues, 'skip') && !hasIssueLike(result.issues, 'focus') && !hasIssueLike(result.issues, 'interaction') },
    { label: c.media, ok: !hasIssueLike(result.issues, 'media') && !hasIssueLike(result.issues, 'pdf') },
    { label: c.declaration, ok: !hasIssueLike(result.issues, 'accessibility-statement') && !hasIssueLike(result.issues, 'iframe') },
  ];
  return `
    <table class="criteria-table">
      <thead>
        <tr><th>${t.thCriterion}</th><th>${t.thState}</th></tr>
      </thead>
      <tbody>
        ${criteria.map(crit => `
          <tr>
            <td>${escapeHtml(crit.label)}</td>
            <td>${crit.ok ? `<span class="status-ok">${t.statusOk}</span>` : `<span class="status-ko">${t.statusKo}</span>`}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <p class="not-tested">${t.notTested}</p>
  `;
}

function hasIssueLike(issues, keyword) {
  if (!issues) return false;
  const kw = keyword.toLowerCase();
  return issues.some(i => {
    const text = `${i.id || ''} ${i.code || ''} ${i.message || ''} ${i.help || ''} ${i.description || ''}`.toLowerCase();
    return text.includes(kw);
  });
}

function executiveSummary(result, lang) {
  const t = T[lang];
  const score = result.score ?? 0;
  const label = scoreLabel(score, lang);
  const color = scoreColor(score);
  const summary = result.summary || {};
  const byLayer = summary.byLayer || {};
  const nIA = byLayer.ia || 0;
  return `
    <section class="executive-summary">
      <h2>${t.execTitle}</h2>
      <p>${t.execSite(escapeHtml(result.pageTitle || result.url), score, color, label)}</p>
      <p>${executiveText(score, result.issues, lang)}</p>
      ${nIA > 0 ? `<p>${t.execIa(nIA)}</p>` : ''}
    </section>
  `;
}

function executiveText(score, issues, lang) {
  const t = T[lang];
  const count = issues ? issues.length : 0;
  if (score >= 90) return t.execText90(count);
  if (score >= 70) return t.execText70(count);
  if (score >= 50) return t.execText50(count);
  return t.execText0(count);
}

function allIssuesTable(issues, lang = 'fr') {
  const t = T[lang];
  if (!issues || issues.length === 0) {
    return `<p class="good-news">${t.goodNewsNone}</p>`;
  }
  const sorted = [...issues].sort((a, b) => impactRank(a) - impactRank(b));
  const tech = issues.filter((i) => !(i.ai || i.engine === 'ia'));
  const ia = issues.filter((i) => i.ai || i.engine === 'ia');
  const aiSection = ia.length > 0 ? `
    <h3 class="ai-subtitle">${t.aiSubtitle}</h3>
    <p class="ai-note">${t.aiNote}</p>
    <table class="issues-table compact">
      <thead><tr><th>${t.thImpact}</th><th>${t.thProblem}</th><th>${t.thRgaa}</th><th>${t.thOrigin}</th></tr></thead>
      <tbody>
        ${ia.map(i => `
          <tr>
            <td><span class="impact-pill impact-${(i.impact || i.type || 'notice').toLowerCase()}">${impactLabel(i, lang)}</span></td>
            <td>${escapeHtml(issueMessage(i, lang))}</td>
            <td>${escapeHtml(rgaaAnnotation(i, lang).text)}</td>
            <td><span class="tag-ai">${t.tagAi}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : '';
  return `
    ${aiSection}
    <h3 class="ai-subtitle">${t.techSubtitle}</h3>
    <p class="ai-note">${t.techNote}</p>
    <table class="issues-table">
      <thead>
        <tr><th>${t.thImpact}</th><th>${t.thProblem}</th><th>${t.thRgaa}</th><th>${t.thOrigin}</th></tr>
      </thead>
      <tbody>
        ${sorted.filter((i) => tech.includes(i)).map(i => `
          <tr>
            <td><span class="impact-pill impact-${(i.impact || i.type || 'notice').toLowerCase()}">${impactLabel(i, lang)}</span></td>
            <td>${escapeHtml(issueMessage(i, lang))}</td>
            <td>${escapeHtml(rgaaAnnotation(i, lang).text)}</td>
            <td>${escapeHtml(engineLabel(i, lang))}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderOneShot(scan, lang = 'fr') {
  lang = normalizeLang(lang);
  const t = T[lang];
  const result = scan.result || {};
  const score = result.score ?? 0;
  const multipage = multiPageSection(result, lang);
  const scoreTitle = multipage ? t.scoreGlobalNote : '';
  const body = `
    <main class="report-body oneshot">
      <h1>${t.oneshotTitle}</h1>
      <p class="url">${escapeHtml(result.url || scan.url)}</p>
      ${howtoBox(lang)}
      ${scoreTitle ? `<p class="score-note">${scoreTitle}</p>` : ''}
      ${scoreSection(score, lang)}
      ${multipage}
      ${summaryCards(result, lang)}
      <section>
        <h2>${t.top5Title}</h2>
        ${topIssuesList(result.issues, 5, lang)}
      </section>
      <section>
        <h2>${t.actionsTitle}</h2>
        ${remediationPlan(result.issues, lang)}
      </section>
      ${correctionsSectionHtml(result.issues, 5, lang)}
      ${rgaaSectionHtml(result.issues, { pages: result.pages, lang })}
      <section>
        <h2>${t.testedTitle}</h2>
        ${criteriaTable(result, lang)}
      </section>
      ${glossarySection(lang)}
    </main>
  `;
  return layout({ title: `AccessiCheck — ${t.oneshotTitle}`, offerLabel: t.oneshotOffer, scan, body, lang });
}

function renderPro(scan, lang = 'fr') {
  lang = normalizeLang(lang);
  const t = T[lang];
  const result = scan.result || {};
  const score = result.score ?? 0;
  const body = `
    <main class="report-body pro">
      <h1>${t.proTitle}</h1>
      <p class="url">${escapeHtml(result.url || scan.url)}</p>
      ${howtoBox(lang)}
      ${executiveSummary(result, lang)}
      ${scoreSection(score, lang)}
      ${multiPageSection(result, lang)}
      ${summaryCards(result, lang)}
      <section>
        <h2>${t.gridTitle}</h2>
        ${criteriaTable(result, lang)}
      </section>
      <section>
        <h2>${t.planTitle}</h2>
        ${remediationPlan(result.issues, lang)}
      </section>
      ${correctionsSectionHtml(result.issues, 5, lang)}
      ${rgaaSectionHtml(result.issues, { pages: result.pages, lang })}
      <section class="page-break">
        <h2>${t.fullListTitle}</h2>
        ${allIssuesTable(result.issues, lang)}
      </section>
      ${glossarySection(lang)}
    </main>
  `;
  return layout({ title: `AccessiCheck — ${t.proTitle}`, offerLabel: t.proOffer, scan, body, lang });
}

function renderMonitoring(scan, lang = 'fr') {
  lang = normalizeLang(lang);
  const t = T[lang];
  const result = scan.result || {};
  const score = result.score ?? 0;
  const previousScore = scan.previousScore ?? null;
  const evolution = previousScore !== null ? score - previousScore : null;
  const evolutionHtml = evolution !== null
    ? `<span class="evolution ${evolution >= 0 ? 'up' : 'down'}">${evolution >= 0 ? '▲' : '▼'} ${Math.abs(evolution)} ${t.points}</span>`
    : `<span class="evolution">${t.firstScan}</span>`;
  const body = `
    <main class="report-body monitoring">
      <h1>${t.monitoringTitle}</h1>
      <p class="url">${escapeHtml(result.url || scan.url)}</p>
      ${howtoBox(lang)}
      <div class="monitoring-header">
        ${scoreSection(score, lang)}
        <div class="monitoring-meta">
          <p>${t.period} <strong>${formatDate(result.scanned_at || scan.finished_at, lang)}</strong></p>
          <p>${t.evolution} ${evolutionHtml}</p>
          <p>${t.activeProblems} <strong>${result.issues ? result.issues.length : 0}</strong></p>
        </div>
      </div>
      ${multiPageSection(result, lang)}
      ${summaryCards(result, lang)}
      <section>
        <h2>${t.alertsTitle}</h2>
        ${regressionAlerts(result.issues, previousScore, evolution, lang)}
      </section>
      <section>
        <h2>${t.trendsTitle}</h2>
        ${remediationPlan(result.issues, lang)}
      </section>
      <section>
        <h2>${t.watchedTitle}</h2>
        ${criteriaTable(result, lang)}
      </section>
      ${glossarySection(lang)}
    </main>
  `;
  return layout({ title: `AccessiCheck — ${t.monitoringTitle}`, offerLabel: t.monitoringOffer, scan, body, lang });
}

function regressionAlerts(issues, previousScore, evolution, lang = 'fr') {
  const t = T[lang];
  if (!issues || issues.length === 0) {
    return `<p class="good-news">${t.noRegression}</p>`;
  }
  const critical = issues.filter(i => ['critical', 'serious', 'error'].includes((i.impact || i.type || '').toLowerCase()));
  if (evolution !== null && evolution < 0) {
    return `
      <div class="alert alert-warning">
        ${t.regressionDetected(Math.abs(evolution))}
        ${critical.length > 0 ? `<br>${t.criticalToTreat(critical.length)}` : ''}
      </div>
      ${topIssuesList(issues, 5, lang)}
    `;
  }
  return `
    <div class="alert alert-info">
      ${t.stableOrUp}
    </div>
    ${topIssuesList(issues, 5, lang)}
  `;
}

module.exports = {
  renderOneShot,
  renderPro,
  renderMonitoring,
  scoreColor,
  scoreLabel,
  normalizeLang,
};
