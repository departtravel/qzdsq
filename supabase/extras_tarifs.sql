-- ============================================================
--  DTS OPERATION ERP — Extras : tarif adulte / enfant (achat & vente)
--  - L'extra porte son prix d'ACHAT (payé au prestataire/fournisseur)
--    ET son prix de VENTE (facturé au client), en adulte ET enfant.
--  - type_tarification distingue PAR_PERSONNE / PAR_VEHICULE…
--  - Sur une réservation, on peut préciser une quantité adulte ET enfant.
--  À exécuter après INSTALL_TOUT.sql. Idempotent.
-- ============================================================

alter table public.extras add column if not exists prix_achat_enfant numeric;
alter table public.extras add column if not exists prix_vente_enfant numeric;

-- Quantité enfant choisie sur une réservation (en plus de la quantité adulte).
alter table public.booking_extras add column if not exists quantite_enfant integer not null default 0;
