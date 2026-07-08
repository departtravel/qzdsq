-- ============================================================
--  DTS OPERATION ERP — Cloisonnement par rôle (RBAC)
--  À exécuter APRÈS supabase/erp.sql (idempotent).
--
--  Objectif : imposer le workflow métier au niveau BASE, pas
--  seulement dans l'interface. Chaque étape d'une réservation
--  ne peut être franchie que par le bon rôle :
--    NOUVELLE   -> CONFIRMEE     : CONFIRMATION (Farah)
--    CONFIRMEE  -> EN_OPERATION  : OPERATIONS  (Hersi)
--    EN_OPERATION -> TERMINEE    : OPERATIONS / LOGISTIQUE (Hersi / Karima)
--    (Amine / Aymen = CONTROLE/LECTURE : lecture seule + rapports)
--  Affectation guide/véhicule/chauffeur : OPERATIONS uniquement.
--  ADMIN (Direction) : peut tout faire.
-- ============================================================

-- ----- Rôle ERP sur le profil utilisateur -------------------
alter table public.profiles
  add column if not exists erp_role erp_role not null default 'LECTURE';

-- Les administrateurs (role='admin') sont ADMIN ERP par défaut.
update public.profiles set erp_role = 'ADMIN'
where role = 'admin' and erp_role = 'LECTURE';

-- ----- Helpers ----------------------------------------------
-- Rôle ERP effectif de l'utilisateur courant (admin => ADMIN).
create or replace function public.erp_role()
returns text language sql security definer stable set search_path = public as $$
  select coalesce(
    (select case when p.role = 'admin' then 'ADMIN' else p.erp_role::text end
       from public.profiles p where p.id = auth.uid()),
    'LECTURE');
$$;

-- L'utilisateur a-t-il l'un des rôles demandés (ADMIN passe toujours) ?
create or replace function public.has_erp_role(variadic roles text[])
returns boolean language sql stable set search_path = public as $$
  select public.erp_role() = 'ADMIN' or public.erp_role() = any(roles);
$$;

-- ============================================================
--  Trigger de validation des transitions sur bookings
-- ============================================================
create or replace function public.bookings_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare r text := public.erp_role();
begin
  if r = 'ADMIN' then
    return new;  -- la Direction n'est pas contrainte
  end if;

  -- Changement de statut : chaque transition a son rôle
  if new.statut is distinct from old.statut then
    if old.statut = 'NOUVELLE' and new.statut = 'CONFIRMEE' then
      if r <> 'CONFIRMATION' then
        raise exception 'Seul le rôle CONFIRMATION (Farah) peut confirmer une réservation';
      end if;
    elsif old.statut = 'CONFIRMEE' and new.statut = 'EN_OPERATION' then
      if r <> 'OPERATIONS' then
        raise exception 'Seul le rôle OPERATIONS (Hersi) peut mettre en opération';
      end if;
    elsif old.statut = 'EN_OPERATION' and new.statut = 'TERMINEE' then
      if r not in ('OPERATIONS','LOGISTIQUE') then
        raise exception 'Seuls OPERATIONS (Hersi) ou LOGISTIQUE (Karima) peuvent terminer';
      end if;
    elsif new.statut = 'ANNULEE' then
      if r not in ('RESERVATION','CONFIRMATION') then
        raise exception 'Annulation non autorisée pour ce rôle';
      end if;
    else
      raise exception 'Transition % -> % non autorisée', old.statut, new.statut;
    end if;
  end if;

  -- Affectation opérationnelle réservée au rôle OPERATIONS
  if (new.guide_id   is distinct from old.guide_id
   or new.vehicle_id is distinct from old.vehicle_id
   or new.driver_id  is distinct from old.driver_id)
   and r <> 'OPERATIONS' then
     raise exception 'Seul le rôle OPERATIONS (Hersi) peut affecter guide / véhicule / chauffeur';
  end if;

  return new;
end $$;

drop trigger if exists bookings_guard_trg on public.bookings;
create trigger bookings_guard_trg
  before update on public.bookings
  for each row execute function public.bookings_guard();

-- ============================================================
--  Politiques RLS par rôle
--  (remplacent les politiques d'écriture "admin only" d'erp.sql)
-- ============================================================

-- --- Réservations : créer = RESERVATION ; modifier = chaîne ; supprimer = ADMIN
drop policy if exists bookings_write on public.bookings;
drop policy if exists bookings_insert on public.bookings;
drop policy if exists bookings_update on public.bookings;
drop policy if exists bookings_delete on public.bookings;
create policy bookings_insert on public.bookings for insert
  with check (public.has_erp_role('RESERVATION'));
create policy bookings_update on public.bookings for update
  using (public.has_erp_role('RESERVATION','CONFIRMATION','OPERATIONS','LOGISTIQUE'))
  with check (public.has_erp_role('RESERVATION','CONFIRMATION','OPERATIONS','LOGISTIQUE'));
create policy bookings_delete on public.bookings for delete
  using (public.has_erp_role());  -- ADMIN uniquement

-- --- Planning : OPERATIONS / LOGISTIQUE
drop policy if exists operation_planning_write on public.operation_planning;
create policy operation_planning_write on public.operation_planning for all
  using (public.has_erp_role('OPERATIONS','LOGISTIQUE'))
  with check (public.has_erp_role('OPERATIONS','LOGISTIQUE'));

-- --- Comptabilité fournisseurs : COMPTABLE
do $$
declare t text;
begin
  foreach t in array array['suppliers','supplier_transactions','supplier_invoices'] loop
    execute format('drop policy if exists %I_write on public.%I;', t, t);
    execute format(
      'create policy %I_write on public.%I for all using (public.has_erp_role(%L)) with check (public.has_erp_role(%L));',
      t, t, 'COMPTABLE', 'COMPTABLE');
  end loop;
end $$;

-- --- Référentiels (production/logistique) : LOGISTIQUE
do $$
declare t text;
begin
  foreach t in array array[
    'guides','guide_prices','chauffeurs','driver_costs','restaurants',
    'restaurant_prices','accommodations','accommodation_prices','extras',
    'transports','erp_vehicles','vehicle_costs'
  ] loop
    execute format('drop policy if exists %I_write on public.%I;', t, t);
    execute format(
      'create policy %I_write on public.%I for all using (public.has_erp_role(%L)) with check (public.has_erp_role(%L));',
      t, t, 'LOGISTIQUE', 'LOGISTIQUE');
  end loop;
end $$;

-- --- Catalogue / paramètres : ADMIN seulement (inchangé, on garde is_admin
--     via has_erp_role() sans argument => ADMIN)
do $$
declare t text;
begin
  foreach t in array array['excursions','excursion_options','excursion_cost_lines','ota_channels','exchange_rates'] loop
    execute format('drop policy if exists %I_write on public.%I;', t, t);
    execute format(
      'create policy %I_write on public.%I for all using (public.has_erp_role()) with check (public.has_erp_role());',
      t, t);
  end loop;
end $$;

-- ============================================================
--  Affectation des rôles aux utilisateurs (À PERSONNALISER)
--  Remplace les e-mails par les vrais comptes créés dans Supabase.
-- ============================================================
--  update public.profiles set erp_role = 'RESERVATION'  where email = 'hiba@...';
--  update public.profiles set erp_role = 'CONFIRMATION'  where email = 'farah@...';
--  update public.profiles set erp_role = 'OPERATIONS'    where email = 'hersi@...';
--  update public.profiles set erp_role = 'LOGISTIQUE'    where email = 'karima@...';
--  update public.profiles set erp_role = 'COMPTABLE'     where email = 'compta@...';
--  update public.profiles set erp_role = 'LECTURE'       where email in ('amine@...','aymen@...');
--  update public.profiles set erp_role = 'ADMIN', role='admin' where email in ('amine@...','aymen@...');
