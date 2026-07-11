# SEO & plan de migration Next.js — Depart Travel Services

Ce document explique (1) l'état SEO actuel du site, (2) pourquoi viser la 1ʳᵉ
place Google impose un rendu serveur, et (3) le plan concret de migration
Next.js. Aucun code n'est modifié par ce document : c'est une aide à la décision.

---

## 1. Ce qui est DÉJÀ fait (SEO « on-page » et technique)

| Élément | État | Détail |
|---|---|---|
| Balises **H1/H2/H3** | ✅ | 1 seul H1/page (produit → nom de l'excursion), H2 sections, H3 cartes |
| **Title + meta description** | ✅ | uniques par page, via `setSeo()` |
| **URL canonique** | ✅ | ajoutée sur chaque page |
| **Open Graph + Twitter Card** | ✅ | partage social propre |
| **Données structurées (JSON-LD)** | ✅ | `TravelAgency`, `TouristTrip`, `Offer`, `AggregateRating`, `FAQPage`, `BreadcrumbList` |
| **FAQ éditable** | ✅ | back-office → rich results Google |
| **Pages ville** `/excursions-depuis/[ville]` | ✅ | H1 géo, contenu, maillage depuis l'accueil |
| **Maillage interne** | ✅ | menu, fil d'ariane, tuiles villes, « souvent réservé avec », footer |
| **Réseau de sites** | ✅ | `sameAs` + bloc « Nos guides voyage » (guide-voyage-tunisie, tunisia-travel-guide, ksarjouamaa, tunisia-trips) |
| **robots.txt + sitemap.xml** | ✅ | sitemap dynamique (pages fixes + produits + villes) |

### Ce qui reste HUMAIN (pas automatisable)
- **Nommer les produits avec les mots-clés** : `Excursion 2 jours désert de Ksar Ghilane au départ de Djerba` plutôt que `Sortie désert`.
- **Rédiger les descriptions** (200-400 mots) avec les mots-clés naturels.
- **Obtenir des backlinks** : Google Business Profile, TripAdvisor, articles sur tes 4 sites pointant vers les pages produit/ville.
- **Collecter des avis** (le module est prêt) : les étoiles dans Google augmentent le taux de clic.

---

## 2. Mots-clés cibles (marché Tunisie)

**Money keywords (FR)** : excursion désert Tunisie, excursion Sahara Tunisie,
circuit désert Tunisie, excursion Ksar Ghilane, excursion Douz, excursion Tozeur,
excursion depuis Djerba / Hammamet / Tunis / Sousse, circuit sur mesure Tunisie,
4x4 Sahara Tunisie.

**Longue traîne (conversion++)** : excursion 2 jours désert au départ de Djerba,
bivouac Sahara Tunisie prix, dormir dans le désert tunisien, team building désert
Tunisie, EVJF Tunisie, mariage dans le désert Tunisie.

**EN** : Tunisia desert tour, Sahara tour from Djerba, Ksar Ghilane day trip,
Tunisia private tour, Douz camel trek.

**Concurrents identifiés** : grand-sahara-aventures.com, gsa-voyages.com,
autretunisie.com, djerba-booking.com, israatravel.com, djerba.holiday.
Prix marché : **95–160 €/pers** selon le nombre de participants. Beaucoup ont un
SEO technique faible → la longue traîne (pages ville + fiches bien nommées) est
gagnable rapidement.

---

## 3. Pourquoi migrer en Next.js (le vrai levier « 1er sur Google »)

**Aujourd'hui** : le site est une **SPA** (Vite/React). Le HTML envoyé au robot
Google est quasi vide ; le contenu s'affiche après exécution du JavaScript.
Google sait l'exécuter, mais :
- l'indexation est **plus lente et moins fiable** sur les pages profondes ;
- les **8 langues partagent la même URL** (la langue est côté client) → pas de
  `hreflang` réellement exploitable, donc pas de version indexée par langue ;
- les concurrents en rendu serveur partent avec un avantage structurel.

**Avec Next.js (SSR/SSG)** : chaque page (accueil, produit, ville) est un **vrai
document HTML complet**, généré côté serveur, **par langue** :
`/fr/excursion/...`, `/en/tour/...`. Résultat : indexation immédiate, `hreflang`
effectif, Core Web Vitals au vert, rich snippets fiables.

> C'est **le** changement qui fait passer de « présent sur Google » à
> « en 1ʳᵉ page sur des requêtes concurrentielles ».

---

## 4. Plan de migration (étapes)

**Ce qu'on GARDE tel quel** (aucune reprise) :
- Toute la base Supabase (tables, RLS, migrations SQL).
- Toute la logique métier : `src/lib/produits.ts`, `stats.ts`, `erp.ts` (prix,
  promos, badges…) — c'est du TypeScript pur, réutilisable directement.
- Les fonctions Edge (emails, paiement, sitemap).
- **Le back-office ERP** (`/admin`) : il reste en l'état (pas besoin de SSR pour
  un outil interne).

**Ce qu'on RECONSTRUIT** (uniquement la vitrine publique) :

| Étape | Contenu | Effort |
|---|---|---|
| 1. Init | Nouveau projet Next.js (App Router) + Tailwind (même config/design system) | ½ j |
| 2. i18n | Routing par langue `/[locale]/…` (next-intl), les 8 locales | 1 j |
| 3. Données | Réutiliser `src/store/data.ts` en **Server Components** (fetch Supabase côté serveur) | 1 j |
| 4. Pages | Porter Accueil, Produit, Ville, Circuit, Événements (le JSX existe déjà, on l'adapte) | 2-3 j |
| 5. SEO | `generateMetadata` par page, `hreflang`, sitemap natif, JSON-LD serveur | 1 j |
| 6. Paiement/forms | Client Components pour le configurateur + checkout (déjà écrits) | 1 j |
| 7. Déploiement | Vercel (idéal pour Next.js) + domaine | ½ j |

**Total indicatif : ~1 à 1,5 semaine** de travail, sans repartir de zéro (on
recycle le design, la logique et la base).

**Architecture cible** :
```
depart-travel/
├─ apps/site   → Next.js (vitrine publique, SSR, SEO)   ← nouveau
├─ apps/admin  → l'app Vite actuelle (ERP /admin)        ← inchangé
└─ packages/core → lib partagée (produits.ts, data.ts…)  ← extraite de l'existant
```

---

## 5. Recommandation

1. **D'abord déployer l'existant** (Supabase + Resend + Stripe) : le site est
   déjà fonctionnel et bien mieux optimisé que la moyenne des concurrents.
   On collecte de premières ventes et de premiers avis.
2. **En parallèle**, remplir le contenu (noms produits + descriptions + photos).
3. **Ensuite**, lancer la migration Next.js pour aller chercher la 1ʳᵉ place —
   quand le catalogue et les contenus sont prêts (la migration a d'autant plus
   de valeur qu'il y a des pages à indexer).

Le site actuel **n'est pas jetable** : la migration en réutilise l'essentiel.
