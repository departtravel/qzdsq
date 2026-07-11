-- ============================================================
--  DTS — Tunnel de RÉSERVATION (vitrine client)
--  À exécuter APRÈS erp.sql, produits.sql, public_read.sql.
--  Enrichit `bookings` avec le détail de la config vitrine et
--  autorise l'insertion par un visiteur anonyme (statut NOUVELLE).
-- ============================================================

alter table public.bookings
  add column if not exists type_sortie      text default 'GROUPE'
    check (type_sortie in ('GROUPE','PRIVE')),
  add column if not exists variant_id        uuid references public.product_variants(id) on delete set null,
  add column if not exists ville_depart_id   uuid references public.cities(id) on delete set null,
  add column if not exists ville_arrivee_id  uuid references public.cities(id) on delete set null,
  add column if not exists supplement_ville  numeric default 0 check (supplement_ville >= 0),
  add column if not exists reduction_montant numeric default 0 check (reduction_montant >= 0),
  add column if not exists reduction_nom     text,
  add column if not exists montant_total     numeric default 0 check (montant_total >= 0),
  add column if not exists devise            text default 'EUR',
  add column if not exists source            text default 'WEB',
  add column if not exists heure_depart      text;

-- Extras retenus dans une réservation (snapshot du prix au moment de la résa).
create table if not exists public.booking_extras (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references public.bookings(id) on delete cascade,
  option_id   uuid references public.excursion_options(id) on delete set null,
  nom         text not null,
  prix        numeric not null default 0 check (prix >= 0),
  created_at  timestamptz not null default now()
);
create index if not exists booking_extras_booking_idx
  on public.booking_extras (booking_id);

-- ----- RLS : insertion publique (anon) --------------------
alter table public.bookings enable row level security;
alter table public.booking_extras enable row level security;

-- Un visiteur anonyme peut CRÉER une réservation en statut NOUVELLE,
-- via la vitrine. Il ne peut ni lire ni modifier les réservations.
drop policy if exists bookings_public_insert on public.bookings;
create policy bookings_public_insert on public.bookings
  for insert with check (statut = 'NOUVELLE' and source = 'WEB');

drop policy if exists booking_extras_public_insert on public.booking_extras;
create policy booking_extras_public_insert on public.booking_extras
  for insert with check (true);
