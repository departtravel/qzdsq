# Déploiement de l'ERP DTS Operation

L'application a **deux morceaux** :

1. **Le site (frontend)** — fichiers statiques générés par `npm run build` (dossier `dist/`).
   → à héberger sur ton domaine (Vercel, Netlify, ou hébergeur classique).
2. **Les données + stockage + comptes (backend)** — hébergés chez **Supabase**
   (base PostgreSQL, authentification, fichiers). Gratuit pour commencer.

---

## 1. Créer le backend Supabase

1. Crée un projet sur [supabase.com](https://supabase.com).
2. **SQL Editor → New query** : exécute dans l'ordre le contenu de :
   1. `supabase/schema.sql`
   2. `supabase/erp.sql`
   3. `supabase/rbac.sql`
   4. `supabase/missions.sql`
   5. `supabase/produits.sql`  ← catalogue produit (options, extras, tarifs groupe/privé, réductions, villes, départs, 8 langues)
   6. `supabase/public_read.sql` ← lecture publique du catalogue pour la vitrine client
   7. `supabase/reservation.sql` ← réservation en ligne (le client réserve depuis le site)
   8. `supabase/messagerie.sql` ← messagerie (le client nous contacte depuis le site)
   9. `supabase/devis.sql` ← demandes de devis (événements + circuits sur mesure)
   10. `supabase/stats.sql` ← compteur de visites (taux de conversion du dashboard)
   11. `supabase/seed.sql`
   12. `supabase/seed_dts.sql`

> **Deux espaces dans l'app :**
> - `/` → **vitrine publique** (Depart Travel Services) : accueil, entrée par ville, pages produit avec configurateur (ville → option → groupe/privé → date → extras → prix live + promo).
> - `/admin` → **ERP interne** (DTS Operation), derrière login.
>
> **Hébergement (SPA)** : configurer un *fallback* de toutes les routes vers `index.html`
> (Netlify `/* /index.html 200`, Vercel rewrite `/(.*) → /index.html`) pour que les liens
> profonds (`/excursion/…`, `/admin`) fonctionnent au rafraîchissement.
3. **Authentication → Users** : crée les comptes (Hiba, Farah, Hersi, Karima, Amine, Aymen…).
4. Promeus au moins un compte en super administrateur :
   ```sql
   update public.profiles set role = 'admin', erp_role = 'ADMIN'
   where email = 'direction@tondomaine.com';
   ```
   Ensuite, tous les autres rôles se gèrent **depuis l'ERP** (onglet 🔐 Utilisateurs).
5. **Settings → API** : note `Project URL` et la clé `anon public`.

---

## 2. Configurer et tester en local

```bash
npm install
cp .env.example .env          # puis renseigne les 2 variables ci-dessous
npm run dev                   # http://localhost:5173
```

`.env` :
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...
```

---

## 3. Mettre en ligne sur ton domaine

### Option A — Vercel (recommandé, gratuit)
1. Pousse le dépôt sur GitHub (déjà fait).
2. Sur [vercel.com](https://vercel.com) → **Add New Project** → importe le repo.
3. Framework : **Vite**. Build command : `npm run build`. Output : `dist`.
4. **Environment Variables** : ajoute `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`.
5. Deploy. Puis **Settings → Domains** → ajoute `erp.tondomaine.com`
   (Vercel te donne l'enregistrement DNS `CNAME` à créer chez ton registrar).

### Option B — Netlify
Même principe : build `npm run build`, publish `dist`, variables d'env identiques,
puis **Domain settings** pour brancher ton domaine.

### Option C — Hébergeur classique (cPanel/OVH mutualisé)
1. `npm run build` en local.
2. Téléverse le **contenu du dossier `dist/`** dans le dossier web
   (ex. `public_html/erp/`).
3. ⚠️ Un hébergeur mutualisé ne fait tourner **que** le site ; la base et les
   comptes restent chez Supabase. Ça fonctionne, le site appelle Supabase par internet.

---

## 4. Sécurité (déjà en place)

- **Row Level Security** activée sur toutes les tables.
- **Workflow imposé par la base** (`rbac.sql`) : chaque étape réservée au bon rôle.
- La clé `anon` est publique par conception — c'est la RLS qui protège les données,
  pas la clé. Ne mets **jamais** la clé `service_role` dans le frontend.

---

## 5. Sauvegardes

Supabase fait des sauvegardes automatiques (selon le plan). Pour un export manuel :
**Database → Backups**, ou `pg_dump` via la chaîne de connexion (Settings → Database).
