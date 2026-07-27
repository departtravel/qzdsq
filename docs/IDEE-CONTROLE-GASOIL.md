# ⛽ Contrôle Gasoil — l'idée de l'application

> Document de conception : l'idée et les besoins de l'application, tels que
> décrits par le chef d'entreprise pour piloter et contrôler son parc roulant.

## 🎯 Le besoin de départ

Je veux une application pour **contrôler la consommation de gasoil de mes
véhicules** et, plus largement, **garder le contrôle sur tout mon parc roulant**.

L'idée est simple : à chaque sortie d'un véhicule, je veux savoir **combien il a
consommé**, **combien ça m'a coûté**, **quel chauffeur conduisait**, et être
**prévenu à l'avance** de tout ce qui doit être fait (entretien, papiers, AdBlue).

## 👤 Pour qui

- Le **gérant / chef d'entreprise** : voit tout, contrôle tout, reçoit les alertes.
- Une agence de transport touristique (excursions) avec plusieurs véhicules et
  plusieurs chauffeurs qui changent d'une sortie à l'autre.

## 🧾 Ce que je veux suivre à chaque sortie / excursion

- **Km de départ** et **km d'arrivée** → nombre de **kilomètres parcourus**.
- Combien le chauffeur a mis en **gasoil / essence** (litres).
- Le **calcul de consommation** (L/100 km) automatique.
- Une **alerte si la consommation est excessive** (par rapport à la normale du véhicule).
- Toujours avec le **nom du chauffeur** pour chaque excursion / départ.
- Un champ pour noter si le chauffeur **prend les clients à différents endroits**
  et consomme donc plus (ça arrive) → pour **justifier** un écart.
- Possibilité de **joindre la photo du ticket** de carburant (justificatif).

## 💧 Suivi de l'AdBlue

- Le plein d'AdBlue se saisit **par véhicule** (date du plein, litres, autonomie
  habituelle attendue).
- Le compteur **additionne les kilomètres de toutes les excursions** depuis le
  dernier plein, **même si le véhicule change d'excursion**.
  - Exemple : Véhicule 1, je fais le plein d'AdBlue. Il fait l'excursion 1, puis
    4 jours plus tard l'excursion 2. Le compteur doit compter les km **des deux**.
- **Alerte quand ça devient insuffisant** (il reste ~500 km d'autonomie) →
  signaler qu'il faut refaire le plein.

## 🚚 Base de données des véhicules (le parc)

Je dois pouvoir **ajouter toute ma flotte** avec :

- Matricule, marque, **modèle**, **année**, etc.
- Le chauffeur habituel (mais le chauffeur réel est saisi **par sortie**).
- La **consommation de référence** du véhicule (pour comparer).

Pour **chaque véhicule**, je dois pouvoir renseigner et suivre :

- **Vidange** : dernière date + km, intervalle (km et/ou mois).
- **Chaîne de distribution** : date de changement + **nombre de km qu'elle peut
  faire avant changement**.
- **Assurance**, **visite technique**, **vignette** : par date.

## 🔔 Alertes en avance (le cœur du contrôle)

Je veux être **prévenu à l'avance**, pas au dernier moment :

- Pour la **vidange** et la **chaîne de distribution** : alerte **X km à l'avance**
  (par exemple **4000 km avant** l'échéance), en fonction du km réel parcouru.
- Pour l'**assurance / visite technique / vignette** : alerte **X jours à l'avance**.
- Le **préavis est réglable** (je choisis combien de km / de jours à l'avance).
- Le km utilisé pour ces alertes doit venir du **kilométrage réel** du véhicule
  (celui des sorties du carnet de bord), pas d'une saisie à part.

## 🧭 Excursions & chauffeurs

- Une **base des chauffeurs** (ajouter / modifier / supprimer).
- Une **liste des excursions** : je dois pouvoir **ajouter une excursion
  manuellement**, en la tapant librement au moment de la sortie.
- **Comparaison sur une même excursion** : l'app doit **détecter et comparer** si,
  pour la **même excursion**, des chauffeurs différents ont fait un **nombre de km
  différent** → repérer qui a roulé plus (détour, prises en charge éparpillées),
  avec la **justification** saisie.

## 📊 Pilotage & optimisation du parc

- **Coût du carburant en dinar** : par sortie et **au kilomètre**.
- **Consommation par chauffeur** et **par km / semaine / mois**, avec
  **détection d'anomalies**.
- **Classement des chauffeurs** du plus gros consommateur au plus sobre +
  **détection anti-gaspillage** (ex. beaucoup de litres achetés pour peu de km =
  suspicion de siphonnage / vol de gasoil).
- **Coût du gasoil par excursion** → utile pour la **rentabilité** (à rapprocher
  du prix de vente).
- **Rapport mensuel** exportable en **PDF** et **CSV** (Excel), par véhicule et
  par chauffeur.

## ✋ Règle importante : tout modifiable à tout moment

Je veux pouvoir **ajouter, modifier et mettre à jour toutes les informations à
tout moment** — même si je n'ai pas tout renseigné au début. Rien ne doit être
figé après la première saisie.

## 💻 Comment je veux l'utiliser

- Une **application téléchargeable**, **compatible Windows ET Mac**.
- **Reliée à Supabase** pour **conserver mes données** en ligne (rien enfermé sur
  un seul poste ; je peux y accéder de plusieurs appareils).
- Et aussi la possibilité de l'**ouvrir simplement dans Chrome** pour tester
  rapidement, sans installation.

## ✅ En résumé — ce que l'app doit me donner

1. La **conso réelle** de chaque véhicule, sortie par sortie, avec alerte si elle dérape.
2. Le **coût carburant** au km et par excursion, en dinar.
3. Le **suivi AdBlue** cumulatif par véhicule avec alerte avant la panne sèche.
4. Le **suivi des entretiens et papiers** (vidange, distribution, assurance, visite,
   vignette) avec **alerte en avance réglable**.
5. Le **contrôle des chauffeurs** : qui consomme trop, qui fait des km en trop sur
   une même excursion, détection des anomalies.
6. Des **rapports** clairs (PDF / CSV) pour décider.
7. Le tout **modifiable à tout moment**, **accessible sur PC et Mac**, **données
   conservées en ligne**.
