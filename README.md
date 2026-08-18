# AccessiCheck

Audit d'accessibilité RGAA/WCAG automatisé — diagnostic express pour petits sites, freelances et agences web.

## Statut

Landing page statique en phase de lancement. Le produit vend un **diagnostic express** (29 € one-shot), un rapport Pro (49 €) et une surveillance mensuelle (9 €/mois).

> Aucun outil ne peut garantir la conformité RGAA. AccessiCheck couvre uniquement les critères automatiquement testables ; un audit humain reste nécessaire pour une conformité pleine et entière.

## Structure du dépôt

```
.
├── index.html              # Landing page française
├── mentions-legales.html   # Mentions légales, CGV, politique de confidentialité
├── favicon.svg             # Favicon minimaliste
├── CNAME                   # accessicheck.brozapi.com
├── .nojekyll               # Désactive Jekyll sur GitHub Pages
├── assets/
│   ├── style.css           # Design responsive sans dépendance externe
│   └── app.js              # Interactions légères (CTA, ancres, statistiques)
├── robots.txt
└── sitemap.xml
```

## Déploiement

### Site statique (GitHub Pages)

1. Pousser la branche `main` vers `github.com/vizinote/accessicheck`.
2. Activer GitHub Pages depuis la branche `main` / dossier racine.
3. Le domaine personnalisé `accessicheck.brozapi.com` est configuré via le fichier `CNAME`.

## Conformité

- Zéro cookie, zéro tracking côté site statique.
- Aucune donnée personnelle sensible collectée sans consentement.
- Aucun secret n'est commité dans le dépôt.

## Avertissement

AccessiCheck est un outil technique d'aide au diagnostic. Il ne constitue ni un conseil juridique ni une garantie de conformité RGAA/WCAG.
trigger rebuild
