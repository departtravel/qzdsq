-- ============================================================
--  DTS — DEMANDES DE DEVIS (événements + circuits sur mesure)
--  À exécuter APRÈS erp.sql.
--  Un visiteur anonyme envoie une demande ; l'équipe la traite.
--  Table générique réutilisée par l'onglet Événements ET par le
--  créateur de circuit sur mesure (champ details en JSON).
-- ============================================================

create table if not exists public.quote_requests (
  id               uuid primary key default gen_random_uuid(),
  type             text not null default 'AUTRE'
                   check (type in ('TEAM_BUILDING','EVG','EVJF','MARIAGE','CIRCUIT','AUTRE')),
  client_nom       text,
  client_email     text,
  client_telephone text,
  nb_personnes     integer check (nb_personnes is null or nb_personnes >= 0),
  date_souhaitee   date,
  ville_depart     text,
  budget           numeric check (budget is null or budget >= 0),
  devise           text default 'EUR',
  message          text,
  details          jsonb,            -- itinéraire du circuit sur mesure, options…
  montant_estime   numeric,          -- estimation indicative calculée côté client
  statut           text not null default 'NOUVELLE'
                   check (statut in ('NOUVELLE','EN_COURS','DEVIS_ENVOYE','GAGNE','PERDU')),
  lu               boolean not null default false,
  source           text default 'WEB',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists quote_requests_statut_idx
  on public.quote_requests (statut, created_at desc);

-- ----- RLS ---------------------------------------------------
alter table public.quote_requests enable row level security;

drop policy if exists quote_requests_read on public.quote_requests;
create policy quote_requests_read on public.quote_requests
  for select using (auth.role() = 'authenticated');

drop policy if exists quote_requests_write on public.quote_requests;
create policy quote_requests_write on public.quote_requests
  for all using (public.is_admin()) with check (public.is_admin());

-- Le visiteur anonyme peut CRÉER une demande (statut NOUVELLE).
drop policy if exists quote_requests_public_insert on public.quote_requests;
create policy quote_requests_public_insert on public.quote_requests
  for insert with check (statut = 'NOUVELLE' and source = 'WEB');
