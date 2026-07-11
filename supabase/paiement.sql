-- ============================================================
--  DTS — PAIEMENT EN LIGNE (Stripe)
--  À exécuter APRÈS reservation.sql.
--  Suit l'état de paiement d'une réservation (acompte ou total).
-- ============================================================
alter table public.bookings
  add column if not exists paiement_statut text not null default 'NON_PAYE'
    check (paiement_statut in ('NON_PAYE','ACOMPTE','PAYE','REMBOURSE')),
  add column if not exists montant_paye     numeric not null default 0 check (montant_paye >= 0),
  add column if not exists stripe_session_id text;

-- Acompte demandé par produit (% du total). Null => acompte global par défaut.
alter table public.excursions
  add column if not exists acompte_pct numeric check (acompte_pct is null or (acompte_pct >= 0 and acompte_pct <= 100));
