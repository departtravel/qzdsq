# 🚚 Gestion de Flotte

Système web complet pour gérer une flotte de véhicules : suivi des échéances
(vidange, distribution, assurance, visite technique, vignette), historique
d'entretien, et **détection automatique des surconsommations de gasoil**.

Stack : **React + Vite + TypeScript + Tailwind**, backend **Supabase**
(Postgres + Auth), logique métier **couverte par des tests**.

## Fonctionnalités

- **Authentification** (Supabase) — accès réservé aux comptes connectés.
- **Rôles & permissions** : `admin` (lecture + écriture) et `viewer` (lecture
  seule). Les boutons de modification/suppression et les formulaires sont masqués
  pour les comptes en lecture seule, et l'écriture est bloquée côté base (RLS).
- **Notifications e-mail** des échéances proches (Supabase Edge Function + cron).
- **Export PDF** (rapport de flotte + fiche véhicule imprimable).
- **Fiche véhicule** : matricule, marque/modèle, chauffeur, conso de référence,
  statut actif/archivé.
- **Échéances** avec badges de couleur : 🟢 OK · 🟠 bientôt · 🔴 dépassé pour
  vidange, distribution, assurance, visite technique et vignette.
  - Vidange & distribution gérées par **date *et* kilométrage** (la plus proche
    des deux l'emporte).
- **Journal des pleins** : date, km, litres, prix/montant, plein complet ou non.
- **Contrôle de consommation** : conso réelle par plein **et** moyenne globale
  robuste, comparées à la conso normale ; alerte au-delà du seuil (déf. +15 %).
- **Historique d'entretien** générique (type, km, coût, note).
- **Tableau de bord** : panneau d'alertes consolidé, recherche, filtre archivés.
- **Export CSV** (flotte entière + pleins par véhicule), compatible Excel FR.
- **Export PDF** via la vue d'impression du navigateur (rapport flotte + fiche).

## Comment fonctionne le contrôle de consommation

Méthode **« plein à plein »** : les litres d'un plein couvrent la distance
parcourue depuis le plein **complet** précédent.

```
conso réelle (L/100km) = litres ÷ (km actuel − km du plein précédent) × 100
écart (%)              = (conso réelle − conso normale) ÷ conso normale × 100
```

Une **moyenne globale** (somme des litres ÷ distance totale) sert d'indicateur
robuste pour le tableau de bord. Les pleins marqués « partiels » sont exclus du
calcul segment par segment.

> ⚠️ Saisis le **kilométrage au compteur** à chaque plein : c'est la distance,
> et non le montant en dirhams, qui révèle une surconsommation (le prix varie).

## DTS Operation ERP (module excursions & rentabilité)

En plus de la gestion de flotte, ce dépôt intègre la première couche de l'ERP
**Depart Travel Services** décrit dans le cahier des charges : catalogue des
excursions OTA et calcul automatique de rentabilité.

- **Base de données** — `supabase/erp.sql` crée toutes les tables métier
  (canaux OTA, excursions, options, lignes de coût, transporteurs, véhicules,
  guides + tarifs, chauffeurs, restaurants + prix, hébergements + prix, extras,
  fournisseurs + transactions + factures, réservations, planning, imports OTA,
  taux de change, historique des coûts) avec Row Level Security.
- **Données initiales** — `supabase/seed.sql` charge les données réelles :
  7 canaux OTA (commission GYG 30 %, taux 1 EUR = 3,34 TND), restaurants,
  hébergements, extras, et le catalogue GetYourGuide (TDE + Tunisia-Trips) avec
  les lignes de coût de référence (ex. Ksar Ghilane 2 jours).
- **Moteur de rentabilité** — `src/lib/erp.ts` répond automatiquement à :
  « combien coûte réellement l'excursion ? », « combien gagne-t-on par
  personne ? », « combien de participants minimum pour être rentable ? ».
  Coûts fixes vs variables, répartition PAR_PERSONNE / PAR_VEHICULE /
  PAR_GROUPE, exclusion comptable, conversion EUR→TND. Couvert par
  `src/lib/erp.test.ts`.
- **Interface** — onglet **🧭 Excursions** : catalogue cliquable + simulateur
  d'effectif affichant CA net, coût total, marge et seuil de rentabilité.

### Modules ERP disponibles

L'application couvre l'ensemble du cahier des charges via des onglets :

- **🧭 Excursions** — catalogue OTA + simulateur de rentabilité.
- **📅 Réservations** — création + workflow Hiba→Farah→Hersi→Karima→Amine/Aymen.
- **📆 Planning** — vue jour/semaine des sorties + affectation guide/véhicule/chauffeur.
- **💰 Comptabilité** — fournisseurs, transactions, avances, alerte factures manquantes.
- **📊 Direction** — dashboard KPI (CA, commissions, marge, top/déficitaires, à payer).
- **📥 Import OTA** — import CSV de réservations avec mapping et prévisualisation.
- **🧠 IA Analytique** — « pourquoi la marge baisse ? », simulations, longue durée vs ponctuelle.
- **📇 Référentiels** — guides, chauffeurs, restaurants, hébergements, extras, transports, véhicules
  (création automatique du fournisseur associé).

### Installation de la couche ERP

Dans le **SQL Editor** de Supabase, exécute dans l'ordre :
`supabase/schema.sql` → `supabase/erp.sql` → `supabase/seed.sql` → `supabase/seed_dts.sql`.

## Installation

1. **Dépendances** — `npm install`
2. **Supabase**
   - Crée un projet sur [supabase.com](https://supabase.com).
   - *SQL Editor* → exécute [`supabase/schema.sql`](supabase/schema.sql).
   - *Authentication → Users* → crée au moins un compte.
   - Promeus ton compte en administrateur (sinon tout le monde est en lecture
     seule) :
     ```sql
     update public.profiles set role = 'admin' where email = 'ton-email@exemple.com';
     ```
3. **Variables d'environnement** — `cp .env.example .env`, puis renseigne
   `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (Settings → API).
4. **Lancer** — `npm run dev`

## Scripts

| Commande          | Description                       |
| ----------------- | --------------------------------- |
| `npm run dev`     | Serveur de développement          |
| `npm run build`   | Build de production (`dist/`)     |
| `npm run preview` | Prévisualise le build             |
| `npm run lint`    | Vérification TypeScript           |
| `npm test`        | Tests automatisés (Vitest)        |

## Fiabilité & sécurité

- **Tests** : la logique d'échéances et de consommation (`src/lib/fleet.ts`)
  est couverte par `src/lib/fleet.test.ts` — lance `npm test`.
- **Contraintes base de données** : valeurs positives, unicité des matricules,
  suppression en cascade de l'historique.
- **Row Level Security** activée : lecture pour tout utilisateur connecté,
  écriture réservée aux administrateurs (fonction `is_admin()`).

## Notifications e-mail

Voir [`supabase/functions/README.md`](supabase/functions/README.md) : déploiement
de la fonction `notify-echeances` (envoi via Resend) et planification quotidienne
avec `pg_cron`.

## Pistes d'évolution

- Notifications SMS.
- Graphiques de tendance de consommation.
- Rôles supplémentaires (ex. gestionnaire par dépôt).
