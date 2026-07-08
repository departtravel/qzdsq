-- ============================================================
-- DTS OPERATION ERP — INSTALLATION COMPLETE (fichier unique)
-- Colle TOUT ce fichier dans Supabase > SQL Editor > New query > Run
-- Ré-exécutable sans risque.
-- ============================================================

-- >>>>>>>>>>>>>>>>>> schema.sql <<<<<<<<<<<<<<<<<<

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
  chauffeur       text,
  actif           boolean not null default true,

  -- Consommation de référence (litres / 100 km)
  conso_normale    numeric not null default 8 check (conso_normale > 0),
  -- Surconsommation si la conso réelle dépasse la normale de + de X %
  seuil_alerte_pct numeric not null default 15 check (seuil_alerte_pct >= 0),

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

-- >>>>>>>>>>>>>>>>>> erp.sql <<<<<<<<<<<<<<<<<<

-- ============================================================
--  DTS OPERATION ERP — Schéma métier complet
--  Depart Travel Services (agence réceptive tunisienne)
--
--  À exécuter APRÈS supabase/schema.sql, dans :
--    Supabase > SQL Editor > New query
--  Ré-exécutable sans risque (idempotent).
--
--  Couvre les tables du cahier des charges (BLOC 2) :
--    canaux OTA, excursions, options, lignes de coût,
--    transporteurs, véhicules ERP, coûts véhicules,
--    guides + tarifs, chauffeurs + coûts, restaurants + prix,
--    hébergements + prix, extras, fournisseurs + transactions +
--    factures, réservations, planning, imports OTA, taux de change,
--    historique des coûts.
-- ============================================================

-- ----- Types énumérés ---------------------------------------
do $$ begin
  create type erp_role as enum (
    'ADMIN','COMPTABLE','RESERVATION','CONFIRMATION',
    'OPERATIONS','LOGISTIQUE','LECTURE'
  );
exception when duplicate_object then null; end $$;

-- ----- Canaux de vente (OTA) --------------------------------
create table if not exists public.ota_channels (
  id                    uuid primary key default gen_random_uuid(),
  nom                   text not null unique,
  commission_percentage numeric not null default 30 check (commission_percentage >= 0 and commission_percentage <= 100),
  devise                text not null default 'EUR',
  actif                 boolean not null default true,
  created_at            timestamptz not null default now()
);

-- ----- Taux de change ---------------------------------------
create table if not exists public.exchange_rates (
  id      uuid primary key default gen_random_uuid(),
  devise  text not null,                    -- EUR, USD...
  taux    numeric not null check (taux > 0),-- valeur en TND pour 1 unité
  date    date not null default current_date,
  unique (devise, date)
);

-- ----- Excursions (catalogue principal) ---------------------
create table if not exists public.excursions (
  id                  uuid primary key default gen_random_uuid(),
  code_interne        text not null unique,
  nom                 text not null,
  description         text,
  ota_channel_id      uuid references public.ota_channels(id) on delete set null,
  compte_ota          text,
  ville_depart        text,
  destination         text,
  duree               text,                 -- 'demi-journée', 'journée', '2 jours'...
  nombre_jours        integer default 1 check (nombre_jours >= 1),
  categorie           text,
  langues_disponibles text[],
  prix_adulte         numeric default 0 check (prix_adulte >= 0),
  prix_enfant         numeric default 0 check (prix_enfant >= 0),
  prix_bebe           numeric default 0 check (prix_bebe >= 0),
  devise              text not null default 'EUR',
  commission_ota      numeric not null default 30 check (commission_ota >= 0 and commission_ota <= 100),
  taux_conversion     numeric not null default 3.34 check (taux_conversion > 0),
  statut              text not null default 'ACTIVE',
  created_at          timestamptz not null default now()
);

-- ----- Options d'excursion ----------------------------------
create table if not exists public.excursion_options (
  id           uuid primary key default gen_random_uuid(),
  excursion_id uuid not null references public.excursions(id) on delete cascade,
  nom_option   text not null,
  description  text,
  prix_adulte  numeric default 0 check (prix_adulte >= 0),
  prix_enfant  numeric default 0 check (prix_enfant >= 0),
  prix_bebe    numeric default 0 check (prix_bebe >= 0),
  created_at   timestamptz not null default now()
);

-- ----- Transporteurs ----------------------------------------
create table if not exists public.transports (
  id             uuid primary key default gen_random_uuid(),
  nom            text not null,
  type_transport text not null default 'PRESTATAIRE',
    -- FLOTTE_INTERNE | LOCATION_LONGUE_DUREE | LOCATION_EXCURSION | PRESTATAIRE
  contact        text,
  telephone      text,
  email          text,
  actif          boolean not null default true,
  created_at     timestamptz not null default now()
);

-- ----- Véhicules ERP (distinct de la flotte technique) ------
create table if not exists public.erp_vehicles (
  id             uuid primary key default gen_random_uuid(),
  transport_id   uuid references public.transports(id) on delete set null,
  immatriculation text,
  marque         text,
  modele         text,
  type           text,           -- berline | van | minibus | coaster | bus
  capacite       integer check (capacite >= 0),
  annee          integer,
  statut         text not null default 'ACTIF',
  created_at     timestamptz not null default now()
);

-- ----- Coûts véhicule ---------------------------------------
create table if not exists public.vehicle_costs (
  id          uuid primary key default gen_random_uuid(),
  vehicle_id  uuid not null references public.erp_vehicles(id) on delete cascade,
  type_cout   text not null, -- LOCATION_MENSUELLE | LOCATION_JOUR | CARBURANT | ASSURANCE | MAINTENANCE
  montant     numeric not null check (montant >= 0),
  periode     text,
  date_debut  date,
  date_fin    date,
  created_at  timestamptz not null default now()
);

-- ----- Guides -----------------------------------------------
create table if not exists public.guides (
  id                          uuid primary key default gen_random_uuid(),
  nom                         text not null,
  prenom                      text,
  telephone                   text,
  email                       text,
  cin                         text,
  numero_carte_professionnelle text,
  langues                     text[],
  type_guide                  text not null default 'EXTRA', -- SALARIE | EXTRA
  salaire_mensuel             numeric check (salaire_mensuel >= 0),
  disponible                  boolean not null default true,
  actif                       boolean not null default true,
  created_at                  timestamptz not null default now()
);

create table if not exists public.guide_prices (
  id               uuid primary key default gen_random_uuid(),
  guide_id         uuid references public.guides(id) on delete cascade,
  demi_journee     numeric not null default 100 check (demi_journee >= 0),
  journee          numeric not null default 150 check (journee >= 0),
  deux_jours       numeric not null default 300 check (deux_jours >= 0),
  date_application date not null default current_date,
  created_at       timestamptz not null default now()
);

-- ----- Chauffeurs -------------------------------------------
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

create table if not exists public.driver_costs (
  id           uuid primary key default gen_random_uuid(),
  chauffeur_id uuid not null references public.chauffeurs(id) on delete cascade,
  type_cout    text not null,
  montant      numeric not null check (montant >= 0),
  date         date not null default current_date,
  created_at   timestamptz not null default now()
);

-- ----- Restaurants ------------------------------------------
create table if not exists public.restaurants (
  id        uuid primary key default gen_random_uuid(),
  nom       text not null,
  ville     text,
  contact   text,
  telephone text,
  type      text,
  created_at timestamptz not null default now()
);

create table if not exists public.restaurant_prices (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  date_debut    date not null default current_date,
  date_fin      date,
  prix_adulte   numeric not null default 0 check (prix_adulte >= 0),
  prix_enfant   numeric not null default 0 check (prix_enfant >= 0),
  prix_bebe     numeric not null default 0 check (prix_bebe >= 0),
  created_at    timestamptz not null default now()
);

-- ----- Hébergements -----------------------------------------
create table if not exists public.accommodations (
  id        uuid primary key default gen_random_uuid(),
  nom       text not null,
  type      text not null default 'HOTEL', -- HOTEL | CAMP | TENTE
  ville     text,
  contact   text,
  created_at timestamptz not null default now()
);

create table if not exists public.accommodation_prices (
  id               uuid primary key default gen_random_uuid(),
  accommodation_id uuid not null references public.accommodations(id) on delete cascade,
  date             date not null default current_date,
  prix_adulte      numeric not null default 0 check (prix_adulte >= 0),
  prix_enfant      numeric not null default 0 check (prix_enfant >= 0),
  prix_bebe        numeric not null default 0 check (prix_bebe >= 0),
  created_at       timestamptz not null default now()
);

-- ----- Extras -----------------------------------------------
create table if not exists public.extras (
  id                  uuid primary key default gen_random_uuid(),
  nom                 text not null,
  categorie           text,
  type_tarification   text not null default 'PAR_PERSONNE',
    -- PAR_PERSONNE | PAR_VEHICULE | PAR_GROUPE | MANUEL
  prix_achat          numeric default 0 check (prix_achat >= 0),
  prix_vente          numeric default 0 check (prix_vente >= 0),
  devise_achat        text not null default 'TND',
  devise_vente        text not null default 'EUR',
  inclure_comptabilite boolean not null default true,
  capacite            integer,       -- pour tarif PAR_VEHICULE (ex: 4x4 = 5 pers)
  prestataire_id      uuid,
  created_at          timestamptz not null default now()
);

-- ----- Lignes de coût par excursion (table centrale) --------
create table if not exists public.excursion_cost_lines (
  id                  uuid primary key default gen_random_uuid(),
  excursion_id        uuid not null references public.excursions(id) on delete cascade,
  jour                integer default 1,
  categorie           text not null,
    -- TRANSPORT | GUIDE | CHAUFFEUR | RESTAURANT | HEBERGEMENT
    -- | EXTRA | GASOIL | PEAGE | PARKING | AUTRE
  type_depense        text,           -- PAR_PERSONNE | PAR_VEHICULE | PAR_GROUPE | FIXE
  reference_id        uuid,           -- id restaurant/extra/guide... si lié
  nom_depense         text not null,
  quantite            numeric not null default 1 check (quantite >= 0),
  unite               text,
  prix_unitaire       numeric not null default 0 check (prix_unitaire >= 0),
  devise              text not null default 'TND',
  inclure_comptabilite boolean not null default true,
  note                text,
  created_at          timestamptz not null default now()
);
create index if not exists cost_lines_excursion_idx
  on public.excursion_cost_lines (excursion_id);

-- ----- Fournisseurs -----------------------------------------
create table if not exists public.suppliers (
  id            uuid primary key default gen_random_uuid(),
  nom           text not null,
  type          text,  -- GUIDE | CHAUFFEUR | RESTAURANT | HOTEL | TRANSPORT | EXTRA
  telephone     text,
  email         text,
  cin           text,
  adresse       text,
  solde_actuel  numeric not null default 0,
  actif         boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists public.supplier_transactions (
  id            uuid primary key default gen_random_uuid(),
  supplier_id   uuid not null references public.suppliers(id) on delete cascade,
  date          date not null default current_date,
  type_operation text not null,  -- FACTURE | AVANCE | PAIEMENT | CREDIT
  montant       numeric not null,
  reference     text,
  description   text,
  statut        text not null default 'EN_ATTENTE',
  created_at    timestamptz not null default now()
);

create table if not exists public.supplier_invoices (
  id             uuid primary key default gen_random_uuid(),
  supplier_id    uuid not null references public.suppliers(id) on delete cascade,
  numero_facture text,
  date_facture   date,
  montant        numeric check (montant >= 0),
  fichier        text,
  statut         text not null default 'MANQUANTE', -- RECUE | MANQUANTE | VALIDEE | PAYEE
  created_at     timestamptz not null default now()
);

-- ----- Réservations clients ---------------------------------
create table if not exists public.bookings (
  id              uuid primary key default gen_random_uuid(),
  date_excursion  date,
  excursion_id    uuid references public.excursions(id) on delete set null,
  ota_channel_id  uuid references public.ota_channels(id) on delete set null,
  client_nom      text,
  client_email    text,
  client_telephone text,
  nombre_adultes  integer not null default 0 check (nombre_adultes >= 0),
  nombre_enfants  integer not null default 0 check (nombre_enfants >= 0),
  nombre_bebes    integer not null default 0 check (nombre_bebes >= 0),
  langue          text,
  statut          text not null default 'NOUVELLE',
    -- NOUVELLE | CONFIRMEE | EN_OPERATION | TERMINEE | ANNULEE
  guide_id        uuid references public.guides(id) on delete set null,
  vehicle_id      uuid references public.erp_vehicles(id) on delete set null,
  driver_id       uuid references public.chauffeurs(id) on delete set null,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists bookings_date_idx on public.bookings (date_excursion);

-- ----- Planning opérationnel --------------------------------
create table if not exists public.operation_planning (
  id                   uuid primary key default gen_random_uuid(),
  date                 date not null,
  booking_id           uuid references public.bookings(id) on delete cascade,
  excursion_id         uuid references public.excursions(id) on delete set null,
  guide_id             uuid references public.guides(id) on delete set null,
  vehicle_id           uuid references public.erp_vehicles(id) on delete set null,
  driver_id            uuid references public.chauffeurs(id) on delete set null,
  nombre_participants  integer default 0,
  commentaire          text,
  created_at           timestamptz not null default now()
);
create index if not exists planning_date_idx on public.operation_planning (date);

-- ----- Imports OTA ------------------------------------------
create table if not exists public.ota_imports (
  id          uuid primary key default gen_random_uuid(),
  source      text,
  fichier     text,
  date_import timestamptz not null default now(),
  statut      text not null default 'EN_ATTENTE'
);

-- ----- Historique des coûts ---------------------------------
create table if not exists public.cost_history (
  id           uuid primary key default gen_random_uuid(),
  categorie    text,
  reference_id uuid,
  ancien_prix  numeric,
  nouveau_prix numeric,
  date         timestamptz not null default now()
);

-- ============================================================
--  ROW LEVEL SECURITY
--  Lecture : tout utilisateur connecté. Écriture : rôles ERP
--  admin/gestion (réutilise is_admin() défini dans schema.sql).
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'ota_channels','exchange_rates','excursions','excursion_options',
    'transports','erp_vehicles','vehicle_costs','guides','guide_prices',
    'chauffeurs','driver_costs','restaurants','restaurant_prices',
    'accommodations','accommodation_prices','extras','excursion_cost_lines',
    'suppliers','supplier_transactions','supplier_invoices','bookings',
    'operation_planning','ota_imports','cost_history'
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

-- >>>>>>>>>>>>>>>>>> rbac.sql <<<<<<<<<<<<<<<<<<

-- ============================================================
--  DTS OPERATION ERP — Cloisonnement par rôle (RBAC)
--  À exécuter APRÈS supabase/erp.sql (idempotent).
--
--  Objectif : imposer le workflow métier au niveau BASE, pas
--  seulement dans l'interface. Chaque étape d'une réservation
--  ne peut être franchie que par le bon rôle :
--    NOUVELLE   -> CONFIRMEE     : CONFIRMATION (Farah)
--    CONFIRMEE  -> EN_OPERATION  : OPERATIONS  (Hersi)
--    EN_OPERATION -> TERMINEE    : OPERATIONS / LOGISTIQUE (Hersi / Karima)
--    (Amine / Aymen = CONTROLE/LECTURE : lecture seule + rapports)
--  Affectation guide/véhicule/chauffeur : OPERATIONS uniquement.
--  ADMIN (Direction) : peut tout faire.
-- ============================================================

-- ----- Rôle ERP sur le profil utilisateur -------------------
alter table public.profiles
  add column if not exists erp_role erp_role not null default 'LECTURE';

-- Les administrateurs (role='admin') sont ADMIN ERP par défaut.
update public.profiles set erp_role = 'ADMIN'
where role = 'admin' and erp_role = 'LECTURE';

-- ----- Helpers ----------------------------------------------
-- Rôle ERP effectif de l'utilisateur courant (admin => ADMIN).
create or replace function public.erp_role()
returns text language sql security definer stable set search_path = public as $$
  select coalesce(
    (select case when p.role = 'admin' then 'ADMIN' else p.erp_role::text end
       from public.profiles p where p.id = auth.uid()),
    'LECTURE');
$$;

-- L'utilisateur a-t-il l'un des rôles demandés (ADMIN passe toujours) ?
create or replace function public.has_erp_role(variadic roles text[])
returns boolean language sql stable set search_path = public as $$
  select public.erp_role() = 'ADMIN' or public.erp_role() = any(roles);
$$;

-- ============================================================
--  Trigger de validation des transitions sur bookings
-- ============================================================
create or replace function public.bookings_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare r text := public.erp_role();
begin
  if r = 'ADMIN' then
    return new;  -- la Direction n'est pas contrainte
  end if;

  -- Changement de statut : chaque transition a son rôle
  if new.statut is distinct from old.statut then
    if old.statut = 'NOUVELLE' and new.statut = 'CONFIRMEE' then
      if r <> 'CONFIRMATION' then
        raise exception 'Seul le rôle CONFIRMATION (Farah) peut confirmer une réservation';
      end if;
    elsif old.statut = 'CONFIRMEE' and new.statut = 'EN_OPERATION' then
      if r <> 'OPERATIONS' then
        raise exception 'Seul le rôle OPERATIONS (Hersi) peut mettre en opération';
      end if;
    elsif old.statut = 'EN_OPERATION' and new.statut = 'TERMINEE' then
      if r not in ('OPERATIONS','LOGISTIQUE') then
        raise exception 'Seuls OPERATIONS (Hersi) ou LOGISTIQUE (Karima) peuvent terminer';
      end if;
    elsif new.statut = 'ANNULEE' then
      if r not in ('RESERVATION','CONFIRMATION') then
        raise exception 'Annulation non autorisée pour ce rôle';
      end if;
    else
      raise exception 'Transition % -> % non autorisée', old.statut, new.statut;
    end if;
  end if;

  -- Affectation opérationnelle réservée au rôle OPERATIONS
  if (new.guide_id   is distinct from old.guide_id
   or new.vehicle_id is distinct from old.vehicle_id
   or new.driver_id  is distinct from old.driver_id)
   and r <> 'OPERATIONS' then
     raise exception 'Seul le rôle OPERATIONS (Hersi) peut affecter guide / véhicule / chauffeur';
  end if;

  return new;
end $$;

drop trigger if exists bookings_guard_trg on public.bookings;
create trigger bookings_guard_trg
  before update on public.bookings
  for each row execute function public.bookings_guard();

-- ============================================================
--  Politiques RLS par rôle
--  (remplacent les politiques d'écriture "admin only" d'erp.sql)
-- ============================================================

-- --- Réservations : créer = RESERVATION ; modifier = chaîne ; supprimer = ADMIN
drop policy if exists bookings_write on public.bookings;
drop policy if exists bookings_insert on public.bookings;
drop policy if exists bookings_update on public.bookings;
drop policy if exists bookings_delete on public.bookings;
create policy bookings_insert on public.bookings for insert
  with check (public.has_erp_role('RESERVATION'));
create policy bookings_update on public.bookings for update
  using (public.has_erp_role('RESERVATION','CONFIRMATION','OPERATIONS','LOGISTIQUE'))
  with check (public.has_erp_role('RESERVATION','CONFIRMATION','OPERATIONS','LOGISTIQUE'));
create policy bookings_delete on public.bookings for delete
  using (public.has_erp_role());  -- ADMIN uniquement

-- --- Planning : OPERATIONS / LOGISTIQUE
drop policy if exists operation_planning_write on public.operation_planning;
create policy operation_planning_write on public.operation_planning for all
  using (public.has_erp_role('OPERATIONS','LOGISTIQUE'))
  with check (public.has_erp_role('OPERATIONS','LOGISTIQUE'));

-- --- Comptabilité fournisseurs : COMPTABLE
do $$
declare t text;
begin
  foreach t in array array['suppliers','supplier_transactions','supplier_invoices'] loop
    execute format('drop policy if exists %I_write on public.%I;', t, t);
    execute format(
      'create policy %I_write on public.%I for all using (public.has_erp_role(%L)) with check (public.has_erp_role(%L));',
      t, t, 'COMPTABLE', 'COMPTABLE');
  end loop;
end $$;

-- --- Référentiels (production/logistique) : LOGISTIQUE
do $$
declare t text;
begin
  foreach t in array array[
    'guides','guide_prices','chauffeurs','driver_costs','restaurants',
    'restaurant_prices','accommodations','accommodation_prices','extras',
    'transports','erp_vehicles','vehicle_costs'
  ] loop
    execute format('drop policy if exists %I_write on public.%I;', t, t);
    execute format(
      'create policy %I_write on public.%I for all using (public.has_erp_role(%L)) with check (public.has_erp_role(%L));',
      t, t, 'LOGISTIQUE', 'LOGISTIQUE');
  end loop;
end $$;

-- --- Catalogue / paramètres : ADMIN seulement (inchangé, on garde is_admin
--     via has_erp_role() sans argument => ADMIN)
do $$
declare t text;
begin
  foreach t in array array['excursions','excursion_options','excursion_cost_lines','ota_channels','exchange_rates'] loop
    execute format('drop policy if exists %I_write on public.%I;', t, t);
    execute format(
      'create policy %I_write on public.%I for all using (public.has_erp_role()) with check (public.has_erp_role());',
      t, t);
  end loop;
end $$;

-- ============================================================
--  Affectation des rôles aux utilisateurs (À PERSONNALISER)
--  Remplace les e-mails par les vrais comptes créés dans Supabase.
-- ============================================================
--  update public.profiles set erp_role = 'RESERVATION'  where email = 'hiba@...';
--  update public.profiles set erp_role = 'CONFIRMATION'  where email = 'farah@...';
--  update public.profiles set erp_role = 'OPERATIONS'    where email = 'hersi@...';
--  update public.profiles set erp_role = 'LOGISTIQUE'    where email = 'karima@...';
--  update public.profiles set erp_role = 'COMPTABLE'     where email = 'compta@...';
--  update public.profiles set erp_role = 'LECTURE'       where email in ('amine@...','aymen@...');
--  update public.profiles set erp_role = 'ADMIN', role='admin' where email in ('amine@...','aymen@...');

-- >>>>>>>>>>>>>>>>>> missions.sql <<<<<<<<<<<<<<<<<<

-- ============================================================
--  DTS OPERATION ERP — Ordres de mission & fiches de réservation
--  À exécuter APRÈS supabase/erp.sql et supabase/rbac.sql.
--  Idempotent.
-- ============================================================

-- ----- Détails opérationnels sur chaque réservation ---------
-- Nécessaires à l'ordre de mission (prise en charge, régime, extras).
alter table public.bookings add column if not exists hotel                 text;
alter table public.bookings add column if not exists heure_prise_en_charge text;
alter table public.bookings add column if not exists regime                text;  -- végétarien, vegan, allergies...
alter table public.bookings add column if not exists extras                text;  -- ex: "Camel ride / Quad double"

-- ----- Ordres de mission (1 par excursion + date) -----------
-- Regroupe guide, chauffeur, véhicule et la signature/cachet
-- que la Direction ou les Opérations enregistrent.
create table if not exists public.mission_orders (
  id             uuid primary key default gen_random_uuid(),
  date           date not null,
  excursion_id   uuid references public.excursions(id) on delete set null,
  guide_id       uuid references public.guides(id) on delete set null,
  driver_id      uuid references public.chauffeurs(id) on delete set null,
  vehicle_id     uuid references public.erp_vehicles(id) on delete set null,
  remarque       text,
  signature      text,   -- image (data URL) de la signature
  cachet         text,   -- image (data URL) du cachet
  signe_par      text,   -- nom / rôle du signataire
  signe_le       timestamptz,
  created_at     timestamptz not null default now(),
  unique (date, excursion_id)
);
create index if not exists mission_orders_date_idx on public.mission_orders (date);

-- ----- RLS --------------------------------------------------
alter table public.mission_orders enable row level security;
drop policy if exists mission_orders_read on public.mission_orders;
create policy mission_orders_read on public.mission_orders
  for select using (auth.role() = 'authenticated');
drop policy if exists mission_orders_write on public.mission_orders;
create policy mission_orders_write on public.mission_orders for all
  using (public.has_erp_role('OPERATIONS','LOGISTIQUE'))
  with check (public.has_erp_role('OPERATIONS','LOGISTIQUE'));

-- >>>>>>>>>>>>>>>>>> settings.sql <<<<<<<<<<<<<<<<<<

-- ============================================================
--  DTS OPERATION ERP — Paramètres généraux (logo, coordonnées)
--  À exécuter APRÈS supabase/rbac.sql. Idempotent.
-- ============================================================
create table if not exists public.app_settings (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);

-- Valeurs par défaut (coordonnées imprimées sur les documents).
insert into public.app_settings (key, value) values
  ('company_name', 'Depart Travel Services'),
  ('company_info', ''),
  ('logo', '')
on conflict (key) do nothing;

alter table public.app_settings enable row level security;
drop policy if exists app_settings_read on public.app_settings;
create policy app_settings_read on public.app_settings
  for select using (auth.role() = 'authenticated');
drop policy if exists app_settings_write on public.app_settings;
create policy app_settings_write on public.app_settings for all
  using (public.has_erp_role()) with check (public.has_erp_role()); -- ADMIN seulement

-- >>>>>>>>>>>>>>>>>> seed.sql <<<<<<<<<<<<<<<<<<

-- ============================================================
--  DTS OPERATION ERP — Données initiales (seed)
--  À exécuter APRÈS supabase/erp.sql.
--  Ré-exécutable (idempotent via ON CONFLICT / WHERE NOT EXISTS).
--
--  Données RÉELLES du cahier des charges — aucune donnée fictive.
--  Règle GetYourGuide : commission 30 %, taux 1 EUR = 3,34 TND.
-- ============================================================

-- ----- Canaux de vente --------------------------------------
insert into public.ota_channels (nom, commission_percentage, devise) values
  ('GetYourGuide TDE',            30, 'EUR'),
  ('GetYourGuide Tunisia-Trips',  30, 'EUR'),
  ('GetYourGuide DTS',            30, 'EUR'),
  ('Depart Travel Services',       0, 'EUR'),
  ('Viator',                      25, 'EUR'),
  ('TourRadar',                   25, 'EUR'),
  ('Musement',                    25, 'EUR')
on conflict (nom) do nothing;

-- ----- Taux de change ---------------------------------------
insert into public.exchange_rates (devise, taux, date) values
  ('EUR', 3.34, current_date),
  ('USD', 3.10, current_date)
on conflict (devise, date) do nothing;

-- ----- Restaurants + prix -----------------------------------
insert into public.restaurants (nom, ville) values
  ('Sidi Idriss', 'Sahara'),
  ('Ammar El Jem', 'El Jem'),
  ('Port Aghir', 'Djerba'),
  ('Monte Carlo', 'Tunis'),
  ('Sahara Lounge', 'Sahara'),
  ('Les Jardins', 'Sahara'),
  ('El Borj', 'Tataouine')
on conflict do nothing;

insert into public.restaurant_prices (restaurant_id, date_debut, prix_adulte, prix_enfant, prix_bebe)
select r.id, date '2025-01-01', v.pa, v.pe, 0
from (values
  ('Sidi Idriss', 15, 7.5),
  ('Ammar El Jem', 25, 12.5),
  ('Port Aghir', 30, 15),
  ('Monte Carlo', 30, 15),
  ('Sahara Lounge', 15, 7.5),
  ('Les Jardins', 15, 7.5),
  ('El Borj', 15, 7.5)
) as v(nom, pa, pe)
join public.restaurants r on r.nom = v.nom
where not exists (select 1 from public.restaurant_prices p where p.restaurant_id = r.id);

-- Historique : Sidi Idriss passe à 18 DT en 2026
insert into public.restaurant_prices (restaurant_id, date_debut, prix_adulte, prix_enfant, prix_bebe)
select r.id, date '2026-01-01', 18, 9, 0
from public.restaurants r
where r.nom = 'Sidi Idriss'
  and not exists (
    select 1 from public.restaurant_prices p
    where p.restaurant_id = r.id and p.date_debut = date '2026-01-01');

-- ----- Hébergements + prix ----------------------------------
insert into public.accommodations (nom, type, ville) values
  ('Sahara Lounge', 'CAMP', 'Sahara'),
  ('Dunes Insolites', 'CAMP', 'Sahara')
on conflict do nothing;

insert into public.accommodation_prices (accommodation_id, date, prix_adulte, prix_enfant, prix_bebe)
select a.id, date '2025-01-01', v.pa, v.pe, 0
from (values
  ('Sahara Lounge', 55, 35),
  ('Dunes Insolites', 90, 45)
) as v(nom, pa, pe)
join public.accommodations a on a.nom = v.nom
where not exists (select 1 from public.accommodation_prices p where p.accommodation_id = a.id);

-- ----- Extras -----------------------------------------------
insert into public.extras (nom, categorie, type_tarification, prix_achat, devise_achat, prix_vente, devise_vente, capacite, inclure_comptabilite) values
  ('Ticket El Jem',            'ENTREE',  'PAR_PERSONNE', 20,  'TND', 0,   'EUR', null, true),
  ('Dromadaire',               'ANIMAL',  'PAR_PERSONNE', 20,  'TND', 25,  'EUR', null, true),
  ('Quad simple',              'QUAD',    'PAR_VEHICULE', 40,  'TND', 45,  'EUR', 1,    true),
  ('Quad double',              'QUAD',    'PAR_VEHICULE', 40,  'TND', 60,  'EUR', 2,    true),
  ('4x4 Ong Jmal',             '4X4',     'PAR_VEHICULE', 180, 'TND', 0,   'EUR', 5,    true),
  ('4x4 (5 pers)',             '4X4',     'PAR_VEHICULE', 200, 'TND', 0,   'EUR', 5,    true),
  ('4x4 coucher soleil',       '4X4',     'PAR_VEHICULE', 450, 'TND', 0,   'EUR', 6,    true),
  ('Ksar Hadada',              'ENTREE',  'PAR_PERSONNE', 3,   'TND', 0,   'EUR', null, true),
  ('Guide local Chenini',      'GUIDE',   'PAR_GROUPE',   20,  'TND', 0,   'EUR', null, true),
  ('Caravane Djerba',          'ANIMAL',  'PAR_PERSONNE', 40,  'TND', 0,   'EUR', null, true),
  ('Musée Bardo',              'ENTREE',  'PAR_PERSONNE', 30,  'TND', 0,   'EUR', null, true),
  ('Carthage',                 'ENTREE',  'PAR_PERSONNE', 20,  'TND', 0,   'EUR', null, true),
  ('Entrée sites Kairouan',    'ENTREE',  'PAR_PERSONNE', 20,  'TND', 0,   'EUR', null, true),
  ('Tente single',             'HEBERG',  'PAR_PERSONNE', 30,  'TND', 45,  'EUR', null, true),
  ('Tente luxe',               'HEBERG',  'PAR_PERSONNE', 95,  'TND', 120, 'EUR', null, true),
  ('Camel Ride Sabria',        'ANIMAL',  'PAR_PERSONNE', 20,  'TND', 25,  'EUR', null, true),
  ('Quad Sabria',              'QUAD',    'PAR_VEHICULE', 45,  'TND', 60,  'EUR', 1,    true),
  ('4x4 Sabria',               '4X4',     'PAR_VEHICULE', 50,  'TND', 45,  'EUR', 5,    true)
on conflict do nothing;

-- ----- Tarifs guides par défaut (extra) ---------------------
insert into public.guide_prices (guide_id, demi_journee, journee, deux_jours, date_application)
select null, 100, 150, 300, current_date
where not exists (select 1 from public.guide_prices where guide_id is null);

-- ============================================================
--  CATALOGUE EXCURSIONS
--  Prix en EUR. Commission 30 %, taux 3,34.
-- ============================================================

-- Helper : insertion des excursions rattachées à leur canal OTA.
insert into public.excursions
  (code_interne, nom, ota_channel_id, compte_ota, ville_depart, duree, nombre_jours, prix_adulte, prix_enfant)
select v.code, v.nom, o.id, v.compte, v.ville, v.duree, v.jours, v.pa, v.pe
from (values
  -- GetYourGuide TDE
  ('GYG-TDE-001','De Hammamet : 1/2 journée à la découverte d''El Jem','GetYourGuide TDE','Hammamet','demi-journée',1,43,35),
  ('GYG-TDE-002','Depuis Tunis et Hammamet : visite de 2 jours à Ksar Ghilane et Tataouine','GetYourGuide TDE','Hammamet','2 jours',2,125,125),
  ('GYG-TDE-003','Djerba : Journée fun cheval, dromadaire et quad avec repas','GetYourGuide TDE','Djerba','journée',1,110,60),
  ('GYG-TDE-004','Djerba : repas traditionnel couscous famille locale','GetYourGuide TDE','Djerba','demi-journée',1,25,15),
  ('GYG-TDE-005','Hammamet : Full day Tunis Medina, Bardo, Carthage & Sidi Bou Saïd','GetYourGuide TDE','Hammamet','journée',1,75,45),
  ('GYG-TDE-006','Djerba : coucher de soleil désert, soirée bédouine','GetYourGuide TDE','Djerba','journée',1,140,100),
  ('GYG-TDE-007','Hammamet : randonnée Zaghouan et Zriba','GetYourGuide TDE','Hammamet','demi-journée',1,50,45),
  ('GYG-TDE-008','Hammamet : visite guidée demi-journée Kairouan','GetYourGuide TDE','Hammamet','demi-journée',1,55,30),
  ('GYG-TDE-009','Depuis Sousse : El Jem Colisée et Musée','GetYourGuide TDE','Sousse','demi-journée',1,65,35),
  -- GetYourGuide Tunisia-Trips
  ('GYG-TT-002-SM','Excursion 2 jours désert (depuis Sousse/Monastir)','GetYourGuide Tunisia-Trips','Sousse','2 jours',2,150,135),
  ('GYG-TT-002-HAM','Excursion 2 jours désert (depuis Hammamet)','GetYourGuide Tunisia-Trips','Hammamet','2 jours',2,175,150),
  ('GYG-TT-002-TUN','Excursion 2 jours désert (depuis Tunis)','GetYourGuide Tunisia-Trips','Tunis','2 jours',2,185,160),
  ('GYG-TT-003','Djerba & Zarzis : Tataouine Chenini & berbères','GetYourGuide Tunisia-Trips','Djerba','journée',1,49,39),
  ('GYG-TT-004','Djerba/Zarzis : circuit 2 jours Sahara nuit sous tente','GetYourGuide Tunisia-Trips','Djerba','2 jours',2,124,109),
  ('GYG-TT-005','Bateau pirate Djerba → Flamingo Island','GetYourGuide Tunisia-Trips','Djerba','journée',1,20,12),
  ('GYG-TT-006','Transfert aéroport Djerba → hôtel','GetYourGuide Tunisia-Trips','Djerba','transfert',1,20,20),
  ('GYG-TT-007','Spa Djerba','GetYourGuide Tunisia-Trips','Djerba','demi-journée',1,100,100),
  ('GYG-TT-008','Ksar Ghilane aventure quad + fort romain','GetYourGuide Tunisia-Trips','Djerba','journée',1,30,30),
  ('GYG-TT-010','Demi-journée Djerba boisson gratuite','GetYourGuide Tunisia-Trips','Djerba','demi-journée',1,19,15),
  ('GYG-TT-011','Balade chameau 1H Ksar Ghilane','GetYourGuide Tunisia-Trips','Djerba','activité',1,20,15),
  ('GYG-TT-012','Circuit Ksar Ghilane & Tataouine Chenini 1 journée','GetYourGuide Tunisia-Trips','Djerba','journée',1,69,49),
  ('GYG-TT-013','Djerba quad 1H30','GetYourGuide Tunisia-Trips','Djerba','activité',1,25,17),
  ('GYG-TT-014','Djerba chameau 1H30','GetYourGuide Tunisia-Trips','Djerba','activité',1,25,25),
  ('GYG-TT-015','5 jours désert tunisien','GetYourGuide Tunisia-Trips','Tunis','5 jours',5,1185,1185),
  ('GYG-TT-016','3 jours quad Sahara','GetYourGuide Tunisia-Trips','Djerba','3 jours',3,1450,1450),
  ('GYG-TT-017','Djerba randonnée cheval 1H30','GetYourGuide Tunisia-Trips','Djerba','activité',1,25,25),
  ('GYG-TT-018','Dîner romantique Casino Djerba','GetYourGuide Tunisia-Trips','Djerba','soirée',1,150,150)
) as v(code, nom, compte, ville, duree, jours, pa, pe)
join public.ota_channels o on o.nom = v.compte
on conflict (code_interne) do nothing;

-- Options de l'excursion GYG-TDE-005 (Tunis/Bardo/Carthage)
insert into public.excursion_options (excursion_id, nom_option, prix_adulte, prix_enfant)
select e.id, v.nom, v.pa, v.pe
from (values
  ('Guide uniquement', 20, 10),
  ('Transport inclus', 75, 45)
) as v(nom, pa, pe)
join public.excursions e on e.code_interne = 'GYG-TDE-005'
where not exists (
  select 1 from public.excursion_options x
  where x.excursion_id = e.id and x.nom_option = v.nom);

-- ============================================================
--  LIGNES DE COÛT — exemple complet : GYG-TDE-002
--  Ksar Ghilane / Tataouine 2 jours (référence de calcul)
-- ============================================================
insert into public.excursion_cost_lines
  (excursion_id, jour, categorie, type_depense, nom_depense, quantite, unite, prix_unitaire, devise, inclure_comptabilite)
select e.id, v.jour, v.cat, v.td, v.nom, v.qte, v.unite, v.pu, v.dev, true
from (values
  (1,'GUIDE',      'FIXE',        'Guide extra 2 jours',      1, 'forfait',  300, 'TND'),
  (1,'RESTAURANT', 'PAR_PERSONNE','Restaurant Sidi Idriss',   1, 'personne', 15,  'TND'),
  (1,'HEBERGEMENT','PAR_PERSONNE','Camp Sahara Lounge',       1, 'personne', 55,  'TND'),
  (2,'RESTAURANT', 'PAR_PERSONNE','Restaurant Ammar El Jem',  1, 'personne', 25,  'TND'),
  (2,'EXTRA',      'PAR_PERSONNE','Ticket El Jem',            1, 'personne', 20,  'TND'),
  (2,'EXTRA',      'PAR_PERSONNE','Ksar Hadada',              1, 'personne', 3,   'TND'),
  (2,'EXTRA',      'PAR_GROUPE',  'Guide local Chenini',      1, 'groupe',   20,  'TND')
) as v(jour, cat, td, nom, qte, unite, pu, dev)
join public.excursions e on e.code_interne = 'GYG-TDE-002'
where not exists (
  select 1 from public.excursion_cost_lines c
  where c.excursion_id = e.id and c.nom_depense = v.nom and c.jour = v.jour);

-- Lignes de coût — GYG-TDE-001 (El Jem demi-journée)
insert into public.excursion_cost_lines
  (excursion_id, jour, categorie, type_depense, nom_depense, quantite, unite, prix_unitaire, devise, inclure_comptabilite)
select e.id, 1, v.cat, v.td, v.nom, 1, v.unite, v.pu, 'TND', true
from (values
  ('GUIDE','FIXE',        'Guide extra demi-journée', 'forfait',  100),
  ('EXTRA','PAR_PERSONNE','Ticket El Jem',            'personne', 20)
) as v(cat, td, nom, unite, pu)
join public.excursions e on e.code_interne = 'GYG-TDE-001'
where not exists (
  select 1 from public.excursion_cost_lines c
  where c.excursion_id = e.id and c.nom_depense = v.nom);

-- >>>>>>>>>>>>>>>>>> seed_dts.sql <<<<<<<<<<<<<<<<<<

-- ============================================================
--  DTS OPERATION ERP — Catalogue DTS (complément de seed)
--  À exécuter APRÈS supabase/erp.sql ET supabase/seed.sql.
--  Ré-exécutable (idempotent via ON CONFLICT / WHERE NOT EXISTS).
--
--  Complète les lignes de coût de référence du cahier des charges
--  pour des excursions déjà présentes dans seed.sql.
--  Prix en TND. type_depense : PAR_PERSONNE | PAR_VEHICULE | PAR_GROUPE | FIXE.
-- ============================================================

-- ----- Canal de vente (idempotent) --------------------------
insert into public.ota_channels (nom, commission_percentage, devise) values
  ('GetYourGuide DTS', 30, 'EUR')
on conflict (nom) do nothing;

-- ============================================================
--  LIGNES DE COÛT DE RÉFÉRENCE
-- ============================================================

-- ----- GYG-TDE-005 : Tunis / Bardo / Carthage (option transport)
insert into public.excursion_cost_lines
  (excursion_id, jour, categorie, type_depense, nom_depense, quantite, unite, prix_unitaire, devise, inclure_comptabilite)
select e.id, 1, v.cat, v.td, v.nom, 1, v.unite, v.pu, 'TND', true
from (values
  ('RESTAURANT','PAR_PERSONNE','Restaurant Monte Carlo', 'personne', 30),
  ('GUIDE',     'FIXE',        'Guide journée',          'forfait',  150),
  ('EXTRA',     'PAR_PERSONNE','Musée Bardo',            'personne', 30),
  ('EXTRA',     'PAR_PERSONNE','Carthage',               'personne', 20)
) as v(cat, td, nom, unite, pu)
join public.excursions e on e.code_interne = 'GYG-TDE-005'
where not exists (
  select 1 from public.excursion_cost_lines c
  where c.excursion_id = e.id and c.nom_depense = v.nom and c.jour = 1);

-- ----- GYG-TDE-003 : Djerba cheval / dromadaire / quad
insert into public.excursion_cost_lines
  (excursion_id, jour, categorie, type_depense, nom_depense, quantite, unite, prix_unitaire, devise, inclure_comptabilite)
select e.id, 1, v.cat, v.td, v.nom, 1, v.unite, v.pu, 'TND', true
from (values
  ('RESTAURANT','PAR_PERSONNE','Restaurant Port Aghir', 'personne', 30),
  ('EXTRA',     'PAR_PERSONNE','Caravane Djerba',       'personne', 40),
  ('EXTRA',     'PAR_VEHICULE','Quad',                  'vehicule', 60)
) as v(cat, td, nom, unite, pu)
join public.excursions e on e.code_interne = 'GYG-TDE-003'
where not exists (
  select 1 from public.excursion_cost_lines c
  where c.excursion_id = e.id and c.nom_depense = v.nom and c.jour = 1);

-- ----- GYG-TDE-006 : coucher de soleil désert
insert into public.excursion_cost_lines
  (excursion_id, jour, categorie, type_depense, nom_depense, quantite, unite, prix_unitaire, devise, inclure_comptabilite)
select e.id, 1, v.cat, v.td, v.nom, 1, v.unite, v.pu, 'TND', true
from (values
  ('TRANSPORT', 'PAR_VEHICULE','4x4 coucher soleil (cap 6)', 'vehicule', 450),
  ('GUIDE',     'FIXE',        'Guide journée',              'forfait',  150),
  ('RESTAURANT','PAR_PERSONNE','Dîner Sahara Lounge',        'personne', 15)
) as v(cat, td, nom, unite, pu)
join public.excursions e on e.code_interne = 'GYG-TDE-006'
where not exists (
  select 1 from public.excursion_cost_lines c
  where c.excursion_id = e.id and c.nom_depense = v.nom and c.jour = 1);

-- ----- GYG-TDE-008 : Kairouan demi-journée
insert into public.excursion_cost_lines
  (excursion_id, jour, categorie, type_depense, nom_depense, quantite, unite, prix_unitaire, devise, inclure_comptabilite)
select e.id, 1, v.cat, v.td, v.nom, 1, v.unite, v.pu, 'TND', true
from (values
  ('GUIDE','FIXE',        'Guide demi-journée',      'forfait',  100),
  ('EXTRA','PAR_PERSONNE','Entrée sites Kairouan',   'personne', 20)
) as v(cat, td, nom, unite, pu)
join public.excursions e on e.code_interne = 'GYG-TDE-008'
where not exists (
  select 1 from public.excursion_cost_lines c
  where c.excursion_id = e.id and c.nom_depense = v.nom and c.jour = 1);

-- ----- GYG-TDE-009 : El Jem depuis Sousse
insert into public.excursion_cost_lines
  (excursion_id, jour, categorie, type_depense, nom_depense, quantite, unite, prix_unitaire, devise, inclure_comptabilite)
select e.id, 1, v.cat, v.td, v.nom, 1, v.unite, v.pu, 'TND', true
from (values
  ('GUIDE','FIXE',        'Guide demi-journée', 'forfait',  100),
  ('EXTRA','PAR_PERSONNE','Ticket El Jem',      'personne', 20)
) as v(cat, td, nom, unite, pu)
join public.excursions e on e.code_interne = 'GYG-TDE-009'
where not exists (
  select 1 from public.excursion_cost_lines c
  where c.excursion_id = e.id and c.nom_depense = v.nom and c.jour = 1);

-- ----- GYG-TT-002 : 2 jours désert — 3 variantes SM / HAM / TUN
insert into public.excursion_cost_lines
  (excursion_id, jour, categorie, type_depense, nom_depense, quantite, unite, prix_unitaire, devise, inclure_comptabilite)
select e.id, v.jour, v.cat, v.td, v.nom, 1, v.unite, v.pu, 'TND', true
from (values
  (1,'GUIDE',      'FIXE',        'Guide extra 2 jours',       'forfait',  300),
  (1,'RESTAURANT', 'PAR_PERSONNE','Restaurant Sidi Idriss',    'personne', 15),
  (1,'HEBERGEMENT','PAR_PERSONNE','Camp Dunes Insolites',      'personne', 90),
  (2,'RESTAURANT', 'PAR_PERSONNE','Restaurant Les Jardins',    'personne', 15)
) as v(jour, cat, td, nom, unite, pu)
cross join (values ('GYG-TT-002-SM'),('GYG-TT-002-HAM'),('GYG-TT-002-TUN')) as codes(code)
join public.excursions e on e.code_interne = codes.code
where not exists (
  select 1 from public.excursion_cost_lines c
  where c.excursion_id = e.id and c.nom_depense = v.nom and c.jour = v.jour);

-- ----- GYG-TT-003 : Tataouine / Chenini
insert into public.excursion_cost_lines
  (excursion_id, jour, categorie, type_depense, nom_depense, quantite, unite, prix_unitaire, devise, inclure_comptabilite)
select e.id, 1, v.cat, v.td, v.nom, 1, v.unite, v.pu, 'TND', true
from (values
  ('GUIDE',     'FIXE',        'Guide journée',       'forfait',  150),
  ('RESTAURANT','PAR_PERSONNE','Restaurant El Borj',  'personne', 15),
  ('EXTRA',     'PAR_PERSONNE','Ksar Hadada',         'personne', 3)
) as v(cat, td, nom, unite, pu)
join public.excursions e on e.code_interne = 'GYG-TT-003'
where not exists (
  select 1 from public.excursion_cost_lines c
  where c.excursion_id = e.id and c.nom_depense = v.nom and c.jour = 1);

-- ----- GYG-TT-012 : Ksar Ghilane & Tataouine 1 journée
insert into public.excursion_cost_lines
  (excursion_id, jour, categorie, type_depense, nom_depense, quantite, unite, prix_unitaire, devise, inclure_comptabilite)
select e.id, 1, v.cat, v.td, v.nom, 1, v.unite, v.pu, 'TND', true
from (values
  ('GUIDE',     'FIXE',        'Guide journée',        'forfait',  150),
  ('RESTAURANT','PAR_PERSONNE','Restaurant Sahara Lounge','personne', 15),
  ('EXTRA',     'PAR_PERSONNE','Camel Ride',           'personne', 20),
  ('EXTRA',     'PAR_VEHICULE','Quad',                 'vehicule', 45)
) as v(cat, td, nom, unite, pu)
join public.excursions e on e.code_interne = 'GYG-TT-012'
where not exists (
  select 1 from public.excursion_cost_lines c
  where c.excursion_id = e.id and c.nom_depense = v.nom and c.jour = 1);

-- ============================================================
--  HISTORIQUE DES COÛTS (module IA)
--  Hausse Restaurant Sidi Idriss : 15 -> 18 DT
-- ============================================================
insert into public.cost_history (categorie, reference_id, ancien_prix, nouveau_prix, date)
select 'RESTAURANT', r.id, 15, 18, timestamptz '2026-01-01 00:00:00+00'
from public.restaurants r
where r.nom = 'Sidi Idriss'
  and not exists (
    select 1 from public.cost_history h
    where h.categorie = 'RESTAURANT' and h.reference_id = r.id
      and h.ancien_prix = 15 and h.nouveau_prix = 18);

-- Variante enfant Sidi Idriss : 7.5 -> 9 DT
insert into public.cost_history (categorie, reference_id, ancien_prix, nouveau_prix, date)
select 'RESTAURANT', r.id, 7.5, 9, timestamptz '2026-01-01 00:00:00+00'
from public.restaurants r
where r.nom = 'Sidi Idriss'
  and not exists (
    select 1 from public.cost_history h
    where h.categorie = 'RESTAURANT' and h.reference_id = r.id
      and h.ancien_prix = 7.5 and h.nouveau_prix = 9);

-- >>>>>>>>>>>>>>>>>> compta_partenaires.sql <<<<<<<<<<<<<<<<<<

-- ============================================================
--  DTS OPERATION ERP — Relevé comptable par prestataire
--  Relie chaque ligne de coût à son partenaire réel (restaurant,
--  hébergement, extra) pour agréger la consommation par prestataire.
--  À exécuter APRÈS erp.sql / seed.sql / seed_dts.sql. Idempotent.
-- ============================================================

-- Lien ligne de coût -> partenaire
alter table public.excursion_cost_lines
  add column if not exists partner_type text;  -- RESTAURANT | HEBERGEMENT | EXTRA
alter table public.excursion_cost_lines
  add column if not exists partner_id uuid;

create index if not exists cost_lines_partner_idx
  on public.excursion_cost_lines (partner_type, partner_id);

-- ----- Rattachement automatique par nom (données seedées) ---
-- RESTAURANT : la ligne "Restaurant Sidi Idriss" -> restaurant "Sidi Idriss"
update public.excursion_cost_lines c
set partner_type = 'RESTAURANT', partner_id = r.id
from public.restaurants r
where c.categorie = 'RESTAURANT'
  and c.partner_id is null
  and c.nom_depense ilike '%' || r.nom || '%';

-- HEBERGEMENT : "Camp Sahara Lounge" -> accommodation "Sahara Lounge"
update public.excursion_cost_lines c
set partner_type = 'HEBERGEMENT', partner_id = a.id
from public.accommodations a
where c.categorie = 'HEBERGEMENT'
  and c.partner_id is null
  and c.nom_depense ilike '%' || a.nom || '%';

-- EXTRA : "Ticket El Jem" -> extra "Ticket El Jem"
update public.excursion_cost_lines c
set partner_type = 'EXTRA', partner_id = e.id
from public.extras e
where c.categorie = 'EXTRA'
  and c.partner_id is null
  and c.nom_depense ilike '%' || e.nom || '%';

-- Astuce : pour les lignes ajoutées ensuite, renseigne partner_type/partner_id
-- à la création afin qu'elles apparaissent dans le relevé du prestataire.
