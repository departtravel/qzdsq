-- ============================================================
--  DTS OPERATION ERP — Workflow en 8 étapes (cascade stricte)
--  Ordre :
--   1 NOUVELLE       Hiba   crée + ajoute au planning
--   2 AFFECTEE       Khalil transport + guide + heure de pickup   (-> ordre de mission)
--   3 CLIENT_INFORME Farah  envoie le mail au client (manuel)
--   4 PARTENAIRES_OK Karima réservations partenaires (resto, hôtel…)
--   5 VERIFIEE       Hiba   vérifie que tout est bon
--   6 COMPTA_OK      Karima vérifie la comptabilité
--   7 CONTROLEE      Hiba / Amine / Aymen contrôlent
--   8 CLOTUREE       Mohamed valide bénéfice/déficit (résumé auto)
--  Chaque personne ne voit une réservation qu'à SON étape.
--  À exécuter après INSTALL_TOUT.sql. Idempotent.
-- ============================================================

-- Nouveau rôle : Mohamed — Vérification budget / rentabilité
alter type erp_role add value if not exists 'ANALYSE';

-- Migration des anciens statuts vers le nouveau pipeline (best-effort).
-- On désactive le garde-fou le temps de la conversion (l'ancienne transition
-- n'existe plus dans le nouveau pipeline).
alter table public.bookings disable trigger bookings_guard_trg;
update public.bookings set statut = 'CLIENT_INFORME' where statut = 'CONFIRMEE';
update public.bookings set statut = 'PARTENAIRES_OK' where statut = 'EN_OPERATION';
update public.bookings set statut = 'CLOTUREE'       where statut = 'TERMINEE';
alter table public.bookings enable trigger bookings_guard_trg;

-- Garde-fou des transitions : chaque étape n'est franchissable que par son rôle.
create or replace function public.bookings_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare r text := public.erp_role();
begin
  if r = 'ADMIN' then
    return new;  -- la Direction n'est pas contrainte
  end if;

  if new.statut is distinct from old.statut then
    if old.statut = 'NOUVELLE' and new.statut = 'AFFECTEE' then
      if r <> 'OPERATIONS' then
        raise exception 'Seul OPERATIONS (Khalil) peut affecter transport / guide / heure';
      end if;
    elsif old.statut = 'AFFECTEE' and new.statut = 'CLIENT_INFORME' then
      if r <> 'CONFIRMATION' then
        raise exception 'Seul CONFIRMATION (Farah) peut informer le client';
      end if;
    elsif old.statut = 'CLIENT_INFORME' and new.statut = 'PARTENAIRES_OK' then
      if r <> 'LOGISTIQUE' then
        raise exception 'Seul LOGISTIQUE (Karima) peut réserver les partenaires';
      end if;
    elsif old.statut = 'PARTENAIRES_OK' and new.statut = 'VERIFIEE' then
      if r <> 'RESERVATION' then
        raise exception 'Seul RESERVATION (Hiba) peut vérifier la réservation';
      end if;
    elsif old.statut = 'VERIFIEE' and new.statut = 'COMPTA_OK' then
      if r <> 'LOGISTIQUE' then
        raise exception 'Seul LOGISTIQUE (Karima) peut vérifier la comptabilité';
      end if;
    elsif old.statut = 'COMPTA_OK' and new.statut = 'CONTROLEE' then
      if r not in ('LECTURE','RESERVATION') then
        raise exception 'Seuls le contrôle (Hiba, Amine, Aymen) peuvent contrôler';
      end if;
    elsif old.statut = 'CONTROLEE' and new.statut = 'CLOTUREE' then
      if r <> 'ANALYSE' then
        raise exception 'Seule la vérification budget (Mohamed) peut clôturer';
      end if;
    elsif new.statut = 'ANNULEE' then
      if r not in ('RESERVATION','CONFIRMATION') then
        raise exception 'Annulation non autorisée pour ce rôle';
      end if;
    else
      raise exception 'Transition % -> % non autorisée', old.statut, new.statut;
    end if;
  end if;

  -- Affectation opérationnelle (guide / véhicule / chauffeur) réservée à OPERATIONS
  if (new.guide_id   is distinct from old.guide_id
   or new.vehicle_id is distinct from old.vehicle_id
   or new.driver_id  is distinct from old.driver_id)
   and r <> 'OPERATIONS' then
     raise exception 'Seul OPERATIONS (Khalil) peut affecter guide / véhicule / chauffeur';
  end if;

  return new;
end $$;
