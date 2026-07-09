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
