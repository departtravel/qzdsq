-- ============================================================
--  DTS OPERATION ERP — Flotte : places & mode de possession
--  À exécuter après schema.sql. Idempotent.
-- ============================================================
alter table public.vehicles add column if not exists places integer check (places >= 0);
alter table public.vehicles add column if not exists mode_possession text;
  -- PROPRIETE | LOCATION_LONGUE_DUREE | LOCATION_EXCURSION
alter table public.vehicles add column if not exists leasing_mensuel numeric check (leasing_mensuel >= 0);
  -- si PROPRIETE (mensualité de leasing/crédit, 0 si payé)
alter table public.vehicles add column if not exists loyer_mensuel numeric check (loyer_mensuel >= 0);
  -- si LOCATION_LONGUE_DUREE (prix par mois)
alter table public.vehicles add column if not exists tarif_excursion numeric check (tarif_excursion >= 0);
  -- si LOCATION_EXCURSION (tarif par sortie)
