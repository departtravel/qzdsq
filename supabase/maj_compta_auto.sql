-- ============================================================
-- DTS OPERATION ERP — MISE À JOUR COMPTA AUTOMATIQUE
-- Colle TOUT ce fichier dans Supabase > SQL Editor > Run without RLS.
-- Prérequis : install_complet.sql + maj_operations.sql déjà exécutés.
-- Ré-exécutable sans risque.
-- ============================================================

-- >>>>>>>>>>>>>>>>>> compta_partenaires.sql <<<<<<<<<<<<<<<<<<

-- ============================================================
--  DTS OPERATION ERP — Relevé comptable par prestataire
--  Relie chaque ligne de coût à son partenaire réel (restaurant,
--  hébergement, extra) pour agréger la consommation par prestataire.
--  À exécuter APRÈS erp.sql / seed.sql / seed_dts.sql. Idempotent.
-- ============================================================

-- Lien ligne de coût -> partenaire
alter table public.excursion_cost_lines
  add column if not exists partner_type text;  -- RESTAURANT | HEBERGEMENT | EXTRA
alter table public.excursion_cost_lines
  add column if not exists partner_id uuid;

create index if not exists cost_lines_partner_idx
  on public.excursion_cost_lines (partner_type, partner_id);

-- ----- Rattachement automatique par nom (données seedées) ---
-- RESTAURANT : la ligne "Restaurant Sidi Idriss" -> restaurant "Sidi Idriss"
update public.excursion_cost_lines c
set partner_type = 'RESTAURANT', partner_id = r.id
from public.restaurants r
where c.categorie = 'RESTAURANT'
  and c.partner_id is null
  and c.nom_depense ilike '%' || r.nom || '%';

-- HEBERGEMENT : "Camp Sahara Lounge" -> accommodation "Sahara Lounge"
update public.excursion_cost_lines c
set partner_type = 'HEBERGEMENT', partner_id = a.id
from public.accommodations a
where c.categorie = 'HEBERGEMENT'
  and c.partner_id is null
  and c.nom_depense ilike '%' || a.nom || '%';

-- EXTRA : "Ticket El Jem" -> extra "Ticket El Jem"
update public.excursion_cost_lines c
set partner_type = 'EXTRA', partner_id = e.id
from public.extras e
where c.categorie = 'EXTRA'
  and c.partner_id is null
  and c.nom_depense ilike '%' || e.nom || '%';

-- Astuce : pour les lignes ajoutées ensuite, renseigne partner_type/partner_id
-- à la création afin qu'elles apparaissent dans le relevé du prestataire.

-- >>>>>>>>>>>>>>>>>> compta_auto.sql <<<<<<<<<<<<<<<<<<

-- ============================================================
--  DTS OPERATION ERP — COMPTA AUTOMATIQUE (moteur de facturation)
--  À exécuter après erp.sql / rbac.sql / sorties.sql / compta_partenaires.sql.
--  Idempotent.
--
--  Principe : chaque SORTIE (departure) génère automatiquement les
--  FACTURES fournisseurs de tous les prestataires réellement utilisés :
--    - Guide EXTRA        -> guide_prices selon la durée
--    - Chauffeur EXTRA    -> chauffeurs.tarif_jour × nb jours
--    - Transport (loc.)   -> transports.tarif_sortie
--    - Restaurant/Hôtel/Camp/Extra -> charges du produit × pax de la sortie
--  Les salariés (guide/chauffeur SALARIE) ne génèrent PAS de facture.
--  Recalcul auto à chaque changement de la sortie ou de ses réservations.
-- ============================================================

-- ---- 1) Unifier la notion d'admin (role='admin' OU erp_role='ADMIN') ----
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and (role = 'admin' or erp_role = 'ADMIN')
  );
$$;

-- ---- 2) Corriger quelques RLS trop strictes ----
drop policy if exists ota_imports_write on public.ota_imports;
create policy ota_imports_write on public.ota_imports for all
  using (public.has_erp_role('RESERVATION','OPERATIONS','LOGISTIQUE'))
  with check (public.has_erp_role('RESERVATION','OPERATIONS','LOGISTIQUE'));

drop policy if exists cost_history_write on public.cost_history;
create policy cost_history_write on public.cost_history for all
  using (public.has_erp_role('OPERATIONS','LOGISTIQUE','COMPTABLE'))
  with check (public.has_erp_role('OPERATIONS','LOGISTIQUE','COMPTABLE'));

-- COMPTABLE peut marquer une réservation (facturation)
drop policy if exists bookings_update on public.bookings;
create policy bookings_update on public.bookings for update
  using (public.has_erp_role('RESERVATION','CONFIRMATION','OPERATIONS','LOGISTIQUE','COMPTABLE'))
  with check (public.has_erp_role('RESERVATION','CONFIRMATION','OPERATIONS','LOGISTIQUE','COMPTABLE'));

-- ---- 3) Tarifs opérationnels manquants ----
alter table public.chauffeurs add column if not exists tarif_jour numeric not null default 0 check (tarif_jour >= 0);
alter table public.transports add column if not exists tarif_sortie numeric not null default 0 check (tarif_sortie >= 0);
-- Montant transport saisi manuellement pour une sortie (location journalière),
-- modifiable. Prioritaire sur le tarif du transporteur.
alter table public.departures add column if not exists transport_cout numeric check (transport_cout >= 0);
alter table public.departures add column if not exists transport_mode text; -- PARC | LONGUE_DUREE | JOURNALIERE

-- ---- 4) Lien prestataire -> fournisseur (suppliers) ----
alter table public.suppliers add column if not exists ref_type text;  -- GUIDE|CHAUFFEUR|TRANSPORT|RESTAURANT|HEBERGEMENT|EXTRA
alter table public.suppliers add column if not exists ref_id   uuid;
create unique index if not exists suppliers_ref_uidx on public.suppliers (ref_type, ref_id) where ref_type is not null;

-- Trouve ou crée le fournisseur correspondant à un prestataire.
create or replace function public.ensure_supplier(p_type text, p_id uuid, p_nom text)
returns uuid language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  if p_id is null then return null; end if;
  select id into sid from public.suppliers where ref_type = p_type and ref_id = p_id;
  if sid is null then
    insert into public.suppliers (nom, type, ref_type, ref_id)
    values (coalesce(p_nom, p_type), p_type, p_type, p_id)
    returning id into sid;
  end if;
  return sid;
end $$;

-- Backfill : crée les fournisseurs pour les prestataires existants.
insert into public.suppliers (nom, type, ref_type, ref_id)
select trim(coalesce(g.nom,'')||' '||coalesce(g.prenom,'')), 'GUIDE', 'GUIDE', g.id
from public.guides g
where not exists (select 1 from public.suppliers s where s.ref_type='GUIDE' and s.ref_id=g.id);
insert into public.suppliers (nom, type, ref_type, ref_id)
select trim(coalesce(c.nom,'')||' '||coalesce(c.prenom,'')), 'CHAUFFEUR', 'CHAUFFEUR', c.id
from public.chauffeurs c
where not exists (select 1 from public.suppliers s where s.ref_type='CHAUFFEUR' and s.ref_id=c.id);
insert into public.suppliers (nom, type, ref_type, ref_id)
select t.nom, 'TRANSPORT', 'TRANSPORT', t.id
from public.transports t
where not exists (select 1 from public.suppliers s where s.ref_type='TRANSPORT' and s.ref_id=t.id);
insert into public.suppliers (nom, type, ref_type, ref_id)
select r.nom, 'RESTAURANT', 'RESTAURANT', r.id
from public.restaurants r
where not exists (select 1 from public.suppliers s where s.ref_type='RESTAURANT' and s.ref_id=r.id);
insert into public.suppliers (nom, type, ref_type, ref_id)
select a.nom, 'HEBERGEMENT', 'HEBERGEMENT', a.id
from public.accommodations a
where not exists (select 1 from public.suppliers s where s.ref_type='HEBERGEMENT' and s.ref_id=a.id);
insert into public.suppliers (nom, type, ref_type, ref_id)
select e.nom, 'EXTRA', 'EXTRA', e.id
from public.extras e
where not exists (select 1 from public.suppliers s where s.ref_type='EXTRA' and s.ref_id=e.id);

-- Auto-création du fournisseur quand on ajoute un prestataire.
create or replace function public.tg_supplier_from_partner()
returns trigger language plpgsql security definer set search_path = public as $$
declare nom text; typ text;
begin
  typ := tg_argv[0];
  if typ in ('GUIDE','CHAUFFEUR') then
    nom := trim(coalesce(new.nom,'')||' '||coalesce(new.prenom,''));
  else
    nom := new.nom;
  end if;
  perform public.ensure_supplier(typ, new.id, nom);
  return new;
end $$;

do $$ begin
  perform 1;
  -- (re)crée les triggers d'auto-création
end $$;
drop trigger if exists sup_guide on public.guides;
create trigger sup_guide after insert on public.guides for each row execute function public.tg_supplier_from_partner('GUIDE');
drop trigger if exists sup_chauffeur on public.chauffeurs;
create trigger sup_chauffeur after insert on public.chauffeurs for each row execute function public.tg_supplier_from_partner('CHAUFFEUR');
drop trigger if exists sup_transport on public.transports;
create trigger sup_transport after insert on public.transports for each row execute function public.tg_supplier_from_partner('TRANSPORT');
drop trigger if exists sup_resto on public.restaurants;
create trigger sup_resto after insert on public.restaurants for each row execute function public.tg_supplier_from_partner('RESTAURANT');
drop trigger if exists sup_accom on public.accommodations;
create trigger sup_accom after insert on public.accommodations for each row execute function public.tg_supplier_from_partner('HEBERGEMENT');
drop trigger if exists sup_extra on public.extras;
create trigger sup_extra after insert on public.extras for each row execute function public.tg_supplier_from_partner('EXTRA');

-- ---- 5) Recalcul des factures auto d'une sortie ----
create or replace function public.recompute_departure_costs(p_departure uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  d record; exc record;
  ad int; en int; pax int; jours int;
  gtar numeric; sid uuid; cl record; nomsortie text;
begin
  select * into d from public.departures where id = p_departure;
  if not found then return; end if;

  -- Purge des factures auto de cette sortie (idempotence)
  delete from public.supplier_transactions where reference like 'AUTO:'||p_departure::text||':%';
  if d.statut = 'ANNULEE' then return; end if;

  select coalesce(sum(nombre_adultes),0), coalesce(sum(nombre_enfants),0)
    into ad, en from public.bookings where departure_id = p_departure and statut <> 'ANNULEE';
  pax := ad + en;

  select * into exc from public.excursions where id = d.excursion_id;
  jours := coalesce(exc.nombre_jours, 1);
  nomsortie := 'Sortie '||coalesce(exc.nom,'')||' du '||coalesce(d.date::text,'');

  -- GUIDE (extra uniquement)
  if d.guide_id is not null then
    perform 1 from public.guides where id = d.guide_id and type_guide = 'EXTRA';
    if found then
      select case when jours >= 2 then deux_jours when exc.duree ilike 'demi%' then demi_journee else journee end
        into gtar from public.guide_prices where guide_id = d.guide_id order by date_application desc limit 1;
      if gtar is null then
        select case when jours >= 2 then deux_jours when exc.duree ilike 'demi%' then demi_journee else journee end
          into gtar from public.guide_prices where guide_id is null order by date_application desc limit 1;
      end if;
      sid := public.ensure_supplier('GUIDE', d.guide_id,
        (select trim(coalesce(nom,'')||' '||coalesce(prenom,'')) from public.guides where id = d.guide_id));
      insert into public.supplier_transactions (supplier_id, date, type_operation, montant, reference, description, statut)
      values (sid, d.date, 'FACTURE', coalesce(gtar,0), 'AUTO:'||p_departure||':GUIDE', nomsortie||' — guide', 'EN_ATTENTE');
    end if;
  end if;

  -- CHAUFFEUR (extra uniquement) : tarif_jour × jours
  if d.driver_id is not null then
    perform 1 from public.chauffeurs where id = d.driver_id and type_chauffeur = 'EXTRA';
    if found then
      sid := public.ensure_supplier('CHAUFFEUR', d.driver_id,
        (select trim(coalesce(nom,'')||' '||coalesce(prenom,'')) from public.chauffeurs where id = d.driver_id));
      insert into public.supplier_transactions (supplier_id, date, type_operation, montant, reference, description, statut)
      select sid, d.date, 'FACTURE', coalesce(tarif_jour,0) * jours, 'AUTO:'||p_departure||':CHAUFFEUR',
             nomsortie||' — chauffeur ('||jours||' j)', 'EN_ATTENTE'
      from public.chauffeurs where id = d.driver_id;
    end if;
  end if;

  -- TRANSPORT : location journalière = montant saisi (transport_cout),
  -- sinon tarif du transporteur. Parc/longue durée = pas de facture par sortie
  -- (coût interne / mensuel géré ailleurs) sauf si un montant est saisi.
  if d.transport_id is not null then
    sid := public.ensure_supplier('TRANSPORT', d.transport_id,
      (select nom from public.transports where id = d.transport_id));
    insert into public.supplier_transactions (supplier_id, date, type_operation, montant, reference, description, statut)
    select sid, d.date, 'FACTURE',
           coalesce(d.transport_cout, (select tarif_sortie from public.transports where id = d.transport_id), 0),
           'AUTO:'||p_departure||':TRANSPORT',
           nomsortie||' — transport'||coalesce(' ('||d.transport_mode||')',''), 'EN_ATTENTE'
    where coalesce(d.transport_cout, (select tarif_sortie from public.transports where id = d.transport_id), 0) > 0;
  end if;

  -- RESTAURANTS / HÉBERGEMENTS / EXTRAS via les charges du produit × pax
  for cl in
    select * from public.excursion_cost_lines
    where excursion_id = d.excursion_id
      and partner_type in ('RESTAURANT','HEBERGEMENT','EXTRA')
      and partner_id is not null
      and inclure_comptabilite = true
  loop
    sid := public.ensure_supplier(cl.partner_type, cl.partner_id, cl.nom_depense);
    insert into public.supplier_transactions (supplier_id, date, type_operation, montant, reference, description, statut)
    values (
      sid, d.date, 'FACTURE',
      case
        when cl.type_depense in ('PAR_GROUPE','FIXE') then cl.prix_unitaire * cl.quantite
        when cl.type_depense = 'PAR_VEHICULE' then cl.prix_unitaire * cl.quantite  -- 1 véhicule par défaut
        else cl.prix_unitaire * cl.quantite * pax
      end,
      'AUTO:'||p_departure||':CL:'||cl.id,
      nomsortie||' — '||cl.nom_depense||' ('||pax||' pax)',
      'EN_ATTENTE'
    );
  end loop;
end $$;

-- ---- 6) Déclencheurs ----
create or replace function public.tg_departure_recompute()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.recompute_departure_costs(new.id);
  return new;
end $$;
drop trigger if exists departure_recompute on public.departures;
create trigger departure_recompute after insert or update on public.departures
  for each row execute function public.tg_departure_recompute();

-- Recalcule la sortie quand une réservation y est rattachée/détachée ou change d'effectif.
create or replace function public.tg_booking_recompute()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.departure_id is not null then perform public.recompute_departure_costs(new.departure_id); end if;
  if tg_op = 'UPDATE' and old.departure_id is not null and old.departure_id is distinct from new.departure_id then
    perform public.recompute_departure_costs(old.departure_id);
  end if;
  return new;
end $$;
drop trigger if exists booking_recompute on public.bookings;
create trigger booking_recompute after insert or update on public.bookings
  for each row execute function public.tg_booking_recompute();

-- ---- 7) Solde fournisseur maintenu automatiquement ----
create or replace function public.recompute_supplier_solde(p_supplier uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.suppliers s set solde_actuel = coalesce((
    select sum(case when type_operation = 'FACTURE' then montant
                    when type_operation in ('PAIEMENT','AVANCE') then -montant
                    else 0 end)
    from public.supplier_transactions t where t.supplier_id = p_supplier), 0)
  where s.id = p_supplier;
end $$;

create or replace function public.tg_txn_solde()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.recompute_supplier_solde(coalesce(new.supplier_id, old.supplier_id));
  return null;
end $$;
drop trigger if exists txn_solde on public.supplier_transactions;
create trigger txn_solde after insert or update or delete on public.supplier_transactions
  for each row execute function public.tg_txn_solde();
