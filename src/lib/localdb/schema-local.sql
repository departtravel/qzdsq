-- ============================================================
--  DTS Operation ERP — Schema LOCAL (hors-ligne, PGlite)
--  Genere depuis supabase/*.sql : uniquement tables, index et
--  donnees de base. SANS RLS, SANS auth.users, SANS triggers
--  de cloisonnement (usage mono-poste : vous etes seul admin).
-- ============================================================

-- ===== depuis schema.sql =====
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
create table if not exists public.profiles (
  id         uuid primary key default gen_random_uuid(),
  email      text,
  role       text not null default 'viewer' check (role in ('admin', 'viewer')),
  created_at timestamptz not null default now()
);
alter table public.vehicles add column if not exists chauffeur text;
alter table public.vehicles add column if not exists actif boolean not null default true;
alter table public.vehicles add column if not exists date_visite_technique date;
alter table public.vehicles add column if not exists date_vignette date;
alter table public.fuel_logs add column if not exists plein_complet boolean not null default true;
create index if not exists fuel_logs_vehicle_km_idx
  on public.fuel_logs (vehicle_id, km);
create index if not exists maintenance_vehicle_idx
  on public.maintenance_logs (vehicle_id, date);

-- ===== depuis erp.sql =====
create table if not exists public.ota_channels (
  id                    uuid primary key default gen_random_uuid(),
  nom                   text not null unique,
  commission_percentage numeric not null default 30 check (commission_percentage >= 0 and commission_percentage <= 100),
  devise                text not null default 'EUR',
  actif                 boolean not null default true,
  created_at            timestamptz not null default now()
);
create table if not exists public.exchange_rates (
  id      uuid primary key default gen_random_uuid(),
  devise  text not null,                    -- EUR, USD...
  taux    numeric not null check (taux > 0),-- valeur en TND pour 1 unité
  date    date not null default current_date,
  unique (devise, date)
);
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
create table if not exists public.ota_imports (
  id          uuid primary key default gen_random_uuid(),
  source      text,
  fichier     text,
  date_import timestamptz not null default now(),
  statut      text not null default 'EN_ATTENTE'
);
create table if not exists public.cost_history (
  id           uuid primary key default gen_random_uuid(),
  categorie    text,
  reference_id uuid,
  ancien_prix  numeric,
  nouveau_prix numeric,
  date         timestamptz not null default now()
);
create index if not exists cost_lines_excursion_idx
  on public.excursion_cost_lines (excursion_id);
create index if not exists bookings_date_idx on public.bookings (date_excursion);
create index if not exists planning_date_idx on public.operation_planning (date);

-- ===== depuis missions.sql =====
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
alter table public.bookings add column if not exists hotel                 text;
alter table public.bookings add column if not exists heure_prise_en_charge text;
alter table public.bookings add column if not exists regime                text;
alter table public.bookings add column if not exists extras                text;
create index if not exists mission_orders_date_idx on public.mission_orders (date);

-- ===== depuis settings.sql =====
create table if not exists public.app_settings (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);

-- ===== depuis facturation.sql =====
create table if not exists public.invoices (
  id              uuid primary key default gen_random_uuid(),
  numero          text not null unique,        -- ex. FAC-2026-0001
  date_emission   date not null default current_date,
  excursion_id    uuid references public.excursions(id) on delete set null,
  excursion_nom   text,                         -- figé au moment de l'émission
  date_excursion  date,
  -- Instantané des lignes (réservations) au moment de l'émission.
  -- Chaque ligne : { date, numero_reservation, client_nom, plateforme,
  --                  pax, prix_vente, commission_montant, prix_net }
  lignes          jsonb not null default '[]'::jsonb,
  total_vente     numeric not null default 0,
  total_commission numeric not null default 0,
  total_net       numeric not null default 0,
  -- Fiscalité (Tunisie) : TVA (0 / 7 / 19 %…), base et droit de timbre.
  tva_pct         numeric not null default 0 check (tva_pct >= 0),
  tva_base        text not null default 'NET',  -- NET | VENTE
  montant_tva     numeric not null default 0,
  timbre_fiscal   numeric not null default 0 check (timbre_fiscal >= 0),
  total_ttc       numeric not null default 0,
  devise          text not null default 'EUR',
  created_at      timestamptz not null default now()
);
alter table public.bookings
  add column if not exists numero_reservation text;
alter table public.bookings
  add column if not exists prix_vente numeric not null default 0
    check (prix_vente >= 0);
alter table public.bookings
  add column if not exists commission_montant numeric not null default 0
    check (commission_montant >= 0);
alter table public.invoices add column if not exists tva_pct numeric not null default 0;
alter table public.invoices add column if not exists tva_base text not null default 'NET';
alter table public.invoices add column if not exists montant_tva numeric not null default 0;
alter table public.invoices add column if not exists timbre_fiscal numeric not null default 0;
alter table public.invoices add column if not exists total_ttc numeric not null default 0;
create index if not exists invoices_date_idx on public.invoices (date_emission);
create index if not exists invoices_excursion_idx on public.invoices (excursion_id);
