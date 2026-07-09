# DTS Operation ERP — Depart Travel Services

ERP complet pour agence réceptive : catalogue OTA, réservations, opérations,
comptabilité fournisseurs **automatique**, charges fixes et rentabilité.

Stack : **React + Vite + TypeScript + Tailwind**, backend **Supabase**
(PostgreSQL + Auth + RLS). Devise commerciale **EUR**, comptabilité **TND**
(taux 1 EUR = 3,34 TND). **Tous les tarifs sont saisis TTC** (TVA incluse).

---

## 1. Mise en route (une seule fois)

### A. Créer la base Supabase
1. Crée un projet sur [supabase.com](https://supabase.com).
2. **SQL Editor → New query** : colle et exécute (**Run without RLS**), dans l'ordre :
   1. `supabase/install_complet.sql` — toute la base + catalogue GYG (TDE + Tunisia-Trips)
   2. `supabase/maj_operations.sql` — sorties, flotte, catalogue **DTS** (58 excursions)
   3. `supabase/maj_finale.sql` — compta automatique + charges fixes
   4. `supabase/maj_corrections.sql` — correctifs comptables (anti-doublon, validation)
   5. `supabase/tva.sql` — TVA (TTC) + numérotation des factures
   6. `supabase/seed_donnees.sql` — tes charges fixes, guides, restos, hôtels, camps
3. **Authentication → Users → Add user** : crée ton compte.
4. **SQL Editor** : deviens super admin (remplace l'email) :
   ```sql
   update public.profiles set role = 'admin', erp_role = 'ADMIN'
   where email = 'ton-email@exemple.com';
   ```
5. **Settings → API** : note **Project URL** et la clé **anon public**.

### B. Mettre l'application en ligne
1. `npm run build` produit le dossier `dist/` (ou récupère l'archive fournie).
2. Sur [app.netlify.com](https://app.netlify.com) → ton site → **Deploys** → glisse le dossier `dist`.
   (Ne recrée pas un site à chaque fois : mets à jour le **même** pour garder l'adresse.)
3. Ouvre l'adresse → écran **« Connexion à Supabase »** → colle l'URL + la clé anon → **Connecter**.
4. Connecte-toi avec ton compte. C'est prêt.

> En local : `npm install` puis `npm run dev` (http://localhost:5173).

---

## 2. Les rôles (qui fait quoi)

Le workflow est **imposé par la base** : chaque étape n'est franchissable que par le bon rôle.

| Rôle | Personne | Peut faire |
| --- | --- | --- |
| **ADMIN** (super admin) | Direction (Amine, Aymen) | Tout, dont gérer les comptes et le catalogue |
| **RESERVATION** | Hiba | Créer les réservations, importer les OTA |
| **CONFIRMATION** | Farah | Confirmer les réservations |
| **OPERATIONS** | Hersi | Regrouper en sorties, affecter guide/véhicule/chauffeur |
| **LOGISTIQUE** | Karima | Réservations partenaires, référentiels, mettre en opération |
| **COMPTABLE** | Comptabilité | **Valider les factures**, saisir paiements/avances |
| **LECTURE** | Contrôle | Consulter, analyser |

Gestion des comptes : onglet **🔐 Utilisateurs** (super admin uniquement) — ajouter,
changer le rôle, retirer l'accès.

---

## 3. Le flux quotidien (ce que tu dois faire)

1. **📅 Réservations** — Hiba crée la réservation (client, date, effectif, hôtel,
   heure de prise en charge, régime, **extras cochés**) — ou **📥 Import OTA** (CSV,
   anti-doublon par référence). Puis Farah **confirme**.
2. **📆 Planning** (feuille du mois) — coche plusieurs réservations **du même produit
   et de la même date** → **« Créer une sortie »**. Affecte **guide + chauffeur +
   véhicule + transport** (mode : parc / longue durée / journalière + coût).
3. **✓ Confirmer la sortie** (bouton dans le Planning) → **les factures fournisseurs
   sont générées automatiquement** (guide, chauffeur, transport, restos, hôtels,
   camps, extras), au statut « en attente ».
4. **💰 Comptabilité** — le responsable facturation **valide** chaque facture
   (elle reçoit un n° `FAC-AAAA-000N` et se fige), puis saisit **paiements/avances**.
5. **📋 Ordre de mission** — document imprimable (guide, chauffeur, participants,
   hôtels, heures, extras) avec **signature + cachet** ; **🗒️ Réservations à effectuer**
   pour Karima (repas, hébergement, extras à réserver).

---

## 4. Les modules

- **🧭 Excursions** — catalogue 3 comptes GYG + DTS. Bouton **+ Ajouter une excursion**
  (infos, prix, lignes de coût, extras). Fiche = simulateur de rentabilité + seuil.
- **📅 Réservations** — création + workflow + coût/marge par réservation.
- **📆 Planning** — feuilles mensuelles, regroupement en sorties, affectations, statut.
- **📋 Ordre de mission / 🗒️ Réservations à effectuer** — documents imprimables (logo inclus).
- **💰 Comptabilité** — fournisseurs, factures **auto**, validation, paiements, alertes.
- **🧾 Relevé prestataire** — relevé par fournisseur (facturé / payé / **solde à payer**).
- **🏢 Charges fixes** — salaires, parc, leasings, loyer, assurances (par véhicule),
  taxes, internet, abonnements… avec total mensuel/annuel. Montants éditables.
- **📊 Direction** — **résultat net du mois** (marge des sorties − charges fixes),
  TVA indicative, KPIs, top rentables, déficitaires, **⚠️ à faire en urgence**.
- **📥 Import OTA** — import CSV (colonnes : date, excursion, canal, client, adultes,
  enfants, bebes, langue, **reference**).
- **🧠 IA Analytique** — pourquoi la marge baisse, simulations, longue durée vs ponctuelle.
- **📇 Référentiels** — guides (salarié/extra), chauffeurs (**tarif/jour**),
  restaurants, hébergements, extras, transports (**tarif/sortie**), véhicules.
- **🔐 Utilisateurs / ⚙️ Paramètres** — comptes & rôles ; logo, coordonnées, **taux de TVA**.
- **🚚 Flotte** — véhicules, échéances (assurance, visite technique…), consommation gasoil.

---

## 5. Comptabilité : comment ça marche

- **Automatique** : à la confirmation d'une sortie, une **facture par prestataire**
  est créée avec le montant calculé (barèmes guide/chauffeur/transport, charges du
  produit × pax). Supprimer/modifier une réservation **met à jour** ces factures ;
  supprimer une sortie **les supprime**.
- **Validation** : le responsable facturation valide → la facture se **fige** (n°
  séquentiel, plus recalculée). Les avances/paiements diminuent le solde ;
  un **avoir (CREDIT)** aussi.
- **TVA** : tous les tarifs sont **TTC**. La part TVA est isolée au taux configuré
  (défaut 19 %) — indicateur **indicatif** (régime TVA sur marge à confirmer avec
  ton comptable).

---

## 6. Ce qui reste prévu (phase 2, en cours)

- Numérotation des factures ✅ (posée) · TVA TTC ✅ (posée)
- Échéances de paiement / balance âgée / trésorerie prévisionnelle
- Taux de change **figé** à la date de réservation
- Facture / voucher **client** (PDF) + envoi email
- Rapprochement des versements OTA · gestion no-show / effectif réalisé
- Amortissement du leasing (capital/intérêts) · exports comptables

---

## 7. Sécurité & sauvegardes

- **Row Level Security** sur toutes les tables ; écriture selon le rôle.
- La clé `anon` est publique par conception (c'est la RLS qui protège) ; ne jamais
  exposer la clé `service_role`.
- Supabase sauvegarde automatiquement ; pour un export manuel : **Database → Backups**.

Tests de la logique métier : `npm test`.
