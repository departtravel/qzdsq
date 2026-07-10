-- ============================================================
--  DTS OPERATION ERP — Quantité par extra choisi sur une réservation
--  Permet "1 quad, 2 dromadaires, 1 tente luxe" sur l'ordre de mission.
--  À exécuter après INSTALL_TOUT.sql. Idempotent.
-- ============================================================
alter table public.booking_extras
  add column if not exists quantite integer not null default 1 check (quantite >= 1);
