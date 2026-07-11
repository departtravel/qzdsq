-- ============================================================
-- DTS OPERATION ERP — INSTALLATION / RÉPARATION TOTALE
-- UN SEUL fichier. Supabase > SQL Editor > Run without RLS. Ré-exécutable.
-- ============================================================

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>> schema.sql <<<<<<<<<<<<<<<<<<<<<<<<<<<<

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

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>> erp.sql <<<<<<<<<<<<<<<<<<<<<<<<<<<<

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

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>> rbac.sql <<<<<<<<<<<<<<<<<<<<<<<<<<<<

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
      if r not in ('OPERATIONS','LOGISTIQUE') then
        raise exception 'Seuls OPERATIONS (Hersi) ou LOGISTIQUE (Karima) peuvent mettre en opération';
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
  using (public.is_admin());  -- ADMIN uniquement

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
--     via is_admin() => ADMIN)
do $$
declare t text;
begin
  foreach t in array array['excursions','excursion_options','excursion_cost_lines','ota_channels','exchange_rates'] loop
    execute format('drop policy if exists %I_write on public.%I;', t, t);
    execute format(
      'create policy %I_write on public.%I for all using (public.is_admin()) with check (public.is_admin());',
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

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>> missions.sql <<<<<<<<<<<<<<<<<<<<<<<<<<<<

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

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>> settings.sql <<<<<<<<<<<<<<<<<<<<<<<<<<<<

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
  using (public.is_admin()) with check (public.is_admin()); -- ADMIN seulement

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>> sorties.sql <<<<<<<<<<<<<<<<<<<<<<<<<<<<

-- ============================================================
--  DTS OPERATION ERP — Sorties (départs) & extras par réservation
--  À exécuter après erp.sql / rbac.sql. Idempotent.
--
--  Modèle : plusieurs RÉSERVATIONS (bookings) du même produit et
--  de la même date sont regroupées en une SORTIE (departure) à
--  laquelle on affecte un guide + un transport/véhicule.
-- ============================================================

-- ----- Sorties (départs opérationnels) ----------------------
create table if not exists public.departures (
  id           uuid primary key default gen_random_uuid(),
  date         date not null,
  excursion_id uuid references public.excursions(id) on delete set null,
  guide_id     uuid references public.guides(id) on delete set null,
  vehicle_id   uuid references public.erp_vehicles(id) on delete set null,
  driver_id    uuid references public.chauffeurs(id) on delete set null,
  transport_id uuid references public.transports(id) on delete set null,
  statut       text not null default 'PLANIFIEE', -- PLANIFIEE | CONFIRMEE | TERMINEE | ANNULEE
  notes        text,
  created_at   timestamptz not null default now()
);
create index if not exists departures_date_idx on public.departures (date);

-- Lien réservation -> sortie
alter table public.bookings
  add column if not exists departure_id uuid references public.departures(id) on delete set null;

-- ----- Extras choisis par réservation -----------------------
create table if not exists public.booking_extras (
  id         uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  extra_id   uuid not null references public.extras(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (booking_id, extra_id)
);
create index if not exists booking_extras_booking_idx on public.booking_extras (booking_id);

-- ----- RLS --------------------------------------------------
alter table public.departures enable row level security;
drop policy if exists departures_read on public.departures;
create policy departures_read on public.departures
  for select using (auth.role() = 'authenticated');
drop policy if exists departures_write on public.departures;
create policy departures_write on public.departures for all
  using (public.has_erp_role('OPERATIONS','LOGISTIQUE'))
  with check (public.has_erp_role('OPERATIONS','LOGISTIQUE'));

alter table public.booking_extras enable row level security;
drop policy if exists booking_extras_read on public.booking_extras;
create policy booking_extras_read on public.booking_extras
  for select using (auth.role() = 'authenticated');
drop policy if exists booking_extras_write on public.booking_extras;
create policy booking_extras_write on public.booking_extras for all
  using (public.has_erp_role('RESERVATION','CONFIRMATION','OPERATIONS','LOGISTIQUE'))
  with check (public.has_erp_role('RESERVATION','CONFIRMATION','OPERATIONS','LOGISTIQUE'));

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>> flotte_erp.sql <<<<<<<<<<<<<<<<<<<<<<<<<<<<

-- ============================================================
--  DTS OPERATION ERP — Flotte : places & mode de possession
--  À exécuter après schema.sql. Idempotent.
-- ============================================================
alter table public.vehicles add column if not exists places integer check (places >= 0);
alter table public.vehicles add column if not exists mode_possession text;
  -- PROPRIETE | LOCATION_LONGUE_DUREE | LOCATION_EXCURSION
alter table public.vehicles add column if not exists leasing_mensuel numeric check (leasing_mensuel >= 0);
  -- si PROPRIETE (mensualité de leasing/crédit, 0 si payé)
alter table public.vehicles add column if not exists loyer_mensuel numeric check (loyer_mensuel >= 0);
  -- si LOCATION_LONGUE_DUREE (prix par mois)
alter table public.vehicles add column if not exists tarif_excursion numeric check (tarif_excursion >= 0);
  -- si LOCATION_EXCURSION (tarif par sortie)

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>> compta_partenaires.sql <<<<<<<<<<<<<<<<<<<<<<<<<<<<

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

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>> charges_fixes.sql <<<<<<<<<<<<<<<<<<<<<<<<<<<<

-- ============================================================
--  DTS OPERATION ERP — CHARGES FIXES (frais généraux)
--  À exécuter après schema.sql / erp.sql / rbac.sql. Idempotent.
--
--  Toutes les charges récurrentes de l'agence : salaires, parc,
--  leasings, loyer, taxes & assurances véhicules (par véhicule),
--  assurance FTAV, visites techniques, internet, abonnements,
--  site web, cartes autoroute, etc.
-- ============================================================
create table if not exists public.fixed_charges (
  id           uuid primary key default gen_random_uuid(),
  libelle      text not null,
  categorie    text not null,
    -- SALAIRE | PARC | LEASING | LOYER | TAXE_VEHICULE | ASSURANCE_VEHICULE
    -- | ASSURANCE_FTAV | VISITE_TECHNIQUE | CARBURANT | INTERNET | ABONNEMENT
    -- | SITE_WEB | CARTE_AUTOROUTE | AUTRE
  montant      numeric not null check (montant >= 0),
  periodicite  text not null default 'MENSUEL',  -- MENSUEL | ANNUEL | TRIMESTRIEL | PONCTUEL
  vehicle_id   uuid references public.vehicles(id) on delete set null, -- si liée à un véhicule
  date_debut   date,
  date_fin     date,
  actif        boolean not null default true,
  note         text,
  created_at   timestamptz not null default now()
);
create index if not exists fixed_charges_vehicle_idx on public.fixed_charges (vehicle_id);
create index if not exists fixed_charges_cat_idx on public.fixed_charges (categorie);

alter table public.fixed_charges enable row level security;
drop policy if exists fixed_charges_read on public.fixed_charges;
create policy fixed_charges_read on public.fixed_charges
  for select using (auth.role() = 'authenticated');
drop policy if exists fixed_charges_write on public.fixed_charges;
create policy fixed_charges_write on public.fixed_charges for all
  using (public.has_erp_role('COMPTABLE'))
  with check (public.has_erp_role('COMPTABLE'));

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>> compta_auto.sql <<<<<<<<<<<<<<<<<<<<<<<<<<<<

-- ============================================================
--  DTS OPERATION ERP — COMPTA AUTOMATIQUE (moteur de facturation)
--  À exécuter après erp.sql / rbac.sql / sorties.sql / compta_partenaires.sql.
--  Idempotent.
--
--  Principe : chaque SORTIE (departure) génère automatiquement les
--  FACTURES fournisseurs de tous les prestataires réellement utilisés :
--    - Guide EXTRA        -> guide_prices selon la durée
--    - Chauffeur EXTRA    -> chauffeurs.tarif_jour × nb jours
--    - Transport (loc.)   -> transports.tarif_sortie
--    - Restaurant/Hôtel/Camp/Extra -> charges du produit × pax de la sortie
--  Les salariés (guide/chauffeur SALARIE) ne génèrent PAS de facture.
--  Recalcul auto à chaque changement de la sortie ou de ses réservations.
-- ============================================================

-- ---- 1) Unifier la notion d'admin (role='admin' OU erp_role='ADMIN') ----
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and (role = 'admin' or erp_role = 'ADMIN')
  );
$$;

-- ---- 2) Corriger quelques RLS trop strictes ----
drop policy if exists ota_imports_write on public.ota_imports;
create policy ota_imports_write on public.ota_imports for all
  using (public.has_erp_role('RESERVATION','OPERATIONS','LOGISTIQUE'))
  with check (public.has_erp_role('RESERVATION','OPERATIONS','LOGISTIQUE'));

drop policy if exists cost_history_write on public.cost_history;
create policy cost_history_write on public.cost_history for all
  using (public.has_erp_role('OPERATIONS','LOGISTIQUE','COMPTABLE'))
  with check (public.has_erp_role('OPERATIONS','LOGISTIQUE','COMPTABLE'));

-- COMPTABLE peut marquer une réservation (facturation)
drop policy if exists bookings_update on public.bookings;
create policy bookings_update on public.bookings for update
  using (public.has_erp_role('RESERVATION','CONFIRMATION','OPERATIONS','LOGISTIQUE','COMPTABLE'))
  with check (public.has_erp_role('RESERVATION','CONFIRMATION','OPERATIONS','LOGISTIQUE','COMPTABLE'));

-- ---- 3) Tarifs opérationnels manquants ----
alter table public.chauffeurs add column if not exists tarif_jour numeric not null default 0 check (tarif_jour >= 0);
alter table public.transports add column if not exists tarif_sortie numeric not null default 0 check (tarif_sortie >= 0);
-- Montant transport saisi manuellement pour une sortie (location journalière),
-- modifiable. Prioritaire sur le tarif du transporteur.
alter table public.departures add column if not exists transport_cout numeric check (transport_cout >= 0);
alter table public.departures add column if not exists transport_mode text; -- PARC | LONGUE_DUREE | JOURNALIERE

-- ---- 4) Lien prestataire -> fournisseur (suppliers) ----
alter table public.suppliers add column if not exists ref_type text;  -- GUIDE|CHAUFFEUR|TRANSPORT|RESTAURANT|HEBERGEMENT|EXTRA
alter table public.suppliers add column if not exists ref_id   uuid;
create unique index if not exists suppliers_ref_uidx on public.suppliers (ref_type, ref_id) where ref_type is not null;

-- Trouve ou crée le fournisseur correspondant à un prestataire.
create or replace function public.ensure_supplier(p_type text, p_id uuid, p_nom text)
returns uuid language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  if p_id is null then return null; end if;
  select id into sid from public.suppliers where ref_type = p_type and ref_id = p_id;
  if sid is null then
    insert into public.suppliers (nom, type, ref_type, ref_id)
    values (coalesce(p_nom, p_type), p_type, p_type, p_id)
    returning id into sid;
  end if;
  return sid;
end $$;

-- Backfill : crée les fournisseurs pour les prestataires existants.
insert into public.suppliers (nom, type, ref_type, ref_id)
select trim(coalesce(g.nom,'')||' '||coalesce(g.prenom,'')), 'GUIDE', 'GUIDE', g.id
from public.guides g
where not exists (select 1 from public.suppliers s where s.ref_type='GUIDE' and s.ref_id=g.id);
insert into public.suppliers (nom, type, ref_type, ref_id)
select trim(coalesce(c.nom,'')||' '||coalesce(c.prenom,'')), 'CHAUFFEUR', 'CHAUFFEUR', c.id
from public.chauffeurs c
where not exists (select 1 from public.suppliers s where s.ref_type='CHAUFFEUR' and s.ref_id=c.id);
insert into public.suppliers (nom, type, ref_type, ref_id)
select t.nom, 'TRANSPORT', 'TRANSPORT', t.id
from public.transports t
where not exists (select 1 from public.suppliers s where s.ref_type='TRANSPORT' and s.ref_id=t.id);
insert into public.suppliers (nom, type, ref_type, ref_id)
select r.nom, 'RESTAURANT', 'RESTAURANT', r.id
from public.restaurants r
where not exists (select 1 from public.suppliers s where s.ref_type='RESTAURANT' and s.ref_id=r.id);
insert into public.suppliers (nom, type, ref_type, ref_id)
select a.nom, 'HEBERGEMENT', 'HEBERGEMENT', a.id
from public.accommodations a
where not exists (select 1 from public.suppliers s where s.ref_type='HEBERGEMENT' and s.ref_id=a.id);
insert into public.suppliers (nom, type, ref_type, ref_id)
select e.nom, 'EXTRA', 'EXTRA', e.id
from public.extras e
where not exists (select 1 from public.suppliers s where s.ref_type='EXTRA' and s.ref_id=e.id);

-- Auto-création du fournisseur quand on ajoute un prestataire.
create or replace function public.tg_supplier_from_partner()
returns trigger language plpgsql security definer set search_path = public as $$
declare nom text; typ text;
begin
  typ := tg_argv[0];
  if typ in ('GUIDE','CHAUFFEUR') then
    nom := trim(coalesce(new.nom,'')||' '||coalesce(new.prenom,''));
  else
    nom := new.nom;
  end if;
  perform public.ensure_supplier(typ, new.id, nom);
  return new;
end $$;

do $$ begin
  perform 1;
  -- (re)crée les triggers d'auto-création
end $$;
drop trigger if exists sup_guide on public.guides;
create trigger sup_guide after insert on public.guides for each row execute function public.tg_supplier_from_partner('GUIDE');
drop trigger if exists sup_chauffeur on public.chauffeurs;
create trigger sup_chauffeur after insert on public.chauffeurs for each row execute function public.tg_supplier_from_partner('CHAUFFEUR');
drop trigger if exists sup_transport on public.transports;
create trigger sup_transport after insert on public.transports for each row execute function public.tg_supplier_from_partner('TRANSPORT');
drop trigger if exists sup_resto on public.restaurants;
create trigger sup_resto after insert on public.restaurants for each row execute function public.tg_supplier_from_partner('RESTAURANT');
drop trigger if exists sup_accom on public.accommodations;
create trigger sup_accom after insert on public.accommodations for each row execute function public.tg_supplier_from_partner('HEBERGEMENT');
drop trigger if exists sup_extra on public.extras;
create trigger sup_extra after insert on public.extras for each row execute function public.tg_supplier_from_partner('EXTRA');

-- ---- 5) Recalcul des factures auto d'une sortie ----
create or replace function public.recompute_departure_costs(p_departure uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  d record; exc record;
  ad int; en int; pax int; jours int;
  gtar numeric; sid uuid; cl record; nomsortie text;
begin
  select * into d from public.departures where id = p_departure;
  if not found then return; end if;

  -- Purge des factures auto NON validées uniquement (les factures VALIDEE/PAYEE
  -- par le responsable facturation sont figées et ne sont jamais réécrites).
  delete from public.supplier_transactions
   where reference like 'AUTO:'||p_departure::text||':%'
     and statut = 'EN_ATTENTE';
  -- Les factures ne sont émises qu'une fois la sortie CONFIRMÉE (ou en cours / terminée).
  -- Tant qu'elle est PLANIFIEE ou ANNULEE : pas de facture.
  if d.statut not in ('CONFIRMEE','EN_OPERATION','TERMINEE') then return; end if;

  -- Pax = uniquement les réservations CONFIRMÉES et plus (pas les NOUVELLE).
  select coalesce(sum(nombre_adultes),0), coalesce(sum(nombre_enfants),0)
    into ad, en from public.bookings
    where departure_id = p_departure
      and statut not in ('NOUVELLE','ANNULEE');
  pax := ad + en;
  if pax = 0 then return; end if;

  select * into exc from public.excursions where id = d.excursion_id;
  jours := coalesce(exc.nombre_jours, 1);
  nomsortie := 'Sortie '||coalesce(exc.nom,'')||' du '||coalesce(d.date::text,'');

  -- GUIDE (extra uniquement)
  if d.guide_id is not null then
    perform 1 from public.guides where id = d.guide_id and type_guide = 'EXTRA';
    if found then
      select case when jours >= 2 then deux_jours when exc.duree ilike 'demi%' then demi_journee else journee end
        into gtar from public.guide_prices where guide_id = d.guide_id order by date_application desc limit 1;
      if gtar is null then
        select case when jours >= 2 then deux_jours when exc.duree ilike 'demi%' then demi_journee else journee end
          into gtar from public.guide_prices where guide_id is null order by date_application desc limit 1;
      end if;
      sid := public.ensure_supplier('GUIDE', d.guide_id,
        (select trim(coalesce(nom,'')||' '||coalesce(prenom,'')) from public.guides where id = d.guide_id));
      insert into public.supplier_transactions (supplier_id, date, type_operation, montant, reference, description, statut)
      select sid, d.date, 'FACTURE', coalesce(gtar,0), 'AUTO:'||p_departure||':GUIDE', nomsortie||' — guide', 'EN_ATTENTE'
      where not exists (select 1 from public.supplier_transactions t where t.reference = 'AUTO:'||p_departure||':GUIDE');
    end if;
  end if;

  -- CHAUFFEUR (extra uniquement) : tarif_jour × jours
  if d.driver_id is not null then
    perform 1 from public.chauffeurs where id = d.driver_id and type_chauffeur = 'EXTRA';
    if found then
      sid := public.ensure_supplier('CHAUFFEUR', d.driver_id,
        (select trim(coalesce(nom,'')||' '||coalesce(prenom,'')) from public.chauffeurs where id = d.driver_id));
      insert into public.supplier_transactions (supplier_id, date, type_operation, montant, reference, description, statut)
      select sid, d.date, 'FACTURE', coalesce(tarif_jour,0) * jours, 'AUTO:'||p_departure||':CHAUFFEUR',
             nomsortie||' — chauffeur ('||jours||' j)', 'EN_ATTENTE'
      from public.chauffeurs where id = d.driver_id
        and not exists (select 1 from public.supplier_transactions t where t.reference = 'AUTO:'||p_departure||':CHAUFFEUR');
    end if;
  end if;

  -- TRANSPORT : location journalière = montant saisi (transport_cout),
  -- sinon tarif du transporteur. Parc/longue durée = pas de facture par sortie
  -- (coût interne / mensuel géré ailleurs) sauf si un montant est saisi.
  if d.transport_id is not null then
    sid := public.ensure_supplier('TRANSPORT', d.transport_id,
      (select nom from public.transports where id = d.transport_id));
    insert into public.supplier_transactions (supplier_id, date, type_operation, montant, reference, description, statut)
    select sid, d.date, 'FACTURE',
           coalesce(d.transport_cout, (select tarif_sortie from public.transports where id = d.transport_id), 0),
           'AUTO:'||p_departure||':TRANSPORT',
           nomsortie||' — transport'||coalesce(' ('||d.transport_mode||')',''), 'EN_ATTENTE'
    where coalesce(d.transport_cout, (select tarif_sortie from public.transports where id = d.transport_id), 0) > 0
      and not exists (select 1 from public.supplier_transactions t where t.reference = 'AUTO:'||p_departure||':TRANSPORT');
  end if;

  -- RESTAURANTS / HÉBERGEMENTS / EXTRAS via les charges du produit × pax
  for cl in
    select * from public.excursion_cost_lines
    where excursion_id = d.excursion_id
      and partner_type in ('RESTAURANT','HEBERGEMENT','EXTRA')
      and partner_id is not null
      and inclure_comptabilite = true
  loop
    sid := public.ensure_supplier(cl.partner_type, cl.partner_id, cl.nom_depense);
    insert into public.supplier_transactions (supplier_id, date, type_operation, montant, reference, description, statut)
    select
      sid, d.date, 'FACTURE',
      case
        when cl.type_depense in ('PAR_GROUPE','FIXE') then cl.prix_unitaire * cl.quantite
        else cl.prix_unitaire * cl.quantite * pax
      end,
      'AUTO:'||p_departure||':CL:'||cl.id,
      nomsortie||' — '||cl.nom_depense||' ('||pax||' pax)',
      'EN_ATTENTE'
    where not exists (select 1 from public.supplier_transactions t where t.reference = 'AUTO:'||p_departure||':CL:'||cl.id);
  end loop;
end $$;

-- ---- 6) Déclencheurs ----
create or replace function public.tg_departure_recompute()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.recompute_departure_costs(new.id);
  return new;
end $$;
drop trigger if exists departure_recompute on public.departures;
create trigger departure_recompute after insert or update on public.departures
  for each row execute function public.tg_departure_recompute();

-- Recalcule la sortie quand une réservation y est rattachée/détachée ou change d'effectif.
create or replace function public.tg_booking_recompute()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.departure_id is not null then perform public.recompute_departure_costs(old.departure_id); end if;
    return old;
  end if;
  if new.departure_id is not null then perform public.recompute_departure_costs(new.departure_id); end if;
  if tg_op = 'UPDATE' and old.departure_id is not null and old.departure_id is distinct from new.departure_id then
    perform public.recompute_departure_costs(old.departure_id);
  end if;
  return new;
end $$;
drop trigger if exists booking_recompute on public.bookings;
create trigger booking_recompute after insert or update or delete on public.bookings
  for each row execute function public.tg_booking_recompute();

-- Purge des factures auto quand une sortie est supprimée.
create or replace function public.tg_departure_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.supplier_transactions where reference like 'AUTO:'||old.id::text||':%';
  return old;
end $$;
drop trigger if exists departure_delete on public.departures;
create trigger departure_delete after delete on public.departures
  for each row execute function public.tg_departure_delete();

-- Index de performance (moteur très trigger-dépendant).
create index if not exists bookings_departure_idx on public.bookings (departure_id);
create index if not exists supplier_txn_supplier_idx on public.supplier_transactions (supplier_id);
create index if not exists supplier_txn_ref_idx on public.supplier_transactions (reference);

-- ---- 7) Solde fournisseur maintenu automatiquement ----
create or replace function public.recompute_supplier_solde(p_supplier uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  -- FACTURE augmente la dette ; PAIEMENT, AVANCE et CREDIT (avoir) la diminuent.
  update public.suppliers s set solde_actuel = coalesce((
    select sum(case when type_operation = 'FACTURE' then montant
                    when type_operation in ('PAIEMENT','AVANCE','CREDIT') then -montant
                    else 0 end)
    from public.supplier_transactions t where t.supplier_id = p_supplier), 0)
  where s.id = p_supplier;
end $$;

create or replace function public.tg_txn_solde()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.recompute_supplier_solde(coalesce(new.supplier_id, old.supplier_id));
  return null;
end $$;
drop trigger if exists txn_solde on public.supplier_transactions;
create trigger txn_solde after insert or update or delete on public.supplier_transactions
  for each row execute function public.tg_txn_solde();

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>> tva.sql <<<<<<<<<<<<<<<<<<<<<<<<<<<<

-- ============================================================
--  DTS OPERATION ERP — TVA (montants TTC) & numérotation factures
--  À exécuter après maj_finale.sql. Idempotent.
--
--  Hypothèse : tous les tarifs saisis sont TTC (TVA incluse).
--  On isole la part HT et la part TVA au taux configuré (défaut 19 %).
--  Décomposition indicative — le régime réel (TVA sur marge pour agence
--  réceptive) est à valider avec votre comptable.
-- ============================================================

-- Taux de TVA global (paramètre)
insert into public.app_settings (key, value) values ('tva_taux', '19')
on conflict (key) do nothing;

-- Un fournisseur assujetti à la TVA ouvre droit à TVA déductible sur ses factures.
alter table public.suppliers add column if not exists assujetti_tva boolean not null default false;

-- ---- Numérotation séquentielle des pièces (factures internes) ----
create sequence if not exists public.facture_seq start 1;

-- Numéro de facture attribué à une transaction fournisseur validée.
alter table public.supplier_transactions add column if not exists numero_piece text;
alter table public.supplier_transactions add column if not exists echeance date;

-- Attribue un numéro séquentiel (FAC-AAAA-000N) à la validation d'une facture.
create or replace function public.tg_numero_facture()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.type_operation = 'FACTURE'
     and new.statut = 'VALIDEE'
     and (old.statut is distinct from 'VALIDEE')
     and new.numero_piece is null then
    new.numero_piece := 'FAC-' || to_char(coalesce(new.date, current_date), 'YYYY') ||
                        '-' || lpad(nextval('public.facture_seq')::text, 5, '0');
  end if;
  return new;
end $$;
drop trigger if exists numero_facture on public.supplier_transactions;
create trigger numero_facture before update on public.supplier_transactions
  for each row execute function public.tg_numero_facture();

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>> tva_lignes.sql <<<<<<<<<<<<<<<<<<<<<<<<<<<<

-- ============================================================
--  DTS OPERATION ERP — TVA par ligne (prix TTC → HT + TVA)
--  À exécuter après tva.sql. Idempotent.
--  Chaque prix est saisi TTC avec son taux (19 % ou 7 %).
--  L'ERP extrait automatiquement la part HT et la part TVA.
-- ============================================================
alter table public.excursion_cost_lines
  add column if not exists taux_tva numeric not null default 19 check (taux_tva >= 0);

alter table public.fixed_charges
  add column if not exists taux_tva numeric not null default 19 check (taux_tva >= 0);

alter table public.extras
  add column if not exists taux_tva numeric not null default 19 check (taux_tva >= 0);

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>> departs_frais.sql <<<<<<<<<<<<<<<<<<<<<<<<<<<<

-- ============================================================
--  DTS OPERATION ERP — Frais partagés de la sortie
--  gasoil, parking, autoroute (péage) saisis par sortie et
--  divisés sur le nombre de personnes. À exécuter après sorties.sql.
--  Idempotent.
-- ============================================================
alter table public.departures add column if not exists gasoil  numeric not null default 0 check (gasoil >= 0);
alter table public.departures add column if not exists parking numeric not null default 0 check (parking >= 0);
alter table public.departures add column if not exists peage   numeric not null default 0 check (peage >= 0);

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>> prix_enfant.sql <<<<<<<<<<<<<<<<<<<<<<<<<<<<

-- ============================================================
--  DTS OPERATION ERP — Prix enfant distinct sur les charges
--  Une charge PAR_PERSONNE peut avoir un prix adulte (prix_unitaire)
--  ET un prix enfant (prix_enfant). Calcul :
--    prix_adulte × adultes + prix_enfant × enfants
--  À exécuter après maj_finale.sql. Idempotent.
-- ============================================================
alter table public.excursion_cost_lines
  add column if not exists prix_enfant numeric check (prix_enfant >= 0);

-- Recalcul compta : prix adulte × adultes + prix enfant × enfants.
create or replace function public.recompute_departure_costs(p_departure uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  d record; exc record;
  ad int; en int; pax int; jours int;
  gtar numeric; sid uuid; cl record; nomsortie text;
begin
  select * into d from public.departures where id = p_departure;
  if not found then return; end if;

  delete from public.supplier_transactions
   where reference like 'AUTO:'||p_departure::text||':%'
     and statut = 'EN_ATTENTE';
  if d.statut not in ('CONFIRMEE','EN_OPERATION','TERMINEE') then return; end if;

  select coalesce(sum(nombre_adultes),0), coalesce(sum(nombre_enfants),0)
    into ad, en from public.bookings
    where departure_id = p_departure
      and statut not in ('NOUVELLE','ANNULEE');
  pax := ad + en;
  if pax = 0 then return; end if;

  select * into exc from public.excursions where id = d.excursion_id;
  jours := coalesce(exc.nombre_jours, 1);
  nomsortie := 'Sortie '||coalesce(exc.nom,'')||' du '||coalesce(d.date::text,'');

  -- GUIDE (extra uniquement)
  if d.guide_id is not null then
    perform 1 from public.guides where id = d.guide_id and type_guide = 'EXTRA';
    if found then
      select case when jours >= 2 then deux_jours when exc.duree ilike 'demi%' then demi_journee else journee end
        into gtar from public.guide_prices where guide_id = d.guide_id order by date_application desc limit 1;
      if gtar is null then
        select case when jours >= 2 then deux_jours when exc.duree ilike 'demi%' then demi_journee else journee end
          into gtar from public.guide_prices where guide_id is null order by date_application desc limit 1;
      end if;
      sid := public.ensure_supplier('GUIDE', d.guide_id,
        (select trim(coalesce(nom,'')||' '||coalesce(prenom,'')) from public.guides where id = d.guide_id));
      insert into public.supplier_transactions (supplier_id, date, type_operation, montant, reference, description, statut)
      select sid, d.date, 'FACTURE', coalesce(gtar,0), 'AUTO:'||p_departure||':GUIDE', nomsortie||' — guide', 'EN_ATTENTE'
      where not exists (select 1 from public.supplier_transactions t where t.reference = 'AUTO:'||p_departure||':GUIDE');
    end if;
  end if;

  -- CHAUFFEUR (extra uniquement) : tarif_jour × jours
  if d.driver_id is not null then
    perform 1 from public.chauffeurs where id = d.driver_id and type_chauffeur = 'EXTRA';
    if found then
      sid := public.ensure_supplier('CHAUFFEUR', d.driver_id,
        (select trim(coalesce(nom,'')||' '||coalesce(prenom,'')) from public.chauffeurs where id = d.driver_id));
      insert into public.supplier_transactions (supplier_id, date, type_operation, montant, reference, description, statut)
      select sid, d.date, 'FACTURE', coalesce(tarif_jour,0) * jours, 'AUTO:'||p_departure||':CHAUFFEUR',
             nomsortie||' — chauffeur ('||jours||' j)', 'EN_ATTENTE'
      from public.chauffeurs where id = d.driver_id
        and not exists (select 1 from public.supplier_transactions t where t.reference = 'AUTO:'||p_departure||':CHAUFFEUR');
    end if;
  end if;

  -- TRANSPORT
  if d.transport_id is not null then
    sid := public.ensure_supplier('TRANSPORT', d.transport_id,
      (select nom from public.transports where id = d.transport_id));
    insert into public.supplier_transactions (supplier_id, date, type_operation, montant, reference, description, statut)
    select sid, d.date, 'FACTURE',
           coalesce(d.transport_cout, (select tarif_sortie from public.transports where id = d.transport_id), 0),
           'AUTO:'||p_departure||':TRANSPORT',
           nomsortie||' — transport'||coalesce(' ('||d.transport_mode||')',''), 'EN_ATTENTE'
    where coalesce(d.transport_cout, (select tarif_sortie from public.transports where id = d.transport_id), 0) > 0
      and not exists (select 1 from public.supplier_transactions t where t.reference = 'AUTO:'||p_departure||':TRANSPORT');
  end if;

  -- RESTAURANTS / HÉBERGEMENTS / EXTRAS : prix adulte × adultes + prix enfant × enfants
  for cl in
    select * from public.excursion_cost_lines
    where excursion_id = d.excursion_id
      and partner_type in ('RESTAURANT','HEBERGEMENT','EXTRA')
      and partner_id is not null
      and inclure_comptabilite = true
  loop
    sid := public.ensure_supplier(cl.partner_type, cl.partner_id, cl.nom_depense);
    insert into public.supplier_transactions (supplier_id, date, type_operation, montant, reference, description, statut)
    select
      sid, d.date, 'FACTURE',
      case
        when cl.type_depense in ('PAR_GROUPE','FIXE') then cl.prix_unitaire * cl.quantite
        else cl.prix_unitaire * cl.quantite * ad
             + coalesce(cl.prix_enfant, cl.prix_unitaire) * cl.quantite * en
      end,
      'AUTO:'||p_departure||':CL:'||cl.id,
      nomsortie||' — '||cl.nom_depense||' ('||ad||'A/'||en||'E)',
      'EN_ATTENTE'
    where not exists (select 1 from public.supplier_transactions t where t.reference = 'AUTO:'||p_departure||':CL:'||cl.id);
  end loop;
end $$;

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>> planning_refonte.sql <<<<<<<<<<<<<<<<<<<<<<<<<<<<

-- ============================================================
--  DTS OPERATION ERP — Refonte Planning
--  - ordre d'affichage des réservations (glisser-déposer)
--  - plusieurs GUIDES et plusieurs TRANSPORTS par départ
--    (chaque transport a son chauffeur + coût + mode)
--  - recalcul compta adapté
--  À exécuter après INSTALL_TOUT.sql. Idempotent.
-- ============================================================

alter table public.bookings add column if not exists ordre integer not null default 0;

-- Plusieurs guides par départ
create table if not exists public.departure_guides (
  id           uuid primary key default gen_random_uuid(),
  departure_id uuid not null references public.departures(id) on delete cascade,
  guide_id     uuid not null references public.guides(id) on delete cascade,
  unique (departure_id, guide_id)
);

-- Plusieurs transports par départ (chacun avec chauffeur, coût, mode)
create table if not exists public.departure_transports (
  id           uuid primary key default gen_random_uuid(),
  departure_id uuid not null references public.departures(id) on delete cascade,
  transport_id uuid references public.transports(id) on delete set null,
  vehicle_id   uuid references public.erp_vehicles(id) on delete set null,
  chauffeur_id uuid references public.chauffeurs(id) on delete set null,
  cout         numeric check (cout >= 0),
  mode         text,  -- PARC | LONGUE_DUREE | JOURNALIERE
  unique (departure_id, transport_id)
);

create index if not exists dep_guides_idx on public.departure_guides (departure_id);
create index if not exists dep_transports_idx on public.departure_transports (departure_id);

-- RLS
do $$
declare t text;
begin
  foreach t in array array['departure_guides','departure_transports'] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I_read on public.%I;', t, t);
    execute format('create policy %I_read on public.%I for select using (auth.role() = %L);', t, t, 'authenticated');
    execute format('drop policy if exists %I_write on public.%I;', t, t);
    execute format('create policy %I_write on public.%I for all using (public.has_erp_role(%L,%L)) with check (public.has_erp_role(%L,%L));',
      t, t, 'OPERATIONS','LOGISTIQUE','OPERATIONS','LOGISTIQUE');
  end loop;
end $$;

-- Backfill : migre les affectations simples existantes vers les tables de liaison.
insert into public.departure_guides (departure_id, guide_id)
select id, guide_id from public.departures d
where guide_id is not null
  and not exists (select 1 from public.departure_guides g where g.departure_id = d.id and g.guide_id = d.guide_id);

insert into public.departure_transports (departure_id, transport_id, vehicle_id, chauffeur_id, cout, mode)
select id, transport_id, vehicle_id, driver_id, transport_cout, transport_mode from public.departures d
where transport_id is not null
  and not exists (select 1 from public.departure_transports t where t.departure_id = d.id and t.transport_id = d.transport_id);

-- ============================================================
--  Recalcul compta : boucle sur les guides et transports du départ
-- ============================================================
create or replace function public.recompute_departure_costs(p_departure uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  d record; exc record;
  ad int; en int; pax int; jours int;
  gtar numeric; sid uuid; cl record; g record; tr record; bx record; nomsortie text;
begin
  select * into d from public.departures where id = p_departure;
  if not found then return; end if;

  delete from public.supplier_transactions
   where reference like 'AUTO:'||p_departure::text||':%' and statut = 'EN_ATTENTE';
  if d.statut not in ('CONFIRMEE','EN_OPERATION','TERMINEE') then return; end if;

  select coalesce(sum(nombre_adultes),0), coalesce(sum(nombre_enfants),0)
    into ad, en from public.bookings
    where departure_id = p_departure and statut not in ('NOUVELLE','ANNULEE');
  pax := ad + en;
  if pax = 0 then return; end if;

  select * into exc from public.excursions where id = d.excursion_id;
  jours := coalesce(exc.nombre_jours, 1);
  nomsortie := 'Sortie '||coalesce(exc.nom,'')||' du '||coalesce(d.date::text,'');

  -- GUIDES (extras) : un par ligne de departure_guides
  for g in select dg.guide_id from public.departure_guides dg where dg.departure_id = p_departure loop
    perform 1 from public.guides where id = g.guide_id and type_guide = 'EXTRA';
    if found then
      select case when jours >= 2 then deux_jours when exc.duree ilike 'demi%' then demi_journee else journee end
        into gtar from public.guide_prices where guide_id = g.guide_id order by date_application desc limit 1;
      if gtar is null then
        select case when jours >= 2 then deux_jours when exc.duree ilike 'demi%' then demi_journee else journee end
          into gtar from public.guide_prices where guide_id is null order by date_application desc limit 1;
      end if;
      sid := public.ensure_supplier('GUIDE', g.guide_id,
        (select trim(coalesce(nom,'')||' '||coalesce(prenom,'')) from public.guides where id = g.guide_id));
      insert into public.supplier_transactions (supplier_id, date, type_operation, montant, reference, description, statut)
      select sid, d.date, 'FACTURE', coalesce(gtar,0), 'AUTO:'||p_departure||':GUIDE:'||g.guide_id, nomsortie||' — guide', 'EN_ATTENTE'
      where not exists (select 1 from public.supplier_transactions t where t.reference = 'AUTO:'||p_departure||':GUIDE:'||g.guide_id);
    end if;
  end loop;

  -- TRANSPORTS + leur chauffeur : un par ligne de departure_transports
  for tr in select * from public.departure_transports where departure_id = p_departure loop
    if tr.transport_id is not null then
      sid := public.ensure_supplier('TRANSPORT', tr.transport_id, (select nom from public.transports where id = tr.transport_id));
      insert into public.supplier_transactions (supplier_id, date, type_operation, montant, reference, description, statut)
      select sid, d.date, 'FACTURE',
             coalesce(tr.cout, (select tarif_sortie from public.transports where id = tr.transport_id), 0),
             'AUTO:'||p_departure||':TRANSPORT:'||tr.transport_id, nomsortie||' — transport', 'EN_ATTENTE'
      where coalesce(tr.cout, (select tarif_sortie from public.transports where id = tr.transport_id), 0) > 0
        and not exists (select 1 from public.supplier_transactions t where t.reference = 'AUTO:'||p_departure||':TRANSPORT:'||tr.transport_id);
    end if;
    if tr.chauffeur_id is not null then
      perform 1 from public.chauffeurs where id = tr.chauffeur_id and type_chauffeur = 'EXTRA';
      if found then
        sid := public.ensure_supplier('CHAUFFEUR', tr.chauffeur_id,
          (select trim(coalesce(nom,'')||' '||coalesce(prenom,'')) from public.chauffeurs where id = tr.chauffeur_id));
        insert into public.supplier_transactions (supplier_id, date, type_operation, montant, reference, description, statut)
        select sid, d.date, 'FACTURE', coalesce(tarif_jour,0)*jours, 'AUTO:'||p_departure||':CHAUF:'||tr.chauffeur_id,
               nomsortie||' — chauffeur ('||jours||' j)', 'EN_ATTENTE'
        from public.chauffeurs where id = tr.chauffeur_id
          and not exists (select 1 from public.supplier_transactions t where t.reference = 'AUTO:'||p_departure||':CHAUF:'||tr.chauffeur_id);
      end if;
    end if;
  end loop;

  -- RESTAURANTS / HÉBERGEMENTS / EXTRAS : prix adulte × adultes + prix enfant × enfants
  for cl in
    select * from public.excursion_cost_lines
    where excursion_id = d.excursion_id and partner_type in ('RESTAURANT','HEBERGEMENT','EXTRA')
      and partner_id is not null and inclure_comptabilite = true
  loop
    sid := public.ensure_supplier(cl.partner_type, cl.partner_id, cl.nom_depense);
    insert into public.supplier_transactions (supplier_id, date, type_operation, montant, reference, description, statut)
    select sid, d.date, 'FACTURE',
      case when cl.type_depense in ('PAR_GROUPE','FIXE') then cl.prix_unitaire * cl.quantite
           else cl.prix_unitaire * cl.quantite * ad + coalesce(cl.prix_enfant, cl.prix_unitaire) * cl.quantite * en end,
      'AUTO:'||p_departure||':CL:'||cl.id, nomsortie||' — '||cl.nom_depense||' ('||ad||'A/'||en||'E)', 'EN_ATTENTE'
    where not exists (select 1 from public.supplier_transactions t where t.reference = 'AUTO:'||p_departure||':CL:'||cl.id);
  end loop;

  -- EXTRAS choisis sur les réservations (booking_extras) : une fiche
  -- fournisseur par extra, montant = prix d'achat × quantité, cumulé sur
  -- toutes les réservations confirmées du départ.
  for bx in
    select e.id as extra_id,
           coalesce(e.nom, 'Extra') as nom,
           e.prestataire_type as ptype,
           e.prestataire_id   as pid,
           sum(be.quantite * coalesce(e.prix_achat, 0)) as montant
      from public.booking_extras be
      join public.bookings b on b.id = be.booking_id
      join public.extras   e on e.id = be.extra_id
     where b.departure_id = p_departure
       and b.statut not in ('NOUVELLE','ANNULEE')
       and coalesce(e.inclure_comptabilite, true) = true
     group by e.id, e.nom, e.prestataire_type, e.prestataire_id
    having sum(be.quantite * coalesce(e.prix_achat, 0)) > 0
  loop
    -- Rattaché à un prestataire ? la fiche tombe chez CE prestataire
    -- (même fournisseur que ses autres coûts) ; sinon fournisseur propre à l'extra.
    if bx.pid is not null and bx.ptype is not null then
      sid := public.ensure_supplier(bx.ptype, bx.pid, public.prestataire_nom(bx.ptype, bx.pid));
    else
      sid := public.ensure_supplier('EXTRA', bx.extra_id, bx.nom);
    end if;
    insert into public.supplier_transactions (supplier_id, date, type_operation, montant, reference, description, statut)
    select sid, d.date, 'FACTURE', bx.montant,
      'AUTO:'||p_departure||':BX:'||bx.extra_id, nomsortie||' — '||bx.nom||' ('||ad||'A/'||en||'E)', 'EN_ATTENTE'
    where not exists (select 1 from public.supplier_transactions t where t.reference = 'AUTO:'||p_departure||':BX:'||bx.extra_id);
  end loop;
end $$;

-- Recalcul quand les guides/transports du départ changent
create or replace function public.tg_deplink_recompute()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.recompute_departure_costs(coalesce(new.departure_id, old.departure_id));
  return null;
end $$;
drop trigger if exists dep_guides_recompute on public.departure_guides;
create trigger dep_guides_recompute after insert or update or delete on public.departure_guides
  for each row execute function public.tg_deplink_recompute();
drop trigger if exists dep_transports_recompute on public.departure_transports;
create trigger dep_transports_recompute after insert or update or delete on public.departure_transports
  for each row execute function public.tg_deplink_recompute();

-- Recalcul quand les extras d'une réservation changent (ajout/retrait/quantité)
create or replace function public.tg_bookingextra_recompute()
returns trigger language plpgsql security definer set search_path = public as $$
declare dep uuid;
begin
  select departure_id into dep from public.bookings
   where id = coalesce(new.booking_id, old.booking_id);
  if dep is not null then perform public.recompute_departure_costs(dep); end if;
  return null;
end $$;
drop trigger if exists booking_extras_recompute on public.booking_extras;
create trigger booking_extras_recompute after insert or update or delete on public.booking_extras
  for each row execute function public.tg_bookingextra_recompute();

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>> reset_cash.sql <<<<<<<<<<<<<<<<<<<<<<<<<<<<

-- ============================================================
--  DTS OPERATION ERP — Suppression réservation & remise à zéro
--  À exécuter après compta_auto.sql. Idempotent.
-- ============================================================

-- Autoriser le rôle RESERVATION (Hiba) à supprimer une réservation
-- (en plus de l'ADMIN). La suppression met à jour la compta via les triggers.
drop policy if exists bookings_delete on public.bookings;
create policy bookings_delete on public.bookings for delete
  using (public.has_erp_role('RESERVATION'));

-- ---- Remise à zéro des données transactionnelles (« vider le cash ») ----
-- Efface réservations, sorties, factures/compta, planning, ordres de mission
-- et imports. CONSERVE le catalogue, les référentiels et les charges fixes.
-- Réservé au super administrateur.
create or replace function public.reset_cash()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Action réservée au super administrateur';
  end if;
  delete from public.bookings;            -- cascade booking_extras
  delete from public.departures;          -- purge des factures auto (trigger)
  delete from public.supplier_transactions;
  delete from public.mission_orders;
  delete from public.operation_planning;
  delete from public.ota_imports;
  update public.suppliers set solde_actuel = 0;
end $$;

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>> extras_quantite.sql <<<<<<<<<<<<<<<<<<<<<<<<<<<<

-- ============================================================
--  DTS OPERATION ERP — Quantité par extra choisi sur une réservation
--  Permet "1 quad, 2 dromadaires, 1 tente luxe" sur l'ordre de mission.
--  À exécuter après INSTALL_TOUT.sql. Idempotent.
-- ============================================================
alter table public.booking_extras
  add column if not exists quantite integer not null default 1 check (quantite >= 1);

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>> caisse.sql <<<<<<<<<<<<<<<<<<<<<<<<<<<<

-- ============================================================
--  DTS OPERATION ERP — CAISSE (espèces, multi-devises)
--  Séparée de la comptabilité fournisseurs. Encaissements et
--  dépenses en liquide, avec solde du jour par devise.
--  À exécuter après INSTALL_TOUT.sql. Idempotent.
-- ============================================================
create table if not exists public.cash_entries (
  id         uuid primary key default gen_random_uuid(),
  date       date not null default current_date,
  devise     text not null default 'TND',           -- TND | EUR | USD
  sens       text not null,                          -- ENCAISSEMENT | DEPENSE
  montant    numeric not null check (montant >= 0),
  libelle    text,
  categorie  text,                                   -- VENTE | AVANCE | ACHAT | SALAIRE | DIVERS ...
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists cash_entries_date_idx on public.cash_entries (date);
create index if not exists cash_entries_devise_idx on public.cash_entries (devise);

alter table public.cash_entries enable row level security;
drop policy if exists cash_entries_read on public.cash_entries;
create policy cash_entries_read on public.cash_entries
  for select using (auth.role() = 'authenticated');
drop policy if exists cash_entries_write on public.cash_entries;
create policy cash_entries_write on public.cash_entries for all
  using (public.has_erp_role('COMPTABLE'))
  with check (public.has_erp_role('COMPTABLE'));

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>> admin_config.sql <<<<<<<<<<<<<<<<<<<<<<<<<<<<

-- ============================================================
--  DTS OPERATION ERP — Mot de passe admin & nom des utilisateurs
--  À exécuter après INSTALL_TOUT.sql. Idempotent.
-- ============================================================

-- Nom affiché de chaque utilisateur (en plus de l'email)
alter table public.profiles add column if not exists full_name text;

-- Secrets réservés aux super admins (mot de passe maître des actions sensibles).
-- Lecture ET écriture uniquement pour les super admins (is_admin()).
create table if not exists public.admin_secrets (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);
insert into public.admin_secrets (key, value) values ('admin_password', '')
on conflict (key) do nothing;

alter table public.admin_secrets enable row level security;
drop policy if exists admin_secrets_read on public.admin_secrets;
create policy admin_secrets_read on public.admin_secrets
  for select using (public.is_admin());
drop policy if exists admin_secrets_write on public.admin_secrets;
create policy admin_secrets_write on public.admin_secrets
  for all using (public.is_admin()) with check (public.is_admin());

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>> prestataires_extras.sql <<<<<<<<<<<<<<<<<<<<<<<<<<<<

-- ============================================================
--  DTS OPERATION ERP — Fiches prestataires enrichies + extras liés
--  - Coordonnées & matricule fiscal sur tous les référentiels
--  - Un extra/supplément peut être RATTACHÉ à un prestataire :
--    la fiche comptabilité tombe alors chez CE prestataire
--    (ex : supplément single/tente de luxe -> hébergement ;
--     quad/dromadaire/4x4 -> le prestataire activité X),
--    à la même date et sur la même excursion.
--  À exécuter après INSTALL_TOUT.sql. Idempotent.
-- ============================================================

-- ---- Coordonnées & fiscalité sur chaque référentiel -----------
alter table public.guides         add column if not exists matricule_fiscal text;
alter table public.guides         add column if not exists adresse text;
alter table public.guides         add column if not exists email text;

alter table public.chauffeurs     add column if not exists matricule_fiscal text;
alter table public.chauffeurs     add column if not exists adresse text;
alter table public.chauffeurs     add column if not exists email text;

alter table public.restaurants    add column if not exists matricule_fiscal text;
alter table public.restaurants    add column if not exists adresse text;
alter table public.restaurants    add column if not exists email text;

alter table public.accommodations add column if not exists matricule_fiscal text;
alter table public.accommodations add column if not exists adresse text;
alter table public.accommodations add column if not exists email text;
alter table public.accommodations add column if not exists telephone text;

alter table public.transports     add column if not exists matricule_fiscal text;
alter table public.transports     add column if not exists adresse text;

alter table public.suppliers      add column if not exists matricule_fiscal text;
alter table public.suppliers      add column if not exists adresse text;
alter table public.suppliers      add column if not exists email text;

-- ---- Rattachement d'un extra à un prestataire -----------------
-- prestataire_id existe déjà ; on ajoute le TYPE pour savoir dans
-- quel référentiel il pointe (miroir de ensure_supplier).
alter table public.extras add column if not exists prestataire_type text;
  -- HEBERGEMENT | RESTAURANT | TRANSPORT | GUIDE | CHAUFFEUR | (null = extra autonome)

-- ---- Nom d'un prestataire (pour créer/retrouver le fournisseur) -
create or replace function public.prestataire_nom(p_type text, p_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select case p_type
    when 'HEBERGEMENT' then (select nom from public.accommodations where id = p_id)
    when 'RESTAURANT'  then (select nom from public.restaurants   where id = p_id)
    when 'TRANSPORT'   then (select nom from public.transports    where id = p_id)
    when 'GUIDE'       then (select trim(coalesce(nom,'')||' '||coalesce(prenom,'')) from public.guides where id = p_id)
    when 'CHAUFFEUR'   then (select trim(coalesce(nom,'')||' '||coalesce(prenom,'')) from public.chauffeurs where id = p_id)
    else null end
$$;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>> seed.sql <<<<<<<<<<<<<<<<<<<<<<<<<<<<

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

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>> seed_dts_catalogue.sql <<<<<<<<<<<<<<<<<<<<<<<<<<<<

-- ============================================================
--  DTS OPERATION ERP — Catalogue GetYourGuide DTS (Compte 3)
--  À exécuter dans Supabase > SQL Editor. Idempotent.
--  Prix en EUR. Commission 30 %, taux 3,34 (valeurs par défaut).
--  Les options multiples sont éclatées en produits distincts.
-- ============================================================
insert into public.excursions
  (code_interne, nom, ota_channel_id, compte_ota, ville_depart, duree, nombre_jours, prix_adulte, prix_enfant)
select v.code, v.nom, o.id, 'GetYourGuide DTS', v.ville, v.duree, v.jours, v.pa, v.pe
from (values
  ('GYG-DTS-001', 'Depuis Sousse : excursion express de 2 jours dans le Sahara', 'Sousse', '2 jours', 2, 135, 120),
  ('GYG-DTS-002', 'Depuis Hammamet : excursion express de 2 jours dans le Sahara', 'Hammamet', '2 jours', 2, 135, 125),
  ('GYG-DTS-003', 'Depuis Tunis : excursion express de 2 jours dans le Sahara', 'Tunis', '2 jours', 2, 175, 100),
  ('GYG-DTS-004', 'Expérience premium dans le Sahara', 'Tunis', '2 jours', 2, 275, 185),
  ('GYG-DTS-005', 'Circuit de 3 jours dans le sud et le Sahara (Tunis, Sousse, Hammamet)', 'Tunis', '3 jours', 3, 350, 350),
  ('GYG-DTS-006', 'Tournée des bars de Djerba : buvez, dansez et explorez Djerba', 'Djerba', 'soirée', 1, 37, 37),
  ('GYG-DTS-007', 'Transfert Djerba : hôtels de Djerba vers aéroport de Djerba', 'Djerba', 'transfert', 1, 20, 20),
  ('GYG-DTS-008', 'Transfert Djerba : aéroport de Djerba vers hôtels de Djerba', 'Djerba', 'transfert', 1, 25, 25),
  ('GYG-DTS-009', 'Transfert Djerba : aéroport de Djerba vers hôtels de Zarzis', 'Djerba', 'transfert', 1, 45, 45),
  ('GYG-DTS-010', 'Kairouan et El Jem (déjeuner inclus) : avec votre propre voiture', 'Kairouan', 'journée', 1, 15, 10),
  ('GYG-DTS-011', 'Depuis Sousse : journée guidée à Kairouan et El Jem', 'Sousse', 'journée', 1, 75, 55),
  ('GYG-DTS-012', 'Depuis Hammamet : journée guidée à Kairouan et El Jem', 'Hammamet', 'journée', 1, 85, 60),
  ('GYG-DTS-013', 'Depuis Tunis : journée guidée à Kairouan et El Jem avec déjeuner', 'Tunis', 'journée', 1, 130, 80),
  ('GYG-DTS-014', 'Hammamet : excursion de 3 jours à Djerba, El Jem et le Sahara', 'Hammamet', '3 jours', 3, 325, 270),
  ('GYG-DTS-015', 'Tunis : Médina, Bardo, Carthage et Sidi Bou Saïd avec déjeuner', 'Tunis', 'journée', 1, 60, 45),
  ('GYG-DTS-016', 'Hammamet : Médina, Bardo, Carthage et Sidi Bou Saïd avec déjeuner', 'Hammamet', 'journée', 1, 80, 60),
  ('GYG-DTS-017', 'Sousse : Médina, Bardo, Carthage et Sidi Bou Saïd avec déjeuner', 'Sousse', 'journée', 1, 119, 85),
  ('GYG-DTS-018', 'Djerba : excursion 4x4 dans le Sahara et une nuit sous tente', 'Djerba', '2 jours', 2, 130, 90),
  ('GYG-DTS-019', 'Djerba/Zarzis : journée à Ksar Ghilane, Tataouine et Chenini', 'Djerba', 'journée', 1, 69, 55),
  ('GYG-DTS-020', 'Depuis Djerba : Sahara en 4x4 à Ksar Ghilane et Matmata', 'Djerba', 'journée', 1, 69, 49),
  ('GYG-DTS-021', 'Djerba Explore : crocodiles, reptiles et musées', 'Djerba', 'demi-journée', 1, 24, 12),
  ('GYG-DTS-022', 'Depuis Tunis et Hammamet : 2 jours dans le Sahara avec nuit sous tente', 'Tunis', '2 jours', 2, 125, 125),
  ('GYG-DTS-023', 'Tataouine et Chenini : visite d''une journée guidée', 'Tataouine', 'journée', 1, 49, 40),
  ('GYG-DTS-024', 'Djerba : balade à dos de chameau de 3 heures (Lagon bleu et plage de Seguia)', 'Djerba', 'activité', 1, 25, 20),
  ('GYG-DTS-025', 'Tunis et Hammamet : croisière pirate avec déjeuner et baignade', 'Hammamet', 'journée', 1, 45, 30),
  ('GYG-DTS-026', 'Tunis : sortie en bateau au coucher du soleil, dîner et Sidi Bou Saïd', 'Tunis', 'soirée', 1, 30, 20),
  ('GYG-DTS-027', 'Djerba : 1h30 de jet ski à usage individuel', 'Djerba', 'activité', 1, 105, 105),
  ('GYG-DTS-028', 'Djerba : 1h30 de jet ski à usage double', 'Djerba', 'activité', 1, 109, 109),
  ('GYG-DTS-029', 'Depuis Djerba et Zarzis : 2 jours dans le Sahara, nuit sous tente + quad', 'Djerba', '2 jours', 2, 130, 130),
  ('GYG-DTS-030', 'Paddle & Sunset à Djerba + dîner traditionnel sur la plage', 'Djerba', 'activité', 1, 45, 35),
  ('GYG-DTS-031', 'Croisière d''une demi-journée à Djerba avec barbecue et arrêts baignade', 'Djerba', 'demi-journée', 1, 53, 49),
  ('GYG-DTS-032', 'Depuis Tunis : demi-journée guidée à Carthage et Sidi Bou Saïd', 'Tunis', 'demi-journée', 1, 30, 20),
  ('GYG-DTS-033', 'Depuis Hammamet : demi-journée guidée à Carthage et Sidi Bou Saïd', 'Hammamet', 'demi-journée', 1, 45, 30),
  ('GYG-DTS-034', 'Depuis Sousse : demi-journée guidée à Carthage et Sidi Bou Saïd', 'Sousse', 'demi-journée', 1, 60, 45),
  ('GYG-DTS-035', 'Excursion 4x4 au Sahara : coucher de soleil, lever de soleil et nuit sous tente', 'Djerba', '2 jours', 2, 124, 83),
  ('GYG-DTS-036', 'Djerba : quad, chameau et balade à cheval avec prise en charge', 'Djerba', 'journée', 1, 75, 55),
  ('GYG-DTS-037', 'Depuis Djerba : circuit de 2 jours à Tozeur et à l''oasis de montagne', 'Djerba', '2 jours', 2, 170, 170),
  ('GYG-DTS-038', 'Hammamet : visite de Carthage et croisière pirate', 'Hammamet', 'journée', 1, 85, 65),
  ('GYG-DTS-039', 'Circuit de 3 jours sur les lieux de tournage de Star Wars', 'Tozeur', '3 jours', 3, 750, 750),
  ('GYG-DTS-040', 'Depuis Djerba : circuit de 3 jours dans le désert tunisien', 'Djerba', '3 jours', 3, 690, 690),
  ('GYG-DTS-041', 'Depuis Hammamet et Sousse : demi-journée au parc animalier Friguia', 'Hammamet', 'demi-journée', 1, 36, 25),
  ('GYG-DTS-042', 'Depuis Djerba et Zarzis : Tataouine, Chenini et Ksar Hadada', 'Djerba', 'journée', 1, 49, 40),
  ('GYG-DTS-043', 'Depuis Tozeur : circuit 4x4 dans les dunes de sable et Mos Espa', 'Tozeur', 'journée', 1, 43, 43),
  ('GYG-DTS-044', 'Depuis Djerba et Zarzis : Tataouine-Chenini et Star Wars', 'Djerba', 'journée', 1, 49, 39),
  ('GYG-DTS-045', 'Demi-journée en calèche avec déjeuner de poisson grillé et baignade', 'Djerba', 'demi-journée', 1, 70, 70),
  ('GYG-DTS-046', 'Djerba : visite guidée privée d''une demi-journée des temps forts de l''île', 'Djerba', 'demi-journée', 1, 70, 70),
  ('GYG-DTS-047', 'De Djerba : Flamingo Island en bateau pirate avec déjeuner', 'Djerba', 'journée', 1, 20, 20),
  ('GYG-DTS-048', 'Visite de 2 heures en calèche au coucher du soleil (campagne et lagune)', 'Djerba', 'activité', 1, 19, 10),
  ('GYG-DTS-049', 'Djerba : aventure en quad de 3 heures avec prise en charge et boisson', 'Djerba', 'activité', 1, 40, 30),
  ('GYG-DTS-050', 'À ne pas manquer à Djerba : visite de l''île en petit groupe (demi-journée)', 'Djerba', 'demi-journée', 1, 19, 15),
  ('GYG-DTS-051', 'Au départ de Djerba : visite privée de 5 jours sur la Guerre des étoiles', 'Djerba', '5 jours', 5, 1550, 1550),
  ('GYG-DTS-052', 'Djerba : 2 heures en bateau pour observer les dauphins', 'Djerba', 'activité', 1, 41, 34),
  ('GYG-DTS-053', 'Djerba : 3 heures de randonnée guidée en quad avec le Lagon Bleu', 'Djerba', 'activité', 1, 51, 51),
  ('GYG-DTS-054', 'Tozeur : oasis de montagne (Chebika, Tamerza et Ong Jmel)', 'Tozeur', 'journée', 1, 100, 75),
  ('GYG-DTS-055', 'Au départ de Hammamet : visite guidée d''une journée à Tunis', 'Hammamet', 'journée', 1, 90, 55),
  ('GYG-DTS-056', 'Djerba : excursion de pêche d''une demi-journée avec transferts hôtel', 'Djerba', 'demi-journée', 1, 75, 50),
  ('GYG-DTS-057', 'Djerba : vol en parachute ascensionnel et sortie en bateau', 'Djerba', 'activité', 1, 45, 45),
  ('GYG-DTS-058', 'De Tozeur & Naftah : assister au lever du soleil à Chott Djerid', 'Tozeur', 'activité', 1, 70, 70)
) as v(code, nom, ville, duree, jours, pa, pe)
join public.ota_channels o on o.nom = 'GetYourGuide DTS'
on conflict (code_interne) do nothing;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>> seed_donnees.sql <<<<<<<<<<<<<<<<<<<<<<<<<<<<

-- ============================================================
--  DTS OPERATION ERP — Données réelles DTS (charges, prestataires)
--  À exécuter APRÈS maj_finale.sql. Idempotent.
--  Montants en DT. Les assurances/taxes "à remplir" sont à 0 (éditables
--  dans l'onglet Charges fixes).
-- ============================================================

-- ---- Véhicules (parc) avec leasing ----
insert into public.vehicles (matricule, marque, mode_possession, leasing_mensuel, actif)
select v.mat, v.marque, 'PROPRIETE', v.leasing, true
from (values
  ('Toyota VX','Toyota',3300),
  ('Toyota TX','Toyota',3300),
  ('Hiace','Toyota',3600),
  ('Autocar','Autocar',6300),
  ('Ford TTG','Ford',4200),
  ('Ford DTS','Ford',4200),
  ('Suzuki Ertiga','Suzuki',1250)
) as v(mat, marque, leasing)
where not exists (select 1 from public.vehicles x where x.matricule = v.mat);

-- ---- Salaires (charges fixes) ----
insert into public.fixed_charges (libelle, categorie, montant, periodicite)
select v.lib, 'SALAIRE', v.m, 'MENSUEL'
from (values
  ('Salaire Karima',1500),('Salaire Aymen',1500),('Salaire Amine',1500),
  ('Salaire Hiba',1200),('Salaire Imed',1200),('Salaire Montana',2300),
  ('Salaire Adel bureau',1000),('Salaire Hersi',900),('Salaire Dhaou Sousse',1500),
  ('Salaire Farah',800),('Salaire Mohamed',900),
  ('Salaire chauffeur Autocar',1000),('Salaire chauffeur Hiace',1000),
  ('Salaire chauffeur Suzuki',1000),('Salaire chauffeur Ford TTG',1000),
  ('Salaire Walid',1000),('Salaire chauffeur Ford DTS',1000),
  ('Salaire chauffeur TX',1000)
) as v(lib, m)
where not exists (select 1 from public.fixed_charges f where f.libelle = v.lib);

-- Salaires guides permanents (Adel guide ≠ Adel bureau ; Montana déjà en Salaires)
insert into public.fixed_charges (libelle, categorie, montant, periodicite, note)
select v.lib, 'SALAIRE', v.m, 'MENSUEL', 'guide permanent'
from (values
  ('Salaire guide Ali Msabhia',2000),
  ('Salaire guide Boukéri',2000),
  ('Salaire guide Hamza',2000),
  ('Salaire Adel guide',2000)
) as v(lib, m)
where not exists (select 1 from public.fixed_charges f where f.libelle = v.lib);

-- ---- Leasings (liés au véhicule) ----
insert into public.fixed_charges (libelle, categorie, montant, periodicite, vehicle_id)
select v.lib, 'LEASING', v.m, 'MENSUEL', (select id from public.vehicles where matricule = v.mat)
from (values
  ('Leasing Toyota VX',3300,'Toyota VX'),
  ('Leasing Toyota TX',3300,'Toyota TX'),
  ('Leasing Hiace',3600,'Hiace'),
  ('Leasing Autocar',6300,'Autocar'),
  ('Leasing Ford TTG',4200,'Ford TTG'),
  ('Leasing Ford DTS',4200,'Ford DTS'),
  ('Leasing Suzuki Ertiga',1250,'Suzuki Ertiga')
) as v(lib, m, mat)
where not exists (select 1 from public.fixed_charges f where f.libelle = v.lib);

-- ---- Loyers & divers ----
insert into public.fixed_charges (libelle, categorie, montant, periodicite)
select v.lib, v.cat, v.m, 'MENSUEL'
from (values
  ('Loyer bureau Djerba','LOYER',1000),
  ('Loyer maison Hammamet','LOYER',650),
  ('DA3m','AUTRE',1700)
) as v(lib, cat, m)
where not exists (select 1 from public.fixed_charges f where f.libelle = v.lib);

-- ---- Assurances (annuelles ; le mensuel = montant/12) ----
insert into public.fixed_charges (libelle, categorie, montant, periodicite, note)
select 'Assurance FTAV', 'ASSURANCE_FTAV', 2200, 'ANNUEL', null
where not exists (select 1 from public.fixed_charges f where f.libelle = 'Assurance FTAV');

insert into public.fixed_charges (libelle, categorie, montant, periodicite, vehicle_id, note)
select v.lib, 'ASSURANCE_VEHICULE', 0, 'ANNUEL', (select id from public.vehicles where matricule = v.mat), 'à remplir'
from (values
  ('Assurance Toyota TX','Toyota TX'),
  ('Assurance Toyota VX','Toyota VX'),
  ('Assurance Hiace','Hiace'),
  ('Assurance Autocar','Autocar'),
  ('Assurance Ford TTG','Ford TTG'),
  ('Assurance Ford DTS','Ford DTS'),
  ('Assurance Suzuki Ertiga','Suzuki Ertiga')
) as v(lib, mat)
where not exists (select 1 from public.fixed_charges f where f.libelle = v.lib);

-- ---- Taxes de circulation (mensuelles, à remplir) ----
insert into public.fixed_charges (libelle, categorie, montant, periodicite, vehicle_id, note)
select v.lib, 'TAXE_VEHICULE', 0, 'MENSUEL', (select id from public.vehicles where matricule = v.mat), 'à remplir'
from (values
  ('Taxe Toyota TX','Toyota TX'),
  ('Taxe Toyota VX','Toyota VX'),
  ('Taxe Hiace','Hiace'),
  ('Taxe Autocar','Autocar'),
  ('Taxe Ford TTG','Ford TTG'),
  ('Taxe Ford DTS','Ford DTS'),
  ('Taxe Suzuki Ertiga','Suzuki Ertiga')
) as v(lib, mat)
where not exists (select 1 from public.fixed_charges f where f.libelle = v.lib);

-- ---- Guides permanents (base, salariés) ----
insert into public.guides (nom, type_guide, salaire_mensuel, actif)
select v.nom, 'SALARIE', v.sal, true
from (values
  ('Ali Msabhia',2000),('Boukéri',2000),('Hamza',2000),
  ('Adel guide',2000),('Montana guide',2300)
) as v(nom, sal)
where not exists (select 1 from public.guides g where g.nom = v.nom);

-- ---- Guides extras (150 DT/jour, 100 DT demi-journée) ----
insert into public.guides (nom, type_guide, actif)
select v.nom, 'EXTRA', true
from (values
  ('Mohamed Hamdi'),('Toutou'),('Waghlani'),('Zizou'),('Yosr'),('Mzoughi')
) as v(nom)
where not exists (select 1 from public.guides g where g.nom = v.nom);

insert into public.guide_prices (guide_id, demi_journee, journee, deux_jours)
select g.id, 100, 150, 300
from public.guides g
where g.type_guide = 'EXTRA'
  and g.nom in ('Mohamed Hamdi','Toutou','Waghlani','Zizou','Yosr','Mzoughi')
  and not exists (select 1 from public.guide_prices p where p.guide_id = g.id);

-- ---- Restaurants ----
insert into public.restaurants (nom, ville)
select v.nom, v.ville
from (values
  ('El Borj Tataouine','Tataouine'),
  ('Sahara Lounge Ghilane','Ksar Ghilane'),
  ('Restaurant Les Jardins','Sahara'),
  ('Restaurant Ammar El Jem','El Jem'),
  ('Restaurant Ammar Jelma','Jelma'),
  ('Restaurant Sidi Idriss','Sahara'),
  ('Restaurant Monte Carlo Lagoulette','La Goulette')
) as v(nom, ville)
where not exists (select 1 from public.restaurants r where r.nom = v.nom);

-- ---- Hôtels ----
insert into public.accommodations (nom, type, ville)
select v.nom, 'HOTEL', v.ville
from (values
  ('Ksar Rouge Tozeur','Tozeur'),
  ('Tamerza Palace Tozeur','Tozeur'),
  ('Touring Djerba','Djerba'),
  ('Belvedère Fourati Tunis','Tunis'),
  ('Kasbah Kairouan','Kairouan')
) as v(nom, ville)
where not exists (select 1 from public.accommodations a where a.nom = v.nom);

-- ---- Campements ----
insert into public.accommodations (nom, type, ville)
select v.nom, 'CAMP', v.ville
from (values
  ('Sahara Lounge Camp','Ksar Ghilane'),
  ('Dunes Insolites Camp','Sahara'),
  ('Tiniri Camp','Sahara'),
  ('Abdelmoula Camp','Sahara'),
  ('Bir Soltane Camp','Bir Soltane')
) as v(nom, ville)
where not exists (select 1 from public.accommodations a where a.nom = v.nom);

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>> workflow_9etapes.sql <<<<<<<<<<<<<<<<<<<<<<<<<<<<

-- ============================================================
--  DTS OPERATION ERP — Workflow en 8 étapes (cascade stricte)
--  Ordre :
--   1 NOUVELLE       Hiba   crée + ajoute au planning
--   2 AFFECTEE       Khalil transport + guide + heure de pickup   (-> ordre de mission)
--   3 CLIENT_INFORME Farah  envoie le mail au client (manuel)
--   4 PARTENAIRES_OK Karima réservations partenaires (resto, hôtel…)
--   5 VERIFIEE       Hiba   vérifie que tout est bon
--   6 COMPTA_OK      Karima vérifie la comptabilité
--   7 CONTROLEE      Hiba / Amine / Aymen contrôlent
--   8 CLOTUREE       Mohamed valide bénéfice/déficit (résumé auto)
--  Chaque personne ne voit une réservation qu'à SON étape.
--  À exécuter après INSTALL_TOUT.sql. Idempotent.
-- ============================================================

-- Nouveau rôle : Mohamed — Vérification budget / rentabilité
alter type erp_role add value if not exists 'ANALYSE';

-- Migration des anciens statuts vers le nouveau pipeline (best-effort).
-- On désactive le garde-fou le temps de la conversion (l'ancienne transition
-- n'existe plus dans le nouveau pipeline).
alter table public.bookings disable trigger bookings_guard_trg;
update public.bookings set statut = 'CLIENT_INFORME' where statut = 'CONFIRMEE';
update public.bookings set statut = 'PARTENAIRES_OK' where statut = 'EN_OPERATION';
update public.bookings set statut = 'CLOTUREE'       where statut = 'TERMINEE';
alter table public.bookings enable trigger bookings_guard_trg;

-- Garde-fou des transitions : chaque étape n'est franchissable que par son rôle.
create or replace function public.bookings_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare r text := public.erp_role();
begin
  if r = 'ADMIN' then
    return new;  -- la Direction n'est pas contrainte
  end if;

  if new.statut is distinct from old.statut then
    if old.statut = 'NOUVELLE' and new.statut = 'AFFECTEE' then
      if r <> 'OPERATIONS' then
        raise exception 'Seul OPERATIONS (Khalil) peut affecter transport / guide / heure';
      end if;
    elsif old.statut = 'AFFECTEE' and new.statut = 'CLIENT_INFORME' then
      if r <> 'CONFIRMATION' then
        raise exception 'Seul CONFIRMATION (Farah) peut informer le client';
      end if;
    elsif old.statut = 'CLIENT_INFORME' and new.statut = 'PARTENAIRES_OK' then
      if r <> 'LOGISTIQUE' then
        raise exception 'Seul LOGISTIQUE (Karima) peut réserver les partenaires';
      end if;
    elsif old.statut = 'PARTENAIRES_OK' and new.statut = 'VERIFIEE' then
      if r <> 'RESERVATION' then
        raise exception 'Seul RESERVATION (Hiba) peut vérifier la réservation';
      end if;
    elsif old.statut = 'VERIFIEE' and new.statut = 'COMPTA_OK' then
      if r <> 'LOGISTIQUE' then
        raise exception 'Seul LOGISTIQUE (Karima) peut vérifier la comptabilité';
      end if;
    elsif old.statut = 'COMPTA_OK' and new.statut = 'CONTROLEE' then
      if r not in ('LECTURE','RESERVATION') then
        raise exception 'Seuls le contrôle (Hiba, Amine, Aymen) peuvent contrôler';
      end if;
    elsif old.statut = 'CONTROLEE' and new.statut = 'CLOTUREE' then
      if r <> 'ANALYSE' then
        raise exception 'Seule la vérification budget (Mohamed) peut clôturer';
      end if;
    elsif new.statut = 'ANNULEE' then
      if r not in ('RESERVATION','CONFIRMATION') then
        raise exception 'Annulation non autorisée pour ce rôle';
      end if;
    else
      raise exception 'Transition % -> % non autorisée', old.statut, new.statut;
    end if;
  end if;

  -- Affectation opérationnelle (guide / véhicule / chauffeur) réservée à OPERATIONS
  if (new.guide_id   is distinct from old.guide_id
   or new.vehicle_id is distinct from old.vehicle_id
   or new.driver_id  is distinct from old.driver_id)
   and r <> 'OPERATIONS' then
     raise exception 'Seul OPERATIONS (Khalil) peut affecter guide / véhicule / chauffeur';
  end if;

  return new;
end $$;
