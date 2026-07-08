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
