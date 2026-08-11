const fs = require('fs');
const path = require('path');

const STYLE_CSS = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');

const IMPACT_ORDER = { critical: 0, serious: 1, error: 2, moderate: 3, warning: 4, minor: 5, notice: 6 };
const IMPACT_LABELS = {
  critical: 'Critique',
  serious: 'Sérieux',
  error: 'Erreur',
  moderate: 'Moyen',
  warning: 'Avertissement',
  minor: 'Mineur',
  notice: 'Information',
};

function impactRank(issue) {
  const key = (issue.impact || issue.type || 'notice').toLowerCase();
  return IMPACT_ORDER[key] ?? 99;
}

function impactLabel(issue) {
  const key = (issue.impact || issue.type || 'notice').toLowerCase();
  return IMPACT_LABELS[key] ?? key;
}

function scoreColor(score) {
  if (score >= 90) return '#16a34a';
  if (score >= 70) return '#ca8a04';
  if (score >= 50) return '#ea580c';
  return '#dc2626';
}

function scoreLabel(score) {
  if (score >= 90) return 'Bon';
  if (score >= 70) return 'À améliorer';
  if (score >= 50) return 'Insuffisant';
  return 'Critique';
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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

function layout({ title, offerLabel, scan, body, footerExtra = '' }) {
  const result = scan.result || {};
  return `
<!DOCTYPE html>
<html lang="fr">
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
      <span class="date">${formatDate(result.scanned_at || scan.finished_at || scan.created_at)}</span>
    </div>
  </header>
  ${body}
  <footer class="report-footer">
    <p><strong>Mention légale :</strong> ${escapeHtml(result.coverage_note || 'Ce scan couvre uniquement les critères automatiquement testables. Un audit humain reste nécessaire pour une conformité RGAA complète.')}</p>
    <p>AccessiCheck — Brozapi — SIRET actif</p>
    ${footerExtra}
  </footer>
</body>
</html>
  `;
}

function scoreSection(score) {
  const color = scoreColor(score);
  const label = scoreLabel(score);
  return `
    <section class="score-section">
      <div class="score-ring" style="--score-color: ${color}; --score-percent: ${score}">
        <div class="score-value">${score}<small>/100</small></div>
      </div>
      <div class="score-label" style="color:${color}">${label}</div>
    </section>
  `;
}

function summaryCards(result) {
  const summary = result.summary || {};
  const byImpact = summary.byImpact || {};
  const total = result.issues ? result.issues.length : 0;
  return `
    <div class="cards">
      <div class="card"><div class="card-number">${total}</div><div class="card-label">Problèmes détectés</div></div>
      <div class="card"><div class="card-number">${byImpact.critical || 0}</div><div class="card-label">Critiques</div></div>
      <div class="card"><div class="card-number">${byImpact.serious || byImpact.error || 0}</div><div class="card-label">Sérieux</div></div>
      <div class="card"><div class="card-number">${Object.keys(byImpact).length}</div><div class="card-label">Niveaux d'impact</div></div>
    </div>
  `;
}

function topIssuesList(issues, limit = 5) {
  if (!issues || issues.length === 0) {
    return '<p class="good-news">Aucun problème détecté. Excellent travail !</p>';
  }
  const sorted = [...issues].sort((a, b) => impactRank(a) - impactRank(b)).slice(0, limit);
  return `
    <ol class="issue-list">
      ${sorted.map((issue, i) => `
        <li>
          <span class="impact-pill impact-${(issue.impact || issue.type || 'notice').toLowerCase()}">${impactLabel(issue)}</span>
          <span class="issue-message">${escapeHtml(issue.message || issue.help || issue.description || 'Problème détecté')}</span>
        </li>
      `).join('')}
    </ol>
  `;
}

function remediationPlan(issues) {
  if (!issues || issues.length === 0) {
    return '<p class="good-news">Aucune action requise.</p>';
  }
  const grouped = {};
  for (const issue of issues) {
    const action = actionForIssue(issue);
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

function actionForIssue(issue) {
  const msg = (issue.message || issue.help || issue.description || issue.id || issue.code || '').toLowerCase();
  const id = (issue.id || issue.code || '').toLowerCase();
  if (id.includes('contrast') || msg.includes('contraste')) return 'Améliorer les contrastes de couleur';
  if (id.includes('alt') || msg.includes('alt') || msg.includes('image')) return 'Rédiger des textes alternatifs pour les images';
  if (id.includes('label') || msg.includes('label') || msg.includes('formulaire')) return 'Associer des labels aux champs de formulaire';
  if (id.includes('heading') || msg.includes('h1') || msg.includes('titre')) return 'Revoir la hiérarchie des titres';
  if (id.includes('lang') || msg.includes('langue')) return 'Déclarer la langue principale de la page';
  if (id.includes('landmark') || msg.includes('region') || msg.includes('navigation')) return 'Structurer la page avec des landmarks ARIA';
  if (id.includes('name') || msg.includes('nom accessible')) return 'Améliorer les noms accessibles des éléments interactifs';
  if (id.includes('link') || msg.includes('lien')) return 'Rendre les liens explicites et accessibles';
  if (id.includes('button') || msg.includes('bouton')) return 'Vérifier les boutons et leur nom accessible';
  if (msg.includes('aria')) return 'Corriger les attributs ARIA';
  return 'Vérifier ce point avec un expert accessibilité';
}

function criteriaGrid(result) {
  const criteria = [
    { id: 'Contrastes', label: 'Contrastes de couleur', ok: !hasIssueLike(result.issues, 'contrast') },
    { id: 'Images', label: 'Textes alternatifs aux images', ok: !hasIssueLike(result.issues, 'alt') },
    { id: 'Titres', label: 'Hiérarchie des titres', ok: !hasIssueLike(result.issues, 'heading') },
    { id: 'Formulaires', label: 'Labels et formulaires', ok: !hasIssueLike(result.issues, 'label') },
    { id: 'Langue', label: 'Langue de la page', ok: !hasIssueLike(result.issues, 'lang') },
    { id: 'Landmarks', label: 'Structure et landmarks', ok: !hasIssueLike(result.issues, 'landmark') },
    { id: 'Noms', label: 'Noms accessibles', ok: !hasIssueLike(result.issues, 'name') },
  ];
  return `
    <table class="criteria-grid">
      <thead>
        <tr><th>Critère testé automatiquement</th><th>État</th></tr>
      </thead>
      <tbody>
        ${criteria.map(c => `
          <tr>
            <td>${escapeHtml(c.label)}</td>
            <td>${c.ok ? '<span class="status-ok">✓ Conforme</span>' : '<span class="status-ko">✗ Problème détecté</span>'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <p class="not-tested">Critères non testés automatiquement : navigation clavier, lecteur d'écran, contenus multimédias, documents téléchargeables, formulaires complexes, tableaux de données, changements de langue, etc.</p>
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

function executiveSummary(result) {
  const score = result.score ?? 0;
  const label = scoreLabel(score);
  const color = scoreColor(score);
  return `
    <section class="executive-summary">
      <h2>Résumé pour le dirigeant</h2>
      <p>Le site <strong>${escapeHtml(result.pageTitle || result.url)}</strong> a obtenu un score de <strong style="color:${color}">${score}/100</strong> (${label}).</p>
      <p>${executiveText(score, result.issues)}</p>
    </section>
  `;
}

function executiveText(score, issues) {
  const count = issues ? issues.length : 0;
  if (score >= 90) return `Avec ${count} problème(s) détecté(s), la base d'accessibilité est solide. Une passe de vérification manuelle permettra de confirmer la conformité RGAA.`;
  if (score >= 70) return `${count} problèmes ont été détectés. Les principaux leviers sont visuels et structurels : contrastes, titres et alternatives textuelles. Des corrections rapides amélioreront significativement le score.`;
  if (score >= 50) return `${count} problèmes sont à traiter en priorité. L'accessibilité n'est pas conforme et impacte une partie des utilisateurs. Un plan de remédiation est recommandé dans les 30 jours.`;
  return `${count} problèmes critiques ont été détectés. Le site présente des blocages importants pour les utilisateurs en situation de handicap. Une intervention rapide est nécessaire.`;
}

function allIssuesTable(issues) {
  if (!issues || issues.length === 0) {
    return '<p class="good-news">Aucun problème détecté.</p>';
  }
  const sorted = [...issues].sort((a, b) => impactRank(a) - impactRank(b));
  return `
    <table class="issues-table">
      <thead>
        <tr><th>Impact</th><th>Problème</th><th>Moteur</th></tr>
      </thead>
      <tbody>
        ${sorted.map(i => `
          <tr>
            <td><span class="impact-pill impact-${(i.impact || i.type || 'notice').toLowerCase()}">${impactLabel(i)}</span></td>
            <td>${escapeHtml(i.message || i.help || i.description || 'Problème détecté')}</td>
            <td>${escapeHtml(i.engine || '-')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderOneShot(scan) {
  const result = scan.result || {};
  const score = result.score ?? 0;
  const body = `
    <main class="report-body oneshot">
      <h1>Diagnostic express</h1>
      <p class="url">${escapeHtml(result.url || scan.url)}</p>
      ${scoreSection(score)}
      ${summaryCards(result)}
      <section>
        <h2>Top 5 des problèmes à corriger</h2>
        ${topIssuesList(result.issues, 5)}
      </section>
      <section>
        <h2>Actions prioritaires</h2>
        ${remediationPlan(result.issues)}
      </section>
      <section>
        <h2>Ce qui a été testé</h2>
        ${criteriaGrid(result)}
      </section>
    </main>
  `;
  return layout({ title: 'AccessiCheck — Diagnostic express', offerLabel: 'One-Shot · 29 €', scan, body });
}

function renderPro(scan) {
  const result = scan.result || {};
  const score = result.score ?? 0;
  const body = `
    <main class="report-body pro">
      <h1>Rapport d'audit détaillé</h1>
      <p class="url">${escapeHtml(result.url || scan.url)}</p>
      ${executiveSummary(result)}
      ${scoreSection(score)}
      ${summaryCards(result)}
      <section>
        <h2>Grille des critères automatiquement testés</h2>
        ${criteriaGrid(result)}
      </section>
      <section>
        <h2>Plan de remédiation priorisé</h2>
        ${remediationPlan(result.issues)}
      </section>
      <section class="page-break">
        <h2>Liste complète des problèmes détectés</h2>
        ${allIssuesTable(result.issues)}
      </section>
    </main>
  `;
  return layout({ title: 'AccessiCheck — Rapport Pro', offerLabel: 'Pro · 49 €', scan, body });
}

function renderMonitoring(scan) {
  const result = scan.result || {};
  const score = result.score ?? 0;
  const previousScore = scan.previousScore ?? null;
  const evolution = previousScore !== null ? score - previousScore : null;
  const evolutionHtml = evolution !== null
    ? `<span class="evolution ${evolution >= 0 ? 'up' : 'down'}">${evolution >= 0 ? '▲' : '▼'} ${Math.abs(evolution)} points</span>`
    : '<span class="evolution">Premier scan de référence</span>';
  const body = `
    <main class="report-body monitoring">
      <h1>Synthèse mensuelle</h1>
      <p class="url">${escapeHtml(result.url || scan.url)}</p>
      <div class="monitoring-header">
        ${scoreSection(score)}
        <div class="monitoring-meta">
          <p>Période : <strong>${formatDate(result.scanned_at || scan.finished_at)}</strong></p>
          <p>Évolution : ${evolutionHtml}</p>
          <p>Problèmes actifs : <strong>${result.issues ? result.issues.length : 0}</strong></p>
        </div>
      </div>
      ${summaryCards(result)}
      <section>
        <h2>Alertes régression</h2>
        ${regressionAlerts(result.issues, previousScore, evolution)}
      </section>
      <section>
        <h2>Tendances et recommandations</h2>
        ${remediationPlan(result.issues)}
      </section>
      <section>
        <h2>Critères surveillés</h2>
        ${criteriaGrid(result)}
      </section>
    </main>
  `;
  return layout({ title: 'AccessiCheck — Synthèse mensuelle', offerLabel: 'Monitoring · 9 €/mois', scan, body });
}

function regressionAlerts(issues, previousScore, evolution) {
  if (!issues || issues.length === 0) {
    return '<p class="good-news">Aucune régression détectée ce mois-ci.</p>';
  }
  const critical = issues.filter(i => ['critical', 'serious', 'error'].includes((i.impact || i.type || '').toLowerCase()));
  if (evolution !== null && evolution < 0) {
    return `
      <div class="alert alert-warning">
        <strong>⚠ Régression détectée</strong> : le score a baissé de ${Math.abs(evolution)} points.
        ${critical.length > 0 ? `<br>${critical.length} problème(s) critique(s) à traiter en priorité.` : ''}
      </div>
      ${topIssuesList(issues, 5)}
    `;
  }
  return `
    <div class="alert alert-info">
      <strong>Stabilité ou amélioration</strong> : le score est stable ou en hausse. Surveillance des points restants.
    </div>
    ${topIssuesList(issues, 5)}
  `;
}

module.exports = {
  renderOneShot,
  renderPro,
  renderMonitoring,
};
