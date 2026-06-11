# 🛂 Centre & Rapatriement

Application web pour gérer un **service d'investigation et de rapatriement** de
personnes vers des pays étrangers : suivi des personnes entrées au centre,
documents d'identité scannés, et classement par situation.

Stack : **React + Vite + TypeScript + Tailwind**, backend **Supabase**
(Postgres + Auth + Storage), avec **rôles & Row Level Security**.

## Fonctionnalités

- **Authentification** (Supabase) — accès réservé aux comptes connectés.
- **Rôles & permissions** : `admin` (lecture + écriture) et `viewer` (lecture
  seule). L'écriture est aussi bloquée côté base (RLS).
- **Fiche personne** :
  - Nom, prénom, sexe, date de naissance, nationalité (avec indicateur
    « présumée » pour les cas non confirmés).
  - **N° de passeport / document** et type de document : CIN, passeport,
    laissez-passer.
  - **Documents scannés** : upload de plusieurs fichiers (photos / PDF de la
    CIN, du passeport, du laissez-passer) — stockés dans un bucket **privé**,
    affichés via des **URLs signées temporaires**.
  - **Entrée** et **sortie** du centre (date + heure).
  - **Remarque / observations** : champ texte libre par personne.
  - **Rapatriement** : pays de destination et date prévue.
- **Classement par situation** : `identifié`, `non identifié`,
  `en investigation`, `rapatrié` — avec badges de couleur et **filtres**.
- **Tableau de bord** : compteurs (présents au centre, identifiés, non
  identifiés, rapatriés), recherche (nom, n° passeport, nationalité, remarque).
- **Export CSV** de la liste (compatible Excel FR).

## Installation

1. **Dépendances** — `npm install`
2. **Supabase**
   - Crée un projet sur [supabase.com](https://supabase.com).
   - *SQL Editor* → exécute [`supabase/schema.sql`](supabase/schema.sql). Le
     script crée les tables, les politiques RLS **et** le bucket privé
     `person-documents`.
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

## Confidentialité & sécurité

Cette application traite des **données personnelles sensibles**. Mesures en
place :

- Accès réservé aux utilisateurs **authentifiés**.
- **Row Level Security** : lecture pour tout compte connecté, écriture réservée
  aux administrateurs (fonction `is_admin()`).
- **Bucket de stockage privé** : les pièces d'identité ne sont jamais publiques,
  l'accès se fait via des URLs signées à durée limitée.
- Suppression d'une personne → **suppression en cascade** de ses documents.

> Veille à respecter la réglementation applicable sur la protection des données
> (conservation, droit d'accès, etc.) dans ton contexte d'usage.

## Pistes d'évolution

- Photo d'identité dédiée par personne.
- Historique des mouvements (plusieurs entrées/sorties).
- Export PDF d'une fiche imprimable.
- Journal d'audit des accès aux documents.
