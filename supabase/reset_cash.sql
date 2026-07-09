-- ============================================================
--  DTS OPERATION ERP — Suppression réservation & remise à zéro
--  À exécuter après compta_auto.sql. Idempotent.
-- ============================================================

-- Autoriser le rôle RESERVATION (Hiba) à supprimer une réservation
-- (en plus de l'ADMIN). La suppression met à jour la compta via les triggers.
drop policy if exists bookings_delete on public.bookings;
create policy bookings_delete on public.bookings for delete
  using (public.has_erp_role('RESERVATION'));

-- ---- Remise à zéro des données transactionnelles (« vider le cash ») ----
-- Efface réservations, sorties, factures/compta, planning, ordres de mission
-- et imports. CONSERVE le catalogue, les référentiels et les charges fixes.
-- Réservé au super administrateur.
create or replace function public.reset_cash()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Action réservée au super administrateur';
  end if;
  delete from public.bookings;            -- cascade booking_extras
  delete from public.departures;          -- purge des factures auto (trigger)
  delete from public.supplier_transactions;
  delete from public.mission_orders;
  delete from public.operation_planning;
  delete from public.ota_imports;
  update public.suppliers set solde_actuel = 0;
end $$;
