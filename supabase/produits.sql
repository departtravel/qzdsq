-- ============================================================
--  DTS — Couche PRODUIT / CONFIGURATEUR (façon supplier)
--  À exécuter APRÈS erp.sql.
--  Étend la table `excursions` sans rien casser :
--   - tarification double : GROUPE + PRIVÉ (conversion plus grande)
--   - extras réservables (excursion_options) multilingues
--   - traductions produit (8 langues)
--   - villes de départ / d'arrivée avec supplément
--   - départs fixes (excursions + circuits multijours)
-- ============================================================

-- ----- 1. Tarification GROUPE / PRIVÉ sur la fiche produit ---
-- Les colonnes prix_adulte/enfant/bebe existantes = tarif GROUPE.
alter table public.excursions
  add column if not exists prix_prive_adulte  numeric default 0 check (prix_prive_adulte  >= 0),
  add column if not exists prix_prive_enfant  numeric default 0 check (prix_prive_enfant  >= 0),
  add column if not exists prix_prive_bebe    numeric default 0 check (prix_prive_bebe    >= 0),
  -- Conversion (marge) appliquée au privatif : « conversion plus grande ».
  add column if not exists taux_conversion_prive numeric default 4.20 check (taux_conversion_prive > 0),
  add column if not exists prive_dispo        boolean not null default true,
  add column if not exists groupe_dispo       boolean not null default true,
  add column if not exists langue_source      text not null default 'fr';

-- ----- 2. Traductions du produit (8 langues) ----------------
create table if not exists public.product_translations (
  id           uuid primary key default gen_random_uuid(),
  excursion_id uuid not null references public.excursions(id) on delete cascade,
  locale       text not null,               -- fr,en,es,de,it,pt,pl,ru
  nom          text,
  description  text,
  programme    text,
  inclus       text,
  non_inclus   text,
  created_at   timestamptz not null default now(),
  unique (excursion_id, locale)
);
create index if not exists product_translations_excursion_idx
  on public.product_translations (excursion_id);

-- ----- 3. Extras réservables (add-ons cochables) ------------
-- On réutilise `excursion_options` et on l'enrichit.
alter table public.excursion_options
  add column if not exists categorie   text,        -- 'Activité', 'Repas', 'Transfert'...
  add column if not exists actif       boolean not null default true,
  add column if not exists ordre       integer not null default 0,
  add column if not exists obligatoire boolean not null default false;

create table if not exists public.option_translations (
  id         uuid primary key default gen_random_uuid(),
  option_id  uuid not null references public.excursion_options(id) on delete cascade,
  locale     text not null,
  nom        text,
  description text,
  unique (option_id, locale)
);
create index if not exists option_translations_option_idx
  on public.option_translations (option_id);

-- ----- 4. Villes (référentiel) ------------------------------
create table if not exists public.cities (
  id         uuid primary key default gen_random_uuid(),
  nom        text not null,
  pays       text not null default 'Tunisie',
  actif      boolean not null default true,
  created_at timestamptz not null default now(),
  unique (nom, pays)
);

-- Ville de départ / d'arrivée autorisée pour un produit.
-- role = 'DEPART' (choix de la ville de début, sans supplément par défaut)
--        'ARRIVEE' (fin dans une autre ville => supplément)
create table if not exists public.product_cities (
  id           uuid primary key default gen_random_uuid(),
  excursion_id uuid not null references public.excursions(id) on delete cascade,
  city_id      uuid not null references public.cities(id) on delete cascade,
  role         text not null check (role in ('DEPART','ARRIVEE')),
  supplement   numeric not null default 0 check (supplement >= 0),
  devise       text not null default 'EUR',
  par_defaut   boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (excursion_id, city_id, role)
);
create index if not exists product_cities_excursion_idx
  on public.product_cities (excursion_id);

-- ----- 5. Départs fixes (dates programmées) -----------------
create table if not exists public.product_departures (
  id           uuid primary key default gen_random_uuid(),
  excursion_id uuid not null references public.excursions(id) on delete cascade,
  date_depart  date not null,
  heure        text,
  type_sortie  text not null default 'GROUPE' check (type_sortie in ('GROUPE','PRIVE')),
  capacite     integer check (capacite is null or capacite >= 0),
  places_reservees integer not null default 0 check (places_reservees >= 0),
  statut       text not null default 'OUVERT'
               check (statut in ('OUVERT','COMPLET','ANNULE','TERMINE')),
  note         text,
  created_at   timestamptz not null default now()
);
create index if not exists product_departures_excursion_idx
  on public.product_departures (excursion_id, date_depart);

-- ----- 6. Options / variantes réservables du produit --------
-- Ex : « 2 jours désert depuis Tunis », « … depuis Hammamet »,
--      « … avec quad inclus ». Chaque option porte sa tarification.
create table if not exists public.product_variants (
  id            uuid primary key default gen_random_uuid(),
  excursion_id  uuid not null references public.excursions(id) on delete cascade,
  nom           text not null,
  ville_depart_id uuid references public.cities(id) on delete set null,
  duree         text,
  nombre_jours  integer default 1 check (nombre_jours >= 1),
  -- Tarifs propres à l'option (si null => on retombe sur la fiche produit).
  prix_adulte        numeric check (prix_adulte >= 0),
  prix_enfant        numeric check (prix_enfant >= 0),
  prix_bebe          numeric check (prix_bebe >= 0),
  prix_prive_adulte  numeric check (prix_prive_adulte >= 0),
  prix_prive_enfant  numeric check (prix_prive_enfant >= 0),
  prix_prive_bebe    numeric check (prix_prive_bebe >= 0),
  inclus_extra  text,            -- « quad inclus », « chameau inclus »…
  actif         boolean not null default true,
  ordre         integer not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists product_variants_excursion_idx
  on public.product_variants (excursion_id);

create table if not exists public.variant_translations (
  id         uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  locale     text not null,
  nom        text,
  description text,
  unique (variant_id, locale)
);

-- ----- 7. Réductions ----------------------------------------
-- variant_id null  => s'applique à TOUTES les options du produit.
-- variant_id défini => s'applique à UNE seule option.
create table if not exists public.product_discounts (
  id           uuid primary key default gen_random_uuid(),
  excursion_id uuid not null references public.excursions(id) on delete cascade,
  variant_id   uuid references public.product_variants(id) on delete cascade,
  nom          text not null,
  type         text not null default 'PCT' check (type in ('PCT','MONTANT')),
  valeur       numeric not null check (valeur >= 0),
  devise       text not null default 'EUR',
  permanente   boolean not null default false,
  date_debut   date,                 -- utilisées si non permanente
  date_fin     date,
  actif        boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists product_discounts_excursion_idx
  on public.product_discounts (excursion_id);

-- ----- 8. RLS (mêmes règles que erp.sql) --------------------
do $$
declare t text;
begin
  foreach t in array array[
    'product_translations','option_translations',
    'cities','product_cities','product_departures',
    'product_variants','variant_translations','product_discounts'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I_read on public.%I;', t, t);
    execute format(
      'create policy %I_read on public.%I for select using (auth.role() = %L);',
      t, t, 'authenticated');
    execute format('drop policy if exists %I_write on public.%I;', t, t);
    execute format(
      'create policy %I_write on public.%I for all using (public.is_admin()) with check (public.is_admin());',
      t, t);
  end loop;
end $$;

-- ----- 7. Villes de départ courantes (seed léger) -----------
insert into public.cities (nom, pays) values
  ('Tunis','Tunisie'), ('Djerba','Tunisie'), ('Douz','Tunisie'),
  ('Tozeur','Tunisie'), ('Kairouan','Tunisie'), ('Sousse','Tunisie'),
  ('Hammamet','Tunisie'), ('Tataouine','Tunisie'), ('Gabès','Tunisie'),
  ('Ksar Ghilane','Tunisie'), ('Matmata','Tunisie')
on conflict (nom, pays) do nothing;
