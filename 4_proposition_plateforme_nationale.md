# Proposition d'une Plateforme Nationale de Traçabilité des Excursions et Activités Touristiques

**Document de travail — Force de proposition des agences de voyages du Sud-Est**
**Destinataires : FTAV · ONTT · Ministère du Tourisme · Ministère des Finances · Banque Centrale de Tunisie**

---

## 1. Résumé exécutif

Le secteur des excursions et de l'animation touristique en Tunisie souffre d'une économie parallèle massive : une grande partie des ventes se fait **en espèces, souvent en devises, sans facture, sans déclaration fiscale et hors du circuit bancaire**. Cette situation prive l'État de recettes fiscales, alimente le marché noir de la devise, échappe au contrôle des changes (loi n° 76-18 de 1976) et fragilise les agences de voyages agréées qui, elles, respectent leurs obligations.

La réponse n'est ni la fixation collective des prix (interdite par l'article 5 de la loi n° 2015-36), ni l'interdiction des plateformes numériques. La réponse est **la traçabilité obligatoire de toute vente d'excursion**, au moyen d'une **plateforme nationale unique** placée sous le contrôle du Ministère des Finances et de l'ONTT.

Le principe directeur est simple : **on ne contrôle pas l'argent (invisible), on contrôle le mouvement du touriste (physique).** Comme aucune excursion ne peut avoir lieu sans transporter des personnes vers un lieu, le contrôle physique du déplacement rend la déclaration inévitable.

---

## 2. Diagnostic — le vrai problème

### 2.1 Les symptômes
- Ventes d'excursions en espèces dans les hôtels par des intermédiaires non agréés (« bezness »).
- Encaissements en devises non déclarés, qui repartent vers le marché noir au lieu d'entrer à la Banque Centrale.
- Vente d'excursions par des acteurs non autorisés : clubs de quads, ranchs, sociétés de location de voitures — activité pourtant réservée aux agences de voyages (décret-loi n° 73-13 de 1973).
- Hôtels (entités d'hébergement au sens du décret n° 2007-457) qui ouvrent leurs espaces à ces intrus et en tirent des revenus non déclarés.

### 2.2 Les causes racines
- **Absence de point de contrôle unique** : chaque vente est un acte isolé, invisible.
- **Le cash ne laisse aucune trace** : impossible à contrôler au niveau du paiement.
- **Aucune conséquence** pour l'opérateur non déclaré : le risque est nul, le gain immédiat.

### 2.3 Le coût pour la Nation
- Perte de recettes fiscales (TVA, impôt sur les bénéfices).
- Fuite de devises hors du circuit officiel — alors que le pays en a un besoin vital.
- Concurrence déloyale envers les agences en règle.
- Dégradation de la qualité et de la sécurité (excursions non assurées, non encadrées).

---

## 3. Le principe directeur

> **On ne force personne à déclarer son argent. On rend impossible de déplacer un touriste sans passer par le système.**

Une excursion est un acte **physique** : un déplacement de personnes, par un véhicule, vers un site, à une date donnée. Ces éléments sont **visibles et contrôlables** — sur la route, à l'entrée des sites, par l'assurance. C'est sur ce caractère physique que repose tout le dispositif.

La plateforme n'est donc pas un simple outil de réservation : c'est un **système de contrôle adossé à des points de passage obligés**.

---

## 4. Architecture fonctionnelle de la plateforme

### 4.1 Ce qu'est la plateforme
Un système national unique, accessible par application mobile et web, multilingue, qui :
- Enregistre chaque excursion vendue, quel qu'en soit le canal de vente.
- Génère pour chaque excursion un **ordre de mission électronique** doté d'un **QR code** unique.
- Transmet les données en temps réel aux administrations de contrôle (Finances, ONTT, Banque Centrale).
- Produit automatiquement la facture et les justificatifs fiscaux.

### 4.2 Qui doit s'inscrire
- Toutes les agences de voyages agréées (catégories A et B).
- Tous les prestataires d'animation touristique disposant d'un cahier des charges (quads, dawab/équestre, calèches, etc.), **dans le respect de leur propre cahier des charges**.
- Par intégration (API), les plateformes internationales (GetYourGuide, Viator, Civitatis) qui déversent leurs réservations dans le système.

### 4.3 Contenu obligatoire de l'ordre de mission
Chaque ordre de mission généré doit contenir, au minimum :

| Champ | Détail |
|-------|--------|
| N° d'ordre de mission | Identifiant unique + QR code |
| Agence / prestataire | Nom, n° de licence/agrément |
| Date et horaire | Départ et retour prévus |
| Excursion | Nature et itinéraire (ex. : circuit désert Ksar Ghilane) |
| Nombre de personnes | Adultes / enfants |
| Identité du groupe | Hôtel de provenance, référence de séjour |
| Tarif de vente | Montant unitaire et total |
| Devise encaissée | Devise + montant + mode de paiement |
| Véhicule et chauffeur | Immatriculation, nom du chauffeur/guide |
| Assurance | Référence de la police couvrant l'excursion |

### 4.4 La preuve de passage
Pour chaque excursion, la plateforme délivre :
- soit un **document justificatif à tamponner** (papier), attestant que l'opération est passée par le système ;
- soit — de préférence — un **QR code** scannable, infalsifiable, vérifiable en temps réel par tout agent de contrôle.

---

## 4-bis. Le cycle de vie complet d'une excursion — étape par étape

C'est le déroulé opérationnel, du premier contact client jusqu'à la sanction éventuelle. Rien n'est laissé au hasard.

### Étape 1 — Réservation client
Le client réserve une excursion par l'un des canaux autorisés :
- directement auprès d'une **agence de voyages agréée** (comptoir ou site web) ;
- via la **réception de l'hôtel**, mais obligatoirement pour le compte d'une agence agréée partenaire (l'hôtel ne vend pas, il oriente) ;
- via une **plateforme internationale** (GetYourGuide, Viator, Civitatis) reliée au système.

Données recueillies dès la réservation : identité et nombre de participants (adultes/enfants), hôtel de séjour, excursion souhaitée, date, tarif convenu, devise et mode de paiement.

### Étape 2 — Insertion sur la plateforme
L'agence saisit la réservation sur la plateforme (application mobile ou web) — ou la plateforme internationale la transmet automatiquement via **API**.
- Chaque acteur doit être **pré-enregistré** dans le système : agence (n° de licence), véhicule (immatriculation), chauffeur/guide (habilitation), police d'assurance.
- La saisie crée un **dossier d'excursion** reprenant tous les champs de l'ordre de mission (voir §4.3).
- Aucune excursion ne peut exister dans le circuit légal sans cette insertion préalable.

### Étape 3 — Validation par la plateforme
La plateforme effectue des **contrôles automatiques** avant d'autoriser :
- L'agence est-elle agréée et à jour ? Le prestataire est-il autorisé pour cette activité (cahier des charges) ?
- Le véhicule est-il enregistré, en règle et assuré ? Le chauffeur/guide est-il habilité ?
- L'assurance couvre-t-elle la date et le type d'excursion ? Les données sont-elles cohérentes ?

Résultat :
- **Si conforme** → génération d'un **ordre de mission avec QR code signé** (cryptographiquement, donc infalsifiable) + facture automatique + justificatif à tamponner. La devise est enregistrée pour la Banque Centrale.
- **Si non conforme** → **rejet motivé** (ex. : prestataire non agréé, assurance expirée, véhicule non enregistré). Sans validation, aucun ordre de mission n'est émis — l'excursion est, de fait, hors-la-loi si elle a lieu.

### Étape 4 — Contrôle et moyens de contrôle
L'ordre de mission est vérifié aux **points de passage obligés** (les quatre verrous, §5) :

- **Sur la route** — la Garde Nationale, la police de la route et la douane scannent le QR à leurs points de contrôle. Vérification en temps réel : le nombre de personnes à bord correspond-il au déclaré ? L'itinéraire et le véhicule sont-ils conformes ?
- **À l'entrée des sites** — le gardien du site (archéologique, musée, parc) scanne le QR ; sans référence valide, le groupe n'entre pas.
- **Application de contrôle dédiée** pour les agents, fonctionnant **en ligne et hors ligne** (le QR est signé, donc vérifiable même sans réseau).
- **Recoupement fiscal** — le Ministère des Finances croise les ordres de mission (nombre, tarif, devise) avec les déclarations fiscales de l'agence. Toute divergence est détectée.
- **Contrôle devise** — la Banque Centrale reçoit les montants encaissés en devises et suit leur rapatriement.
- **Contrôles inopinés dans les hôtels** — vérification qu'aucune vente non enregistrée n'a lieu dans l'enceinte.

### Étape 5 — Sanctions
Les sanctions sont **graduées** selon l'acteur et la gravité :

| Infraction | Sanction |
|------------|----------|
| Transport de touristes sans QR valide | Amende + **immobilisation du véhicule** |
| Vente d'excursions par un acteur non agréé (bezness, quad, ranch, location de voitures) | Poursuite pour **exercice illégal** (décret-loi 73-13), amende de 5 000 à 10 000 DT, fermeture |
| Sous-déclaration (nombre de personnes ou tarif minoré) | **Redressement fiscal** + amende |
| Devise encaissée non déclarée | Sanctions du **code des changes** (loi 76-18) |
| Hôtel hébergeant une vente illégale dans son enceinte | Sanction fiscale + impact sur le **classement** (décret 2007-457) |
| Récidive | **Retrait de l'agrément / de la licence** |

Le principe : plus le risque et le coût de la fraude augmentent, plus le circuit déclaré devient le seul choix rationnel.

---

## 5. Les quatre verrous d'application (le cœur du dispositif)

C'est ce qui distingue une vraie solution d'un gadget. Chacun de ces verrous est un point de passage obligé où l'absence d'enregistrement bloque physiquement l'excursion.

### 🔒 Verrou 1 — Contrôle du transport
Tout véhicule transportant des touristes en excursion doit détenir un ordre de mission valide avec QR code.
- **Contrôleurs** : Garde Nationale, police de la route, douane, aux points de contrôle existants.
- **Sanction** : pas de QR valide = transport illégal de touristes = amende + immobilisation du véhicule.
- **Efficacité** : les routes du Sud (vers le désert, les oasis, les sites) sont en nombre limité — le contrôle y est réaliste.

### 🔒 Verrou 2 — Contrôle à l'entrée des sites
Les sites archéologiques, musées, parcs nationaux et lieux touristiques ne délivrent l'accès d'un groupe que contre une référence de réservation de la plateforme.
- **La porte du site devient le point de contrôle.**
- Un groupe sans référence valide n'entre pas.
- Bénéfice secondaire : maîtrise des flux, protection des sites contre la surfréquentation et la dégradation.

### 🔒 Verrou 3 — Conditionnement de l'assurance
Pas d'ordre de mission valide = pas de couverture d'assurance.
- Les assureurs ne couvrent que les excursions enregistrées.
- En cas d'accident (fréquent en quad et en désert), l'opérateur non déclaré est personnellement et pénalement responsable de tout dommage.
- Le risque devient dissuasif de lui-même.

### 🔒 Verrou 4 — Responsabilité de l'hôtel
Si une vente non enregistrée est constatée dans l'enceinte d'un hôtel, l'établissement est co-responsable.
- Conséquences fiscales et sur le classement de l'hôtel (décret n° 2007-457).
- Résultat : les hôtels ferment eux-mêmes la porte aux intrus, par intérêt propre.
- Rappel : l'hôtel est une entité d'hébergement ; il n'a pas vocation à héberger la vente d'excursions, réservée aux agences.

---

## 6. Les incitations (la carotte)

Un système purement répressif se contourne. Il faut rendre le passage par la plateforme **plus avantageux** que la fraude :

- **Facturation et TVA automatiques** : moins de paperasse pour l'agence.
- **Fiscalité simplifiée ou taux préférentiel** sur les opérations déclarées.
- **Régularité au regard du code des changes** : la devise déclarée est légitime, l'opérateur n'a plus à craindre le contrôle.
- **Label « agence/prestataire vérifié »** visible par le touriste : la confiance génère des ventes.
- **Accès facilité au marché** : intégration aux plateformes internationales pour les petites agences.

Objectif : que le circuit déclaré soit **plus simple, plus sûr et moins coûteux** que le circuit informel.

---

## 7. Gouvernance et parties prenantes

| Institution | Rôle | Intérêt à agir |
|-------------|------|----------------|
| **Ministère des Finances** | Contrôle fiscal, agents de vérification, exploitation des données | Recettes fiscales nouvelles |
| **Banque Centrale (BCT)** | Suivi des devises, rapatriement | Devises dans le circuit officiel |
| **ONTT / Ministère du Tourisme** | Tutelle sectorielle, cahiers des charges, agrément des acteurs | Assainissement et qualité du secteur |
| **Ministère de l'Intérieur (Garde Nationale)** | Contrôle sur route et aux sites | Lutte contre l'exercice illégal |
| **Gestionnaires des sites** | Contrôle à l'entrée | Maîtrise des flux, protection du patrimoine |
| **FTAV / agences** | Adoption, remontée terrain | Concurrence loyale, survie de la profession |
| **Assureurs** | Conditionnement des polices | Réduction du risque non couvert |

Un **comité de pilotage interministériel** (Finances + Tourisme + Intérieur + BCT) devrait porter le projet, car aucune administration seule ne détient tous les leviers.

---

## 8. Intégration des plateformes internationales

Point essentiel et contre-intuitif : **les plateformes comme GetYourGuide ne sont pas l'ennemi de la traçabilité — elles en sont le modèle.** Chaque réservation y est déjà :
- tracée et horodatée,
- facturée,
- bancarisée (paiement via le système bancaire, devises entrant officiellement).

Techniquement, ces plateformes peuvent **déverser leurs réservations dans la plateforme nationale via une API**. Elles deviennent alors des **alliées de la traçabilité**, et non une menace. Ceux qui refusent la plateforme ne refusent pas « la technologie » : ils refusent d'être tracés.

---

## 9. Cadre juridique à mobiliser ou à créer

### 9.1 Textes existants sur lesquels s'appuyer
- **Décret-loi n° 73-13 de 1973** : vente d'excursions réservée aux agences de voyages agréées.
- **Décret n° 2007-457 de 2007** : les hôtels sont des établissements d'hébergement.
- **Loi n° 76-18 de 1976 (code des changes)** : obligation de déclaration des devises.
- **Cahiers des charges** de l'animation touristique (quads, dawab, etc.) approuvés par arrêtés du Ministre du Tourisme.
- Législation fiscale (obligation de facturation, TVA).

### 9.2 Texte(s) nouveau(x) à prévoir
- Un **arrêté ou décret** rendant l'enregistrement sur la plateforme **obligatoire** pour toute vente d'excursion et tout transport de touristes en excursion.
- Les **sanctions** associées (amende, immobilisation, retrait d'agrément, responsabilité de l'hôtel).
- Le **cadre de partage des données** entre administrations, dans le respect de la protection des données personnelles.

---

## 10. Phases de déploiement

### Phase 0 — Cadrage (2-3 mois)
Comité de pilotage interministériel, cahier des charges technique, choix du modèle de gouvernance et de financement.

### Phase 1 — Pilote régional : Djerba–Zarzis (6 mois)
- Zone à forte densité d'excursions et de dérives — donc terrain d'épreuve idéal.
- Intégration des agences volontaires, formation, tests des QR et des contrôles.
- Points de contrôle : routes vers le désert + entrées des sites majeurs.
- Évaluation chiffrée : taux d'enregistrement, recettes, devises captées.

### Phase 2 — Généralisation nationale (12 mois)
- Extension aux autres régions.
- Intégration des plateformes internationales via API.
- Contrôle systématique.

### Phase 3 — Optimisation continue
- Tableau de bord national, indicateurs, ajustements réglementaires.

---

## 11. Indicateurs de succès (KPI)

- Nombre d'excursions enregistrées / estimation du total réel.
- Recettes fiscales additionnelles générées.
- Volume de devises entré dans le circuit officiel.
- Nombre de contrôles positifs / infractions relevées.
- Part des ventes passant par le circuit déclaré (objectif : croissance continue).
- Taux d'adhésion des agences et prestataires.

---

## 12. Risques et parades

| Risque | Parade |
|--------|--------|
| Faible volonté d'application des contrôles | Portage interministériel + intérêt direct des Finances et de la BCT |
| Résistance des acteurs informels | Combinaison verrous physiques + incitations (carotte/bâton) |
| Contournement technologique (faux QR) | QR signés/serveur, vérification en ligne temps réel |
| Lourdeur administrative | Génération automatique des documents, application mobile simple |
| Atteinte aux données personnelles | Cadre légal de protection, accès restreint aux agents habilités |
| Accusation de « barrière » à l'activité | La plateforme est ouverte à tous les acteurs légaux, à conditions égales |

---

## 13. Bénéfices attendus, par partie prenante

- **État** : recettes fiscales nouvelles, lutte contre l'économie parallèle.
- **Banque Centrale** : rapatriement des devises, sortie du marché noir.
- **Agences en règle** : concurrence loyale, fin du dumping des non-déclarés.
- **Petites agences** : accès au marché numérique, visibilité.
- **Touristes** : sécurité, assurance, qualité, transparence des prix.
- **Patrimoine** : maîtrise des flux, protection des sites.
- **Image du pays** : destination moderne, transparente et sûre.

---

## 14. Conclusion

Le débat sur les prix est un faux débat — et un débat dangereux, car toute entente sur les prix est prohibée par la loi n° 2015-36. Le vrai combat, celui qui unit l'intérêt des agences et celui de la Nation, est **la traçabilité intégrale des ventes**.

Une plateforme nationale, adossée à des points de contrôle physiques (transport, sites, assurance, responsabilité des hôtels) et au contrôle du Ministère des Finances et de la Banque Centrale, est la **seule solution** capable de mettre fin à l'économie en espèces, de stopper la fuite des devises et de ramener un maximum de recettes au pays — rapidement.

Nous, agences de voyages agréées, sommes prêts à être **force de proposition et partenaires actifs** de ce chantier.

---

*Document de travail — à compléter avec les références exactes des cahiers des charges (arrêtés et JORT) et les données chiffrées régionales.*
