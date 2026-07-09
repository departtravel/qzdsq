-- ============================================================
--  DTS OPERATION ERP — Prix enfant distinct sur les charges
--  Une charge PAR_PERSONNE peut avoir un prix adulte (prix_unitaire)
--  ET un prix enfant (prix_enfant). Calcul :
--    prix_adulte × adultes + prix_enfant × enfants
--  À exécuter après maj_finale.sql. Idempotent.
-- ============================================================
alter table public.excursion_cost_lines
  add column if not exists prix_enfant numeric check (prix_enfant >= 0);

-- Recalcul compta : prix adulte × adultes + prix enfant × enfants.
create or replace function public.recompute_departure_costs(p_departure uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  d record; exc record;
  ad int; en int; pax int; jours int;
  gtar numeric; sid uuid; cl record; nomsortie text;
begin
  select * into d from public.departures where id = p_departure;
  if not found then return; end if;

  delete from public.supplier_transactions
   where reference like 'AUTO:'||p_departure::text||':%'
     and statut = 'EN_ATTENTE';
  if d.statut not in ('CONFIRMEE','EN_OPERATION','TERMINEE') then return; end if;

  select coalesce(sum(nombre_adultes),0), coalesce(sum(nombre_enfants),0)
    into ad, en from public.bookings
    where departure_id = p_departure
      and statut in ('CONFIRMEE','EN_OPERATION','TERMINEE');
  pax := ad + en;
  if pax = 0 then return; end if;

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
      select sid, d.date, 'FACTURE', coalesce(gtar,0), 'AUTO:'||p_departure||':GUIDE', nomsortie||' — guide', 'EN_ATTENTE'
      where not exists (select 1 from public.supplier_transactions t where t.reference = 'AUTO:'||p_departure||':GUIDE');
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
      from public.chauffeurs where id = d.driver_id
        and not exists (select 1 from public.supplier_transactions t where t.reference = 'AUTO:'||p_departure||':CHAUFFEUR');
    end if;
  end if;

  -- TRANSPORT
  if d.transport_id is not null then
    sid := public.ensure_supplier('TRANSPORT', d.transport_id,
      (select nom from public.transports where id = d.transport_id));
    insert into public.supplier_transactions (supplier_id, date, type_operation, montant, reference, description, statut)
    select sid, d.date, 'FACTURE',
           coalesce(d.transport_cout, (select tarif_sortie from public.transports where id = d.transport_id), 0),
           'AUTO:'||p_departure||':TRANSPORT',
           nomsortie||' — transport'||coalesce(' ('||d.transport_mode||')',''), 'EN_ATTENTE'
    where coalesce(d.transport_cout, (select tarif_sortie from public.transports where id = d.transport_id), 0) > 0
      and not exists (select 1 from public.supplier_transactions t where t.reference = 'AUTO:'||p_departure||':TRANSPORT');
  end if;

  -- RESTAURANTS / HÉBERGEMENTS / EXTRAS : prix adulte × adultes + prix enfant × enfants
  for cl in
    select * from public.excursion_cost_lines
    where excursion_id = d.excursion_id
      and partner_type in ('RESTAURANT','HEBERGEMENT','EXTRA')
      and partner_id is not null
      and inclure_comptabilite = true
  loop
    sid := public.ensure_supplier(cl.partner_type, cl.partner_id, cl.nom_depense);
    insert into public.supplier_transactions (supplier_id, date, type_operation, montant, reference, description, statut)
    select
      sid, d.date, 'FACTURE',
      case
        when cl.type_depense in ('PAR_GROUPE','FIXE') then cl.prix_unitaire * cl.quantite
        else cl.prix_unitaire * cl.quantite * ad
             + coalesce(cl.prix_enfant, cl.prix_unitaire) * cl.quantite * en
      end,
      'AUTO:'||p_departure||':CL:'||cl.id,
      nomsortie||' — '||cl.nom_depense||' ('||ad||'A/'||en||'E)',
      'EN_ATTENTE'
    where not exists (select 1 from public.supplier_transactions t where t.reference = 'AUTO:'||p_departure||':CL:'||cl.id);
  end loop;
end $$;
