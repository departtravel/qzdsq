-- ============================================================
--  Schéma Supabase — Gestion de Flotte (système complet)
--  À exécuter dans : Supabase > SQL Editor > New query
--  Ré-exécutable sans risque (idempotent).
-- ============================================================

-- ----- Table des véhicules ----------------------------------
create table if not exists public.vehicles (
  id              uuid primary key default gen_random_uuid(),
  matricule       text not null unique,
  marque          text,
  modele          text,
  annee           integer check (annee is null or annee between 1950 and 2100),
  chauffeur       text,
  actif           boolean not null default true,

  -- Consommation de référence (litres / 100 km)
  conso_normale    numeric not null default 8 check (conso_normale > 0),
  -- Surconsommation si la conso réelle dépasse la normale de + de X %
  seuil_alerte_pct numeric not null default 15 check (seuil_alerte_pct >= 0),

  -- Préavis d'alerte configurable (« prévenir X km / X jours en avance »)
  preavis_km       integer not null default 4000 check (preavis_km >= 0),
  preavis_jours    integer not null default 30   check (preavis_jours >= 0),

  -- Vidange
  date_vidange          date,
  km_vidange            integer check (km_vidange >= 0),
  vidange_interval_km   integer default 10000 check (vidange_interval_km > 0),
  vidange_interval_mois integer default 12 check (vidange_interval_mois > 0),

  -- Chaîne de distribution
  date_distribution        date,
  km_distribution          integer check (km_distribution >= 0),
  distribution_interval_km integer default 150000 check (distribution_interval_km > 0),

  -- Échéances administratives
  date_assurance         date,
  date_visite_technique  date,
  date_vignette          date,

  created_at      timestamptz not null default now()
);

-- Migration douce si la table existait déjà (ajoute les colonnes manquantes)
alter table public.vehicles add column if not exists chauffeur text;
alter table public.vehicles add column if not exists actif boolean not null default true;
alter table public.vehicles add column if not exists date_visite_technique date;
alter table public.vehicles add column if not exists date_vignette date;
alter table public.vehicles add column if not exists annee integer;
alter table public.vehicles add column if not exists preavis_km integer not null default 4000;
alter table public.vehicles add column if not exists preavis_jours integer not null default 30;

-- ----- Journal des pleins de gasoil -------------------------
create table if not exists public.fuel_logs (
  id          uuid primary key default gen_random_uuid(),
  vehicle_id  uuid not null references public.vehicles(id) on delete cascade,
  date        date not null default current_date,
  km          integer not null check (km >= 0),  -- km au compteur lors du plein
  litres      numeric not null check (litres > 0),
  prix_litre  numeric check (prix_litre >= 0),
  montant     numeric check (montant >= 0),
  plein_complet boolean not null default true,   -- réservoir fait le plein ?
  note        text,
  created_at  timestamptz not null default now()
);
alter table public.fuel_logs add column if not exists plein_complet boolean not null default true;

create index if not exists fuel_logs_vehicle_km_idx
  on public.fuel_logs (vehicle_id, km);

-- ----- Historique d'entretien (générique) -------------------
create table if not exists public.maintenance_logs (
  id          uuid primary key default gen_random_uuid(),
  vehicle_id  uuid not null references public.vehicles(id) on delete cascade,
  date        date not null default current_date,
  km          integer check (km >= 0),
  type        text not null,        -- ex. "Vidange", "Pneus", "Freins"...
  cout        numeric check (cout >= 0),
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists maintenance_vehicle_idx
  on public.maintenance_logs (vehicle_id, date);

-- ----- Profils & rôles --------------------------------------
-- Chaque utilisateur Supabase a un profil avec un rôle :
--   'admin'  -> lecture + écriture
--   'viewer' -> lecture seule
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  role       text not null default 'viewer' check (role in ('admin', 'viewer')),
  created_at timestamptz not null default now()
);

-- Création automatique du profil à l'inscription d'un utilisateur.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Crée les profils des comptes déjà existants.
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- Helper : l'utilisateur courant est-il admin ?
-- SECURITY DEFINER pour éviter toute récursion de RLS.
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- ============================================================
--  Sécurité (RLS)
--  Lecture : tout utilisateur connecté.
--  Écriture : administrateurs uniquement.
-- ============================================================
alter table public.vehicles         enable row level security;
alter table public.fuel_logs        enable row level security;
alter table public.maintenance_logs enable row level security;
alter table public.profiles         enable row level security;

do $$
declare t text;
begin
  foreach t in array array['vehicles','fuel_logs','maintenance_logs'] loop
    execute format('drop policy if exists "read %1$s"   on public.%1$s', t);
    execute format('drop policy if exists "write %1$s"  on public.%1$s', t);
    execute format(
      'create policy "read %1$s" on public.%1$s for select to authenticated using (true)', t);
    execute format(
      'create policy "write %1$s" on public.%1$s for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- Profils : chacun lit son profil ; les admins lisent et gèrent tous les rôles.
drop policy if exists "read own profile"  on public.profiles;
drop policy if exists "admin read profiles"  on public.profiles;
drop policy if exists "admin manage profiles" on public.profiles;
create policy "read own profile" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "admin read profiles" on public.profiles
  for select to authenticated using (public.is_admin());
create policy "admin manage profiles" on public.profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ⚠️ Promouvoir le premier administrateur (à exécuter une fois) :
--   update public.profiles set role = 'admin' where email = 'ton-email@exemple.com';
