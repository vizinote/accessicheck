---
title: "Accessibilité web : votre site est-il concerné ? Le guide du dirigeant (EAA, RGAA, WCAG)"
author: Brozapi
date: 2026-08-20
version: "TEMPORAIRE"
langue: fr
---

# Accessibilité web : votre site est-il concerné ? Le guide du dirigeant (EAA, RGAA, WCAG)

> **VERSION TEMPORAIRE EN COURS DE VALIDATION**
>
> Ce document est une ébauche structurée du guide définitif. Le contenu rédigé, les exemples concrets, les chiffres officiels et les ressources finales seront ajoutés et validés dans une prochaine étape. Ne le citez pas comme référence juridique à ce stade.

---

## Introduction

L'accessibilité numérique n'est plus réservée aux grandes entreprises. Entre le Référentiel Général d'Amélioration de l'Accessibilité (RGAA) en France, la directive européenne sur l'accessibilité des sites publics et l'European Accessibility Act (EAA) qui étend les obligations au secteur privé grand public, de plus en plus de dirigeants se demandent : « Mon site est-il concerné ? Que risque-t-on ? Par où commencer ? »

Ce guide a pour objectif de répondre à ces questions en termes simples, sans jargon technique, et de proposer un plan d'action concret pour les PME et les indépendants.

---

## 1. Qui est concerné par l'EAA, le RGAA et WCAG ?

### Le RGAA : le cadre français

Le RGAA s'applique principalement :

- Aux services publics en ligne (administrations, collectivités, établissements publics).
- Aux entreprises privées chargées d'une mission de service public.
- Aux sites et applications mobiles concernés par la loi de 2005 pour l'égalité des droits.

Pour ces entités, la conformité au RGAA est obligatoire et doit être déclarée via une déclaration d'accessibilité.

### L'EAA (European Accessibility Act) : l'extension au privé

À partir du 28 juin 2025, l'EAA s'applique aux produits et services numériques grand public, notamment :

- Les boutiques en ligne et plateformes de commerce électronique.
- Les services bancaires et de paiement en ligne.
- Les plateformes de transport, de voyages et de réservation.
- Les livres numériques et logiciels grand public.
- Les services de communications électroniques.

Si vous vendez des produits ou des services en ligne à des consommateurs européens, vous êtes probablement concerné.

### WCAG : la base technique commune

Les Web Content Accessibility Guidelines (WCAG) sont les recommandations techniques internationales sur lesquelles reposent à la fois le RGAA et l'EAA. Connaître les quatre grands principes — perceptible, utilisable, compréhensible et robuste — permet de comprendre l'esprit de la réglementation.

---

## 2. Risques et conséquences pour une PME

### Risque juridique

En cas de non-conformité avérée, les sanctions peuvent inclure :

- Une injonction de mise en conformité.
- Une amende administrative pouvant aller jusqu'à 45 000 € en France pour les manquements les plus graves.
- Des actions contentieuses initiées par des associations de défense des droits des personnes en situation de handicap.

### Risque commercial

Un site inaccessible exclut une part significative de vos visiteurs : personnes malvoyantes, malentendantes, dyslexiques, seniors, ou encore utilisateurs de technologies d'assistance. C'est autant de clients, de prospects et de collaborateurs potentiels que l'on écarte.

### Risque de réputation

La transparence sur l'accessibilité devient un critère de confiance. Afficher une démarche proactive, même incomplète, est généralement mieux perçu qu'un silence ou des promesses non tenues.

---

## 3. Les erreurs d'accessibilité les plus fréquentes

Voici les problèmes les plus souvent détectés par les outils automatiques et les audits rapides :

- **Contrastes insuffisants** entre le texte et le fond.
- **Images sans texte alternatif** (`alt`) ou avec un texte non pertinent.
- **Formulaires mal étiquetés**, sans liaison explicite entre le champ et son label.
- **Liens vagues** du type « cliquez ici » ou « en savoir plus » sans contexte.
- **Titres mal structurés**, qui rendent la navigation confuse.
- **Navigation au clavier impossible** ou focus invisible.
- **Vidéos et médias sans transcription** ni sous-titres.
- **Documents PDF non accessibles**.

Ces erreurs sont souvent simples à corriger une fois qu'on les a identifiées.

---

## 4. Plan d'action en 5 étapes

### Étape 1 — Faire un premier diagnostic

Utilisez un outil automatique pour identifier les problèmes techniques visibles sur votre page d'accueil. Cela donne une photographie rapide et permet de prioriser les corrections.

### Étape 2 — Corriger les erreurs techniques simples

Concentrez-vous d'abord sur les problèmes à fort impact et faible effort : contrastes, attributs `alt`, étiquettes de formulaires, titres, liens explicites.

### Étape 3 — Tester la navigation clavier

Parcourez votre site sans souris. Chaque fonctionnalité accessible à la souris doit l'être au clavier, avec un focus visible et un ordre logique.

### Étape 4 — Vérifier les contenus multimédias et PDF

Ajoutez des transcripts, des sous-titres et des descriptions audio là où c'est nécessaire. Assurez-vous que vos PDF sont structurés et lisibles par un lecteur d'écran, ou proposez une alternative HTML.

### Étape 5 — Documenter et communiquer

Publiez une déclaration d'accessibilité ou, à minima, une page « accessibilité » indiquant l'état de conformité, les points connus à améliorer et un moyen de contact pour signaler des difficultés.

---

## 5. Ressources et outils

Cette section sera complétée avec une sélection de ressources fiables :

- Référentiel RGAA officiel et documentation du design system de l'État.
- Portail européen dédié à l'EAA.
- WCAG en français et checklists pratiques.
- Outils de test automatiques et extensions navigateur.
- Associations et référents accessibilité en France.

---

## 6. Ce que couvre — et ne couvre pas — un scan automatique

Un scan automatique comme AccessiCheck est un excellent point de départ. Il détecte les problèmes techniques vérifiables par un programme : contrastes, structure HTML, présence d'attributs, doublons d'identifiants, etc.

**Cependant, un scan automatique ne couvre qu'environ 30 % à 40 % des critères RGAA.**

Les éléments suivants nécessitent obligatoirement un audit humain :

- Pertinence des textes alternatifs et des étiquettes.
- Qualité du parcours clavier et de la navigation par lecteur d'écran.
- Compréhension globale de l'interface et de la documentation.
- Accessibilité des vidéos, médias et documents PDF.
- Tests avec des utilisateurs en situation de handicap.

Ce guide et les outils associés vous aident à avancer sereinement, mais ils ne constituent pas une garantie de conformité RGAA ou EAA complète.

---

## Checklist rapide pour le dirigeant

- [ ] Je sais si mon site relève du RGAA, de l'EAA ou des deux.
- [ ] J'ai fait un premier diagnostic automatique de mon site.
- [ ] J'ai identifié et corrigé les erreurs techniques simples.
- [ ] J'ai testé la navigation au clavier sur les parcours principaux.
- [ ] J'ai vérifié l'accessibilité de mes contenus multimédias et de mes PDF.
- [ ] J'ai publié une information sur l'accessibilité de mon site.
- [ ] J'ai prévu un audit humain si mon activité est fortement exposée.

---

*Guide en cours de rédaction par Brozapi — Version TEMPORAIRE — Août 2026*
*Pour toute question : contact@brozapi.com*
