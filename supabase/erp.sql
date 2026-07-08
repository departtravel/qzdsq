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
