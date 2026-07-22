-- ============================================================
--  CONTRÔLE GASOIL — Carnet de bord par sortie + suivi AdBlue
--  À exécuter APRÈS supabase/schema.sql (utilise vehicles + is_admin()).
--  Ré-exécutable sans risque (idempotent).
-- ============================================================

-- ----- Base chauffeurs --------------------------------------
-- Réutilise la table `chauffeurs` de l'ERP (source unique). On la
-- crée ici « if not exists » pour que le module fonctionne aussi
-- sans la couche ERP complète.
create table if not exists public.chauffeurs (
  id             uuid primary key default gen_random_uuid(),
  nom            text not null,
  prenom         text,
  telephone      text,
  cin            text,
  permis         text,
  type_chauffeur text not null default 'EXTRA', -- SALARIE | EXTRA
  actif          boolean not null default true,
  created_at     timestamptz not null default now()
);

-- ----- Liste des excursions (référentiel simple du contrôle gasoil)
-- Permet de comparer, POUR UNE MÊME EXCURSION, les km faits par des
-- chauffeurs différents. km_reference = distance « normale » attendue.
create table if not exists public.gasoil_excursions (
  id            uuid primary key default gen_random_uuid(),
  nom           text not null unique,
  km_reference  numeric check (km_reference >= 0),
  actif         boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ----- Carnet de bord : une ligne = une sortie / excursion ----
-- Chaque sortie porte SON chauffeur (le chauffeur varie d'une
-- excursion à l'autre), les km départ/arrivée et le carburant
-- que le chauffeur a mis pendant la sortie.
create table if not exists public.trips (
  id             uuid primary key default gen_random_uuid(),
  vehicle_id     uuid not null references public.vehicles(id) on delete cascade,
  date           date not null default current_date,
  chauffeur      text,                       -- nom du chauffeur pour CETTE sortie
  chauffeur_id   uuid references public.chauffeurs(id) on delete set null,
  excursion      text,                        -- libellé sortie / excursion (optionnel)
  excursion_id   uuid references public.gasoil_excursions(id) on delete set null,
  km_depart      integer not null check (km_depart >= 0),
  km_arrivee     integer not null check (km_arrivee >= 0),
  carburant      text not null default 'gasoil' check (carburant in ('gasoil', 'essence')),
  litres         numeric not null default 0 check (litres >= 0),  -- litres mis par le chauffeur
  prix_litre     numeric check (prix_litre >= 0),
  montant        numeric check (montant >= 0),
  -- Justification d'une distance/conso supérieure : prises en charge
  -- à des endroits différents, détours clients, etc.
  lieux_prise_en_charge text,
  note           text,
  created_at     timestamptz not null default now(),
  constraint trips_km_coherent check (km_arrivee >= km_depart)
);

-- Migration douce si `trips` existait déjà sans ces colonnes.
alter table public.trips add column if not exists chauffeur_id uuid references public.chauffeurs(id) on delete set null;
alter table public.trips add column if not exists excursion_id uuid references public.gasoil_excursions(id) on delete set null;
alter table public.trips add column if not exists lieux_prise_en_charge text;

create index if not exists trips_vehicle_date_idx
  on public.trips (vehicle_id, date);
create index if not exists trips_chauffeur_idx
  on public.trips (chauffeur);
create index if not exists trips_excursion_idx
  on public.trips (excursion_id);

-- ----- Suivi AdBlue -----------------------------------------
-- À chaque plein d'AdBlue, on note les litres, le km compteur
-- au moment du plein et l'AUTONOMIE HABITUELLE attendue (saisie
-- manuelle, ex. 6000 km). L'app alerte quand il reste ~500 km.
create table if not exists public.adblue_logs (
  id             uuid primary key default gen_random_uuid(),
  vehicle_id     uuid not null references public.vehicles(id) on delete cascade,
  date           date not null default current_date,
  litres         numeric not null check (litres > 0),
  km_compteur    integer not null check (km_compteur >= 0),  -- km au moment du plein
  autonomie_km   integer not null check (autonomie_km > 0),  -- km habituels avant prochain plein
  note           text,
  created_at     timestamptz not null default now()
);

create index if not exists adblue_vehicle_km_idx
  on public.adblue_logs (vehicle_id, km_compteur);

-- ============================================================
--  Sécurité (RLS) — même règle que le reste de l'app :
--  lecture pour tout compte connecté, écriture réservée aux admins.
-- ============================================================
alter table public.trips             enable row level security;
alter table public.adblue_logs       enable row level security;
alter table public.chauffeurs        enable row level security;
alter table public.gasoil_excursions enable row level security;

do $$
declare t text;
begin
  foreach t in array array['trips','adblue_logs','chauffeurs','gasoil_excursions'] loop
    execute format('drop policy if exists "read %1$s"  on public.%1$s', t);
    execute format('drop policy if exists "write %1$s" on public.%1$s', t);
    execute format(
      'create policy "read %1$s" on public.%1$s for select to authenticated using (true)', t);
    execute format(
      'create policy "write %1$s" on public.%1$s for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;
