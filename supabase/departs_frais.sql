-- ============================================================
--  DTS OPERATION ERP — Frais partagés de la sortie
--  gasoil, parking, autoroute (péage) saisis par sortie et
--  divisés sur le nombre de personnes. À exécuter après sorties.sql.
--  Idempotent.
-- ============================================================
alter table public.departures add column if not exists gasoil  numeric not null default 0 check (gasoil >= 0);
alter table public.departures add column if not exists parking numeric not null default 0 check (parking >= 0);
alter table public.departures add column if not exists peage   numeric not null default 0 check (peage >= 0);
