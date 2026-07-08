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
