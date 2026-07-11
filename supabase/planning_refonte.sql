-- ============================================================
--  DTS OPERATION ERP — Refonte Planning
--  - ordre d'affichage des réservations (glisser-déposer)
--  - plusieurs GUIDES et plusieurs TRANSPORTS par départ
--    (chaque transport a son chauffeur + coût + mode)
--  - recalcul compta adapté
--  À exécuter après INSTALL_TOUT.sql. Idempotent.
-- ============================================================

alter table public.bookings add column if not exists ordre integer not null default 0;

-- Plusieurs guides par départ
create table if not exists public.departure_guides (
  id           uuid primary key default gen_random_uuid(),
  departure_id uuid not null references public.departures(id) on delete cascade,
  guide_id     uuid not null references public.guides(id) on delete cascade,
  unique (departure_id, guide_id)
);

-- Plusieurs transports par départ (chacun avec chauffeur, coût, mode)
create table if not exists public.departure_transports (
  id           uuid primary key default gen_random_uuid(),
  departure_id uuid not null references public.departures(id) on delete cascade,
  transport_id uuid references public.transports(id) on delete set null,
  vehicle_id   uuid references public.erp_vehicles(id) on delete set null,
  chauffeur_id uuid references public.chauffeurs(id) on delete set null,
  cout         numeric check (cout >= 0),
  mode         text,  -- PARC | LONGUE_DUREE | JOURNALIERE
  unique (departure_id, transport_id)
);

create index if not exists dep_guides_idx on public.departure_guides (departure_id);
create index if not exists dep_transports_idx on public.departure_transports (departure_id);

-- RLS
do $$
declare t text;
begin
  foreach t in array array['departure_guides','departure_transports'] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I_read on public.%I;', t, t);
    execute format('create policy %I_read on public.%I for select using (auth.role() = %L);', t, t, 'authenticated');
    execute format('drop policy if exists %I_write on public.%I;', t, t);
    execute format('create policy %I_write on public.%I for all using (public.has_erp_role(%L,%L)) with check (public.has_erp_role(%L,%L));',
      t, t, 'OPERATIONS','LOGISTIQUE','OPERATIONS','LOGISTIQUE');
  end loop;
end $$;

-- Backfill : migre les affectations simples existantes vers les tables de liaison.
insert into public.departure_guides (departure_id, guide_id)
select id, guide_id from public.departures d
where guide_id is not null
  and not exists (select 1 from public.departure_guides g where g.departure_id = d.id and g.guide_id = d.guide_id);

insert into public.departure_transports (departure_id, transport_id, vehicle_id, chauffeur_id, cout, mode)
select id, transport_id, vehicle_id, driver_id, transport_cout, transport_mode from public.departures d
where transport_id is not null
  and not exists (select 1 from public.departure_transports t where t.departure_id = d.id and t.transport_id = d.transport_id);

-- ============================================================
--  Recalcul compta : boucle sur les guides et transports du départ
-- ============================================================
create or replace function public.recompute_departure_costs(p_departure uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  d record; exc record;
  ad int; en int; pax int; jours int;
  gtar numeric; sid uuid; cl record; g record; tr record; bx record; nomsortie text;
begin
  select * into d from public.departures where id = p_departure;
  if not found then return; end if;

  delete from public.supplier_transactions
   where reference like 'AUTO:'||p_departure::text||':%' and statut = 'EN_ATTENTE';
  if d.statut not in ('CONFIRMEE','EN_OPERATION','TERMINEE') then return; end if;

  select coalesce(sum(nombre_adultes),0), coalesce(sum(nombre_enfants),0)
    into ad, en from public.bookings
    where departure_id = p_departure and statut not in ('NOUVELLE','ANNULEE');
  pax := ad + en;
  if pax = 0 then return; end if;

  select * into exc from public.excursions where id = d.excursion_id;
  jours := coalesce(exc.nombre_jours, 1);
  nomsortie := 'Sortie '||coalesce(exc.nom,'')||' du '||coalesce(d.date::text,'');

  -- GUIDES (extras) : un par ligne de departure_guides
  for g in select dg.guide_id from public.departure_guides dg where dg.departure_id = p_departure loop
    perform 1 from public.guides where id = g.guide_id and type_guide = 'EXTRA';
    if found then
      select case when jours >= 2 then deux_jours when exc.duree ilike 'demi%' then demi_journee else journee end
        into gtar from public.guide_prices where guide_id = g.guide_id order by date_application desc limit 1;
      if gtar is null then
        select case when jours >= 2 then deux_jours when exc.duree ilike 'demi%' then demi_journee else journee end
          into gtar from public.guide_prices where guide_id is null order by date_application desc limit 1;
      end if;
      sid := public.ensure_supplier('GUIDE', g.guide_id,
        (select trim(coalesce(nom,'')||' '||coalesce(prenom,'')) from public.guides where id = g.guide_id));
      insert into public.supplier_transactions (supplier_id, date, type_operation, montant, reference, description, statut)
      select sid, d.date, 'FACTURE', coalesce(gtar,0), 'AUTO:'||p_departure||':GUIDE:'||g.guide_id, nomsortie||' — guide', 'EN_ATTENTE'
      where not exists (select 1 from public.supplier_transactions t where t.reference = 'AUTO:'||p_departure||':GUIDE:'||g.guide_id);
    end if;
  end loop;

  -- TRANSPORTS + leur chauffeur : un par ligne de departure_transports
  for tr in select * from public.departure_transports where departure_id = p_departure loop
    if tr.transport_id is not null then
      sid := public.ensure_supplier('TRANSPORT', tr.transport_id, (select nom from public.transports where id = tr.transport_id));
      insert into public.supplier_transactions (supplier_id, date, type_operation, montant, reference, description, statut)
      select sid, d.date, 'FACTURE',
             coalesce(tr.cout, (select tarif_sortie from public.transports where id = tr.transport_id), 0),
             'AUTO:'||p_departure||':TRANSPORT:'||tr.transport_id, nomsortie||' — transport', 'EN_ATTENTE'
      where coalesce(tr.cout, (select tarif_sortie from public.transports where id = tr.transport_id), 0) > 0
        and not exists (select 1 from public.supplier_transactions t where t.reference = 'AUTO:'||p_departure||':TRANSPORT:'||tr.transport_id);
    end if;
    if tr.chauffeur_id is not null then
      perform 1 from public.chauffeurs where id = tr.chauffeur_id and type_chauffeur = 'EXTRA';
      if found then
        sid := public.ensure_supplier('CHAUFFEUR', tr.chauffeur_id,
          (select trim(coalesce(nom,'')||' '||coalesce(prenom,'')) from public.chauffeurs where id = tr.chauffeur_id));
        insert into public.supplier_transactions (supplier_id, date, type_operation, montant, reference, description, statut)
        select sid, d.date, 'FACTURE', coalesce(tarif_jour,0)*jours, 'AUTO:'||p_departure||':CHAUF:'||tr.chauffeur_id,
               nomsortie||' — chauffeur ('||jours||' j)', 'EN_ATTENTE'
        from public.chauffeurs where id = tr.chauffeur_id
          and not exists (select 1 from public.supplier_transactions t where t.reference = 'AUTO:'||p_departure||':CHAUF:'||tr.chauffeur_id);
      end if;
    end if;
  end loop;

  -- RESTAURANTS / HÉBERGEMENTS / EXTRAS : prix adulte × adultes + prix enfant × enfants
  for cl in
    select * from public.excursion_cost_lines
    where excursion_id = d.excursion_id and partner_type in ('RESTAURANT','HEBERGEMENT','EXTRA','TRANSPORT','GUIDE','CHAUFFEUR')
      and partner_id is not null and inclure_comptabilite = true
  loop
    sid := public.ensure_supplier(cl.partner_type, cl.partner_id, cl.nom_depense);
    insert into public.supplier_transactions (supplier_id, date, type_operation, montant, reference, description, statut)
    select sid, d.date, 'FACTURE',
      case when cl.type_depense in ('PAR_GROUPE','FIXE') then cl.prix_unitaire * cl.quantite
           else cl.prix_unitaire * cl.quantite * ad + coalesce(cl.prix_enfant, cl.prix_unitaire) * cl.quantite * en end,
      'AUTO:'||p_departure||':CL:'||cl.id, nomsortie||' — '||cl.nom_depense||' ('||ad||'A/'||en||'E)', 'EN_ATTENTE'
    where not exists (select 1 from public.supplier_transactions t where t.reference = 'AUTO:'||p_departure||':CL:'||cl.id);
  end loop;

  -- EXTRAS choisis sur les réservations (booking_extras) : une fiche
  -- fournisseur par extra, montant = prix d'achat × quantité, cumulé sur
  -- toutes les réservations confirmées du départ.
  for bx in
    select e.id as extra_id,
           coalesce(e.nom, 'Extra') as nom,
           e.prestataire_type as ptype,
           e.prestataire_id   as pid,
           sum(be.quantite * coalesce(e.prix_achat, 0) + coalesce(be.quantite_enfant,0) * coalesce(e.prix_achat_enfant, e.prix_achat, 0)) as montant
      from public.booking_extras be
      join public.bookings b on b.id = be.booking_id
      join public.extras   e on e.id = be.extra_id
     where b.departure_id = p_departure
       and b.statut not in ('NOUVELLE','ANNULEE')
       and coalesce(e.inclure_comptabilite, true) = true
     group by e.id, e.nom, e.prestataire_type, e.prestataire_id
    having sum(be.quantite * coalesce(e.prix_achat, 0) + coalesce(be.quantite_enfant,0) * coalesce(e.prix_achat_enfant, e.prix_achat, 0)) > 0
  loop
    -- Rattaché à un prestataire ? la fiche tombe chez CE prestataire
    -- (même fournisseur que ses autres coûts) ; sinon fournisseur propre à l'extra.
    if bx.pid is not null and bx.ptype is not null then
      sid := public.ensure_supplier(bx.ptype, bx.pid, public.prestataire_nom(bx.ptype, bx.pid));
    else
      sid := public.ensure_supplier('EXTRA', bx.extra_id, bx.nom);
    end if;
    insert into public.supplier_transactions (supplier_id, date, type_operation, montant, reference, description, statut)
    select sid, d.date, 'FACTURE', bx.montant,
      'AUTO:'||p_departure||':BX:'||bx.extra_id, nomsortie||' — '||bx.nom||' ('||ad||'A/'||en||'E)', 'EN_ATTENTE'
    where not exists (select 1 from public.supplier_transactions t where t.reference = 'AUTO:'||p_departure||':BX:'||bx.extra_id);
  end loop;
end $$;

-- Recalcul quand les guides/transports du départ changent
create or replace function public.tg_deplink_recompute()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.recompute_departure_costs(coalesce(new.departure_id, old.departure_id));
  return null;
end $$;
drop trigger if exists dep_guides_recompute on public.departure_guides;
create trigger dep_guides_recompute after insert or update or delete on public.departure_guides
  for each row execute function public.tg_deplink_recompute();
drop trigger if exists dep_transports_recompute on public.departure_transports;
create trigger dep_transports_recompute after insert or update or delete on public.departure_transports
  for each row execute function public.tg_deplink_recompute();

-- Recalcul quand les extras d'une réservation changent (ajout/retrait/quantité)
create or replace function public.tg_bookingextra_recompute()
returns trigger language plpgsql security definer set search_path = public as $$
declare dep uuid;
begin
  select departure_id into dep from public.bookings
   where id = coalesce(new.booking_id, old.booking_id);
  if dep is not null then perform public.recompute_departure_costs(dep); end if;
  return null;
end $$;
drop trigger if exists booking_extras_recompute on public.booking_extras;
create trigger booking_extras_recompute after insert or update or delete on public.booking_extras
  for each row execute function public.tg_bookingextra_recompute();
