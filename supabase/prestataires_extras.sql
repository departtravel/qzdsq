-- ============================================================
--  DTS OPERATION ERP — Fiches prestataires enrichies + extras liés
--  - Coordonnées & matricule fiscal sur tous les référentiels
--  - Un extra/supplément peut être RATTACHÉ à un prestataire :
--    la fiche comptabilité tombe alors chez CE prestataire
--    (ex : supplément single/tente de luxe -> hébergement ;
--     quad/dromadaire/4x4 -> le prestataire activité X),
--    à la même date et sur la même excursion.
--  À exécuter après INSTALL_TOUT.sql. Idempotent.
-- ============================================================

-- ---- Coordonnées & fiscalité sur chaque référentiel -----------
alter table public.guides         add column if not exists matricule_fiscal text;
alter table public.guides         add column if not exists adresse text;
alter table public.guides         add column if not exists email text;

alter table public.chauffeurs     add column if not exists matricule_fiscal text;
alter table public.chauffeurs     add column if not exists adresse text;
alter table public.chauffeurs     add column if not exists email text;

alter table public.restaurants    add column if not exists matricule_fiscal text;
alter table public.restaurants    add column if not exists adresse text;
alter table public.restaurants    add column if not exists email text;

alter table public.accommodations add column if not exists matricule_fiscal text;
alter table public.accommodations add column if not exists adresse text;
alter table public.accommodations add column if not exists email text;
alter table public.accommodations add column if not exists telephone text;

alter table public.transports     add column if not exists matricule_fiscal text;
alter table public.transports     add column if not exists adresse text;

alter table public.suppliers      add column if not exists matricule_fiscal text;
alter table public.suppliers      add column if not exists adresse text;
alter table public.suppliers      add column if not exists email text;

-- ---- Rattachement d'un extra à un prestataire -----------------
-- prestataire_id existe déjà ; on ajoute le TYPE pour savoir dans
-- quel référentiel il pointe (miroir de ensure_supplier).
alter table public.extras add column if not exists prestataire_type text;
  -- HEBERGEMENT | RESTAURANT | TRANSPORT | GUIDE | CHAUFFEUR | (null = extra autonome)

-- ---- Nom d'un prestataire (pour créer/retrouver le fournisseur) -
create or replace function public.prestataire_nom(p_type text, p_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select case p_type
    when 'HEBERGEMENT' then (select nom from public.accommodations where id = p_id)
    when 'RESTAURANT'  then (select nom from public.restaurants   where id = p_id)
    when 'TRANSPORT'   then (select nom from public.transports    where id = p_id)
    when 'GUIDE'       then (select trim(coalesce(nom,'')||' '||coalesce(prenom,'')) from public.guides where id = p_id)
    when 'CHAUFFEUR'   then (select trim(coalesce(nom,'')||' '||coalesce(prenom,'')) from public.chauffeurs where id = p_id)
    else null end
$$;
