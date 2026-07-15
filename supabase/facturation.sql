-- ============================================================
--  DTS OPERATION ERP — Facturation par excursion
--  Une facture regroupe TOUTES les réservations d'une excursion
--  (à une date donnée), quelles que soient les plateformes OTA :
--  chaque réservation garde son propre prix de vente et sa
--  propre commission plateforme. Le prix net = vente − commission.
--
--  À exécuter APRÈS erp.sql / rbac.sql / settings.sql. Idempotent.
-- ============================================================

-- ----- 1) Champs de facturation sur les réservations --------
-- Prix et commission peuvent varier d'une plateforme à l'autre,
-- donc on les stocke PAR réservation (pas seulement sur l'excursion).
alter table public.bookings
  add column if not exists numero_reservation text;      -- N° OTA / voucher
alter table public.bookings
  add column if not exists prix_vente numeric not null default 0
    check (prix_vente >= 0);                              -- total client, EUR
alter table public.bookings
  add column if not exists commission_montant numeric not null default 0
    check (commission_montant >= 0);                      -- commission plateforme, EUR

-- ----- 2) Paramètre supplémentaire : Matricule Fiscal -------
insert into public.app_settings (key, value) values
  ('company_mf', '1612019Y')
on conflict (key) do nothing;

-- ----- 3) Factures émises (en-tête + snapshot pour l'historique)
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
  devise          text not null default 'EUR',
  created_at      timestamptz not null default now()
);
create index if not exists invoices_date_idx on public.invoices (date_emission);
create index if not exists invoices_excursion_idx on public.invoices (excursion_id);

-- ----- 4) Row Level Security --------------------------------
alter table public.invoices enable row level security;

drop policy if exists invoices_read on public.invoices;
create policy invoices_read on public.invoices
  for select using (auth.role() = 'authenticated');

-- Écriture réservée à la Comptabilité (et à l'ADMIN Direction).
drop policy if exists invoices_write on public.invoices;
create policy invoices_write on public.invoices for all
  using (public.has_erp_role('COMPTABLE'))
  with check (public.has_erp_role('COMPTABLE'));

-- ----- 5) La Comptabilité peut renseigner prix & commission --
-- Sur les réservations (élargit la policy bookings_update de rbac.sql,
-- qui n'incluait pas COMPTABLE).
drop policy if exists bookings_update on public.bookings;
create policy bookings_update on public.bookings for update
  using (public.has_erp_role('RESERVATION','CONFIRMATION','OPERATIONS','LOGISTIQUE','COMPTABLE'))
  with check (public.has_erp_role('RESERVATION','CONFIRMATION','OPERATIONS','LOGISTIQUE','COMPTABLE'));
