---
titre: "Accessibilité web : votre site est-il concerné ?"
auteur: Brozapi
date: 2026-08-20
version: "1.1"
langue: fr
---

**Auteur** : Brozapi  
**Date de publication** : 20 août 2026  
**Version** : 1.1  
**Public visé** : dirigeants de PME françaises, non spécialistes du numérique  
**Objectif** : comprendre en une heure si votre site est concerné par la nouvelle réglementation, ce que vous risquez, et quoi faire concrètement.

---

## Sommaire

1. **Qui est concerné par l'EAA depuis le 28 juin 2025 ?**
2. **Ce que risque concrètement une PME e-commerce de plus de 10 salariés**
3. **Les 10 erreurs d'accessibilité les plus fréquentes sur les sites de PME**
4. **Plan d'action concret sur 90 jours**
5. **Ressources et outils**
6. **Les limites de l'automatisation : ce qu'un scan ne voit pas**
7. **Conclusion**
8. **Annexe A : glossaire des termes techniques**
9. **Annexe B : checklist finale à imprimer**

---

## Introduction

Si vous dirigez une PME avec un site web ou une boutique en ligne, vous avez probablement entendu parler de l'**EAA**, du **RGAA**, ou des **WCAG** ces derniers mois. Peut-être que votre développeur vous a alerté. Peut-être qu'un client vous a demandé si votre site était « accessible ». Ou peut-être que vous avez simplement vu passer une actualité sur une nouvelle loi européenne applicable depuis le 28 juin 2025.

Ce guide a été conçu pour une personne comme vous : un dirigeant qui n'a pas le temps de devenir expert en accessibilité numérique, mais qui veut prendre les bonnes décisions pour protéger son entreprise et ne pas laisser passer un marché important.

Nous allons voir ensemble :

- si **votre entreprise est concernée** par cette nouvelle réglementation ;
- ce que vous **risquez concrètement** en cas de non-respect ;
- les **erreurs les plus fréquentes** sur les sites PME ;
- un **plan d'action sur 90 jours** que vous pourrez donner à votre équipe ou à votre prestataire ;
- les **ressources et outils** pour avancer sans vous noyer dans le jargon technique.

Une chose importante avant de commencer : ce guide ne vous promet pas une conformité « 100 % garantie » en trois clics. L'accessibilité web est un chemin, pas une case à cocher. Notre objectif est de vous donner une feuille de route réaliste et actionnable.

<div class="quick-box">
<p><strong>Pas le temps de tout lire ?</strong></p>
<p>Le scan automatique du chapitre 3 (les 10 erreurs les plus fréquentes) est désormais automatisé : AccessiCheck vérifie en 2 minutes la plupart des points qui y sont décrits — environ 30 à 40 % des critères RGAA testables. Un moyen rapide de savoir déjà si votre site a des angles morts manifestes.</p>
<p><strong>Scannez votre site en 2 minutes</strong> : diagnostic One-Shot à 29 €, rapport PDF sous 24 h ouvrées — <a href="https://accessicheck.brozapi.com/">accessicheck.brozapi.com</a></p>
<p>Ce guide reste utile : il vous sert à comprendre la réglementation, évaluer votre exposition et planifier le plan d'action. Le scan, lui, sert à diagnostiquer techniquement. Les deux sont complémentaires — le scan ne remplace pas le guide, et le guide ne remplace pas le scan.</p>
</div>

---

## 1. Qui est concerné par l'EAA depuis le 28 juin 2025 ?

### L'EAA en deux phrases

L'**European Accessibility Act** (EAA, ou Acte européen sur l'accessibilité) est une directive de l'Union européenne qui oblige certains services numériques à être accessibles aux personnes en situation de handicap. En France, elle s'applique depuis le **28 juin 2025** via la loi n° 2025-277 du 25 mars 2025.

### Ce que cela change pour vous

Avant cette date, seuls les sites publics (mairies, ministères, hôpitaux publics) étaient tenus d'être accessibles en France. Depuis le 28 juin 2025, certaines entreprises **privées** entrent dans le champ de la réglementation.

Votre entreprise est concernée si elle cumule **les trois conditions suivantes** :

1. **Vous proposez un service numérique** : site web, application mobile, ou service de commerce électronique.
2. **Vous employez plus de 10 salariés**.
3. **Votre chiffre d'affaires annuel dépasse 2 millions d'euros** OU **votre bilan total dépasse 2 millions d'euros**.

> **Exemple concret** : vous dirigez une PME e-commerce de décoration intérieure avec 12 employés et un CA de 2,5 millions d'euros. Votre site est concerné. Si vous avez 8 employés et un CA de 1,5 million d'euros, vous n'êtes pas concerné par l'obligation légale — même si rendre votre site accessible reste une bonne pratique commerciale.

### Le cas particulier du e-commerce

Les services de **commerce électronique** sont explicitement visés par l'EAA. Cela inclut :

- les boutiques en ligne (B2C et B2B) ;
- les places de marché ;
- les systèmes de réservation en ligne ;
- les services bancaires en ligne (si vous êtes dans la fintech).

Si vous vendez en ligne, même sans magasin physique, vous êtes dans la cible de cette directive dès que vous dépassez les seuils mentionnés ci-dessus.

### RGAA, WCAG : de quoi parle-t-on ?

Ces sigles reviennent constamment. Voici ce qu'ils signifient sans le jargon :

- **RGAA** (*Référentiel Général d'Amélioration de l'Accessibilité*) : c'est la grille de lecture française. Il liste les critères techniques qu'un site doit respecter pour être considéré comme accessible en France. C'est le référentiel que les auditeurs français utilisent. Sa version actuelle est la 4.1.2.
- **WCAG** (*Web Content Accessibility Guidelines*) : ce sont les recommandations internationales du W3C (l'organisme qui standardise le web). Le RGAA s'appuie sur les WCAG. En pratique, si vous respectez le RGAA, vous respectez les WCAG.
- **EAA** : c'est la loi européenne qui dit « les services numériques doivent être accessibles ». Elle n'entre pas dans les détails techniques ; elle renvoie aux standards comme les WCAG.

En résumé : **l'EAA dit ce que vous devez faire, le RGAA dit comment le vérifier en France, et les WCAG sont le standard technique mondial sous-jacent.**

### Checklist : suis-je concerné ?

| Question | Si oui |
|---|---|
| Mon entreprise a-t-elle plus de 10 salariés ? | Risque de seuil atteint |
| Notre CA ou bilan dépasse-t-il 2 M€ ? | Seuil confirmé |
| Avons-nous un site web, une app ou une boutique en ligne ? | Service numérique concerné |
| Vendons-nous des produits ou services en ligne ? | E-commerce explicitement visé |

Si vous avez coché « oui » aux quatre questions, vous devez prendre ce sujet au sérieux d'un point de vue juridique. Si vous n'avez coché que certaines cases, l'accessibilité reste un levier commercial et éthique, même sans obligation légale immédiate.

---

## 2. Ce que risque concrètement une PME e-commerce de plus de 10 salariés

### Démystifions les peurs

Vous avez peut-être lu des articles alarmistes sur des « amendes de 20 000 € » ou des « fermetures de site ». Il est important de mettre les choses au clair : **il n'existe pas en France de brigade qui envoie des amendes automatiques aux PME dont le site n'est pas accessible.** La réglementation ne fonctionne pas comme le RGPD sur les cookies, où une autorité de contrôle peut sanctionner directement.

Cependant, cela ne signifie pas qu'il n'y a aucun risque. Voici ce qui peut arriver concrètement.

### Les risques réels

**1. Une action en justice par une association ou un utilisateur**

En France, des associations reconnues comme l'APF France handicap, le Comité national pour la promotion de l'accessibilité (CNPA), ou des unions d'associations peuvent saisir le juge pour faire constater l'inaccessibilité d'un service numérique. Un particulier en situation de handicap peut également agir en justice s'il subit une discrimination d'accès.

Ce qui est visé : l'absence d'accès à un service. Le juge peut ordonner la mise en conformité dans un délai donné.

**2. Une injonction de faire sous délai**

Si une action aboutit, le juge peut vous enjoindre de rendre votre site accessible dans les six mois ou un an. Cela signifie que vous devrez investir dans une refonte ou une mise à jour rapide, souvent dans l'urgence et donc à un coût plus élevé que si vous aviez planifié le travail sereinement.

**3. Des dommages et intérêts**

Dans certains cas, une personne qui a subi un préjudice réel (impossibilité de passer commande, de consulter un tarif, de réserver un service) peut obtenir une indemnisation. Les montants varient selon les cas, mais le coût cumulé (défense juridique + indemnisation + coût de la mise en conformité) peut devenir significatif pour une PME.

**4. L'atteinte à la réputation**

Dans l'ère des réseaux sociaux, une association qui dénonce publiquement l'inaccessibilité d'un site peut générer une mauvaise publicité rapide. Pour une marque B2C, cela peut toucher l'image de marque, surtout si l'entreprise se positionne sur des valeurs d'inclusion ou de responsabilité sociale.

**5. La perte de marché : le risque économique le plus sous-estimé**

Voici un chiffre simple : environ **15 millions de personnes en France** ont un handicap, temporaire ou permanent. Cela représente plus de 20 % de la population. Parmi elles, plusieurs millions utilisent des outils spécifiques pour naviguer sur internet : lecteurs d'écran, claviers adaptés, dispositifs de grossissement, etc.

Si votre boutique en ligne n'est pas accessible, une partie de ces personnes ne peut pas acheter chez vous. Ce n'est pas une question de morale ou de réglementation : **c'est un panier de marché que vous laissez à vos concurrents.**

### Ce qu'il ne faut pas craindre

- Une amende automatique le 29 juin 2025.
- Une fermeture de site par l'État.
- Une obligation de tout refaire du jour au lendemain.

La réglementation pousse à la mise en conformité progressive. Ce qui compte, c'est de montrer que vous avez un plan et que vous avancez.

---

## 3. Les 10 erreurs d'accessibilité les plus fréquentes sur les sites de PME

Vous n'avez pas besoin d'être développeur pour repérer certains problèmes. Voici les dix défauts les plus courants, avec pour chacun une méthode simple pour les identifier.

### 1. Images sans texte alternatif

**Le problème** : les personnes aveugles ou malvoyantes utilisent des lecteurs d'écran qui lisent le contenu textuel à voix haute. Si une image n'a pas de texte descriptif (appelé « attribut alt »), le lecteur ne sait pas quoi dire.

**Comment vérifier en 30 secondes** : désactivez les images dans votre navigateur (ou utilisez un outil comme AccessiCheck). Si vous voyez des cases vides ou des noms de fichiers du type « IMG_4521.jpg » à la place d'une description, c'est que le texte alternatif manque.

**Ce qu'il faut demander à votre développeur** : ajouter un texte descriptif sur chaque image porteuse d'information. Les images décoratives doivent être signalées comme telles pour être ignorées par les lecteurs d'écran.

### 2. Contraste de couleurs insuffisant

**Le problème** : un texte gris clair sur fond blanc peut être lu par un jeune développeur sur un écran performant, mais une personne malvoyante ou une personne âgée ne pourra pas le déchiffrer.

**Comment vérifier** : utilisez l'outil de contraste intégré aux outils de développement de votre navigateur (F12 → onglet Accessibilité), ou un outil en ligne comme le contrast checker du WebAIM.

**La règle** : le rapport de contraste entre le texte et son fond doit être d'au moins 4,5:1 pour du texte normal, et 3:1 pour du texte de grande taille.

### 3. Navigation impossible au clavier

**Le problème** : certaines personnes ne peuvent pas utiliser de souris (tremblements, paralysie, blessure temporaire, préférence utilisateur). Elles naviguent avec la touche Tabulation et Entrée. Si votre menu ou votre bouton « Ajouter au panier » n'est pas accessible au clavier, elles sont bloquées.

**Comment vérifier** : mettez votre souris de côté et essayez de passer une commande sur votre site uniquement avec la touche Tabulation et la touche Entrée. Si vous êtes bloqué avant le paiement, il y a un problème.

### 4. Formulaires mal étiquetés

**Le problème** : un formulaire de contact ou de commande où les champs (nom, email, adresse) n'ont pas d'étiquette clairement associée est un cauchemar pour les lecteurs d'écran. Le logiciel ne sait pas quel champ est actif.

**Comment vérifier** : cliquez sur le texte devant un champ (par exemple « Email »). Si le champ se met en surbrillance, l'étiquette est bien associée. Si rien ne se passe, c'est probablement mal fait.

### 5. Vidéos sans sous-titres ni transcription

**Le problème** : une personne sourde ou malentendante ne peut pas comprendre le contenu d'une vidéo de présentation de produit ou d'un tutoriel sans sous-titres.

**Comment vérifier** : regardez vos vidéos publiques. Y a-t-il des sous-titres synchronisés ? Une transcription textuelle est-elle disponible à proximité ?

### 6. Structure de titres incohérente

**Le problème** : les titres (Titre 1, Titre 2, Titre 3, etc.) servent de plan de navigation pour les lecteurs d'écran. Si votre page saute du Titre 1 au Titre 3 sans Titre 2, ou utilise des titres juste pour mettre du texte en gras, la structure logique est cassée.

**Comment vérifier** : utilisez l'extension de navigateur « HeadingsMap » ou affichez le plan de document dans les outils de développement.

### 7. Langue de la page non déclarée

**Le problème** : si votre site est en français mais que le code ne l'indique pas, le lecteur d'écran tente de le prononcer avec une voix anglaise, rendant le contenu incompréhensible.

**Comment vérifier** : demandez à votre développeur de vérifier la balise `<html lang="fr">` dans le code source.

### 8. Liens peu explicites

**Le problème** : un lien « Cliquez ici » ou « En savoir plus » ne dit pas où il mène. Un utilisateur de lecteur d'écran qui fait défiler la liste des liens entend « cliquez ici, cliquez ici, en savoir plus » sans contexte.

**Comment vérifier** : parcourez votre site en regardant uniquement les textes des liens. Comprennent-ils leur destination sans le contexte visuel ?

### 9. Messages d'erreur incompréhensibles

**Le problème** : lorsqu'un utilisateur se trompe dans un formulaire, un message « Erreur 404 » ou « Champ invalide » sans explication ne l'aide pas à corriger sa saisie.

**Comment vérifier** : faites exprès de mal remplir votre formulaire de contact. Le message d'erreur vous dit-il précisément quoi corriger ?

### 10. Contenu qui clignote ou se déplace automatiquement

**Le problème** : des bannières défilantes, des carrousels qui tournent tout seuls, ou des effets de clignotement peuvent déclencher des crises d'épilepsie chez les personnes photosensibles, ou rendre la lecture impossible pour des personnes avec des troubles de l'attention.

**Comment vérifier** : votre site a-t-il des éléments qui bougent sans action de l'utilisateur ? L'utilisateur peut-il les mettre en pause ?

---

## 4. Plan d'action concret sur 90 jours

Vous n'avez pas besoin de tout refaire en une semaine. Voici un plan réaliste pour une PME qui n'a pas de développeur dédié à plein temps sur le sujet.

### Semaines 1 à 2 : Mesurer la situation actuelle

**Actions à réaliser** :

- [ ] Faites un scan automatique de votre site avec un outil en ligne (voir chapitre 5). Cela prend 5 minutes et donne une première photographie.
- [ ] Testez la navigation au clavier sur les trois parcours les plus importants : accueil → fiche produit → panier → paiement ; accueil → formulaire de contact ; accueil → recherche.
- [ ] Demandez à un collaborateur de vérifier le contraste des textes principaux (titres, descriptions, boutons) avec un outil gratuit.
- [ ] Listez les vidéos et PDF présents sur votre site. Sont-ils accessibles ?
- [ ] Établissez un document simple avec le score ou le nombre d'erreurs détectées. Ce sera votre ligne de départ.

**Livrable** : un tableau avec les erreurs trouvées, classées par fréquence et par impact utilisateur.

### Semaines 3 à 4 : Corriger les « quick wins »

Certaines corrections sont rapides et ont un fort impact.

**Actions prioritaires** :

- [ ] Ajouter ou corriger les textes alternatifs sur les images principales (logo, bannières, photos de produits).
- [ ] Corriger les étiquettes des formulaires de contact et de commande.
- [ ] Améliorer le contraste des boutons d'appel à l'action (« Acheter », « Ajouter au panier », « Nous contacter »).
- [ ] Corriger la structure des titres sur les pages les plus visitées (accueil, produit, panier).
- [ ] Remplacer les liens « Cliquez ici » par des libellés explicites.
- [ ] Déclarer correctement la langue du site dans le code.

**Budget indicatif** : si vous avez un développeur en interne ou un prestataire régulier, ce travail représente généralement entre une demi-journée et deux journées de développement.

### Semaines 5 à 8 : Structurer le parcours critique

**Actions** :

- [ ] Assurez-vous que le parcours de commande complet est utilisable au clavier, du panier à la confirmation de paiement.
- [ ] Ajoutez des sous-titres à vos vidéos de présentation (vous pouvez utiliser les outils de génération automatique de votre hébergeur vidéo, puis relire pour corriger).
- [ ] Créez une page « Accessibilité » sur votre site qui indique votre engagement, le niveau de conformité visé, et un moyen de contacter votre équipe en cas de difficulté.
- [ ] Testez vos correctifs avec un outil de scan automatique pour mesurer la progression.

### Semaines 9 à 12 : Consolider et planifier la suite

**Actions** :

- [ ] Faites relire votre site par une personne utilisant un lecteur d'écran, ou par une association locale de personnes handicapées (certaines proposent des tests utilisateurs à des tarifs raisonnables).
- [ ] Rédigez une déclaration d'accessibilité conforme au RGAA (modèle disponible sur le site de la Dinum).
- [ ] Intégrez l'accessibilité dans votre processus de création de contenu : chaque nouvelle image doit avoir un texte alternatif, chaque nouvelle vidéo une transcription, etc.
- [ ] Prévoyez une revue semestrielle dans votre calendrier d'entreprise.

### Tableau récapitulatif des actions vérifiables

| Échéance | Action | Comment vérifier que c'est fait |
|---|---|---|
| J+14 | Scan initial réalisé | Rapport d'erreur enregistré |
| J+14 | Test clavier effectué | Commande test passée sans souris |
| J+30 | Images alternatives corrigées | Validation via outil de scan |
| J+30 | Contraste des boutons vérifié | Ratio > 4,5:1 confirmé |
| J+30 | Formulaires étiquetés | Test clic sur le label = focus sur le champ |
| J+60 | Parcours commande au clavier opérationnel | Test réussi sur navigateur Chrome |
| J+60 | Sous-titres ajoutés aux vidéos principales | Lecture avec sons coupés, compréhension correcte |
| J+60 | Page accessibilité publiée | URL accessible et informations à jour |
| J+90 | Déclaration d'accessibilité rédigée | Présence sur le site, conforme au modèle officiel |
| J+90 | Test utilisateur réalisé | Compte-rendu de session archivé |

---

## 5. Ressources et outils

Voici une sélection de ressources fiables et gratuites pour approfondir et avancer sereinement.

### Référentiels officiels

1. **Loi n° 2025-277 du 25 mars 2025** (France) — transposition de l'EAA en droit français. Disponible sur [Légifrance](https://www.legifrance.gouv.fr/).
2. **Directive (UE) 2019/882** (European Accessibility Act) — texte officiel sur [EUR-Lex](https://eur-lex.europa.eu/eli/dir/2019/882/oj).
3. **RGAA 4.1.2** — Référentiel Général d'Amélioration de l'Accessibilité, publié par la Direction interministérielle du numérique (Dinum). Consulter [la version officielle](https://accessibilite.numerique.gouv.fr/).
4. **WCAG 2.1 (et 2.2)** — Web Content Accessibility Guidelines, publiées par le W3C. Traductions en français disponibles via [W3C WAI](https://www.w3.org/WAI/standards-guidelines/wcag/).
5. **Modèle de déclaration d'accessibilité** — fourni par la Dinum sur [le site officiel du RGAA](https://accessibilite.numerique.gouv.fr/obligations/).

### Guides et méthodologies

6. **AcceDe Web** — collections de recommandations et de bonnes pratiques pour intégrer l'accessibilité dans le développement web. Très pratique pour les équipes techniques. Voir [AcceDe Web](https://www.accede-web.com/).
7. **Atalan** — outils et formations en français, avec une approche pédagogique adaptée aux équipes projet. Voir [Atalan](https://atalan.fr/).
8. **Orange Digital Accessibility** — guidelines et outils open source développés par Orange, particulièrement utiles pour les tests sur mobile. Voir [la ressource d'Orange](https://a11y-guidelines.orange.com/).
9. **Access42 / ARPD** — ressources et articles sur l'accessibilité numérique en contexte francophone. Voir [Access42](https://access-42.com/).

### Outils de test

10. **AccessiCheck** — [accessicheck.brozapi.com](https://accessicheck.brozapi.com/) — outil de scan rapide permettant d'identifier les erreurs d'accessibilité les plus courantes sur un site web. C'est un excellent point de départ pour obtenir une photographie instantanée de l'état de votre site et prioriser vos corrections.
11. **WAVE** (WebAIM) — extension de navigateur qui surligne visuellement les erreurs et alertes d'accessibilité directement sur la page. Voir [WAVE](https://wave.webaim.org/).
12. **axe DevTools** — extension de navigateur basée sur la bibliothèque axe-core, très utilisée par les développeurs. Voir [axe](https://www.deque.com/axe/).
13. **Lighthouse** (intégré à Chrome) — outil de Google qui inclut un audit d'accessibilité avec un score et des recommandations. Voir [Lighthouse](https://developer.chrome.com/docs/lighthouse/overview/).

### Formations et sensibilisation

14. **MOOC Accessibilité numérique** (France Université Numérique / divers organismes) — formations en ligne gratuites pour monter en compétence progressivement. Voir [le catalogue](https://www.fun-mooc.fr/).
15. **W3C WAI** (Web Accessibility Initiative) — ressources pédagogiques et tutoriels, disponibles en plusieurs langues. Voir [W3C WAI](https://www.w3.org/WAI/).

---

## 6. Les limites de l'automatisation : ce qu'un scan ne voit pas

C'est un point d'honnêteté important. Les outils de scan automatique, y compris AccessiCheck, sont très utiles pour un premier diagnostic, mais **ils ne couvrent qu'environ 30 % à 40 % des critères du RGAA.**

### Ce qu'un outil automatique peut détecter

- Absence de textes alternatifs sur les images
- Contraste insuffisant
- Structure de titres incorrecte
- Langue non déclarée
- Formulaires sans étiquette
- Liens vides ou dupliqués

### Ce qu'un outil automatique ne peut PAS juger

- **La qualité du texte alternatif** : l'outil vérifie qu'il existe, mais pas qu'il est pertinent. Une image de produit avec le texte « image1 » passe le test technique mais reste inutile pour l'utilisateur.
- **La compréhension du parcours utilisateur** : un outil ne sait pas si votre processus de commande est logique ou si vos messages d'erreur sont compréhensibles.
- **L'adaptation aux lecteurs d'écran** : il peut détecter qu'un élément est masqué, mais pas que l'ordre de lecture est chaotique.
- **L'accessibilité des contenus rédactionnels** : la complexité du langage, la longueur des phrases, la clarté des instructions ne sont pas évaluables par un algorithme.
- **L'expérience réelle** : seul un test avec des utilisateurs en situation de handicap permet de juger si votre site est réellement utilisable.

### Quand faire appel à un expert ?

Si votre scan automatique révèle beaucoup d'erreurs, ou si vous ne savez pas comment interpréter les résultats, il est pertinent de consulter un **auditeur en accessibilité numérique certifié** (opération possible via la plateforme Opquast, ou via des cabinets spécialisés). Un audit complet conforme au RGAA coûte généralement entre 2 000 et 8 000 euros selon la taille du site, mais il vous donne un rapport détaillé et actionnable.

**Ne vous laissez pas vendre de la conformité « 100 % garantie » par un prestataire qui se base uniquement sur un scan automatique.** La conformité réelle demande un travail humain de vérification et de test.

---

## Conclusion

L'accessibilité web n'est pas une contrainte technique réservée aux grandes entreprises. Pour une PME e-commerce, c'est d'abord une **opportunité commerciale** : rendre votre site utilisable par 15 millions de personnes supplémentaires en France, c'est du chiffre d'affaires potentiel.

C'est aussi une **protection juridique** : montrer que vous avez un plan, que vous avancez, et que vous prenez le sujet au sérieux réduit considérablement vos risques en cas de contrôle ou de recours.

Enfin, c'est souvent un **gain de qualité générale** : un site bien structuré, avec des contrastes lisibles, des formulaires clairs et une navigation au clavier fluide, est un site plus agréable pour *tous* vos clients, y compris ceux qui n'ont aucun handicap.

Vous n'avez pas besoin d'être parfait demain. Vous avez besoin de commencer aujourd'hui.

**Prochaine étape suggérée** : faites un scan de votre site avec AccessiCheck ou un outil équivalent dès cette semaine. Identifiez trois corrections rapides. Donnez-les à votre développeur ou votre prestataire. Vous aurez déjà fait 50 % du chemin.

---

## Annexe A : Glossaire des termes techniques

| Terme | Explication simple |
|---|---|
| **Attribut alt** | Texte descriptif associé à une image, lu par les lecteurs d'écran. |
| **Clavier** | Mode de navigation sans souris, essentiel pour de nombreux utilisateurs handicapés. |
| **Contraste** | Différence de luminosité entre un texte et son fond. Un contraste faible rend la lecture difficile. |
| **Déclaration d'accessibilité** | Document officiel publié sur un site qui indique son niveau de conformité au RGAA. |
| **EAA** | European Accessibility Act : loi européenne sur l'accessibilité des produits et services numériques. |
| **Lecteur d'écran** | Logiciel qui lit à voix haute le contenu affiché à l'écran, utilisé par les personnes aveugles ou malvoyantes. |
| **RGAA** | Référentiel Général d'Amélioration de l'Accessibilité : la grille d'évaluation française. |
| **WCAG** | Web Content Accessibility Guidelines : les recommandations internationales du W3C. |

## Annexe B : Checklist finale à imprimer

- [ ] Mon entreprise a-t-elle plus de 10 salariés et un CA > 2 M€ ? (Si oui, obligation légale)
- [ ] J'ai réalisé un scan automatique de mon site.
- [ ] J'ai testé la navigation au clavier sur le parcours de commande.
- [ ] Toutes les images importantes ont un texte alternatif.
- [ ] Les boutons et liens principaux ont un contraste suffisant.
- [ ] Les formulaires ont des étiquettes claires.
- [ ] Les titres de page suivent une structure logique.
- [ ] Mes vidéos principales ont des sous-titres.
- [ ] J'ai publié une page Accessibilité sur mon site.
- [ ] J'ai prévu une revue semestrielle.

---

## Passez à l'action

<div class="cta-box">
<p><strong>Scannez votre site en 2 minutes</strong></p>
<p>Obtenez un diagnostic clair des erreurs d'accessibilité techniquement testables sur votre page d'accueil, avec les actions à prioriser. Démarquez-vous avec un rapport PDF reçu par email sous 24 h ouvrées.</p>
<p><a href="https://accessicheck.brozapi.com/">Scannez votre site dès maintenant — 29 € (One-Shot)</a></p>
<p>Un audit humain complet RGAA reste nécessaire pour une conformité garantie ; le scan vous en donne la photographie honnête, sans fausse promesse.</p>
</div>

---

*Ce guide est publié par Brozapi dans le cadre du projet AccessiCheck. Il a pour vocation d'informer et d'accompagner les dirigeants de PME dans leur démarche d'accessibilité numérique. Les informations juridiques reflètent la réglementation en vigueur au moment de la publication ; nous vous invitons à consulter un conseiller juridique pour des situations spécifiques.*