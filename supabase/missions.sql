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
