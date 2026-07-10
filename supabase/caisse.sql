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
