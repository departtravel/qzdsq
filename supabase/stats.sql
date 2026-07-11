-- ============================================================
--  DTS — STATISTIQUES vitrine (compteur de visites)
--  À exécuter APRÈS erp.sql.
--  Permet de calculer un vrai TAUX DE CONVERSION (résas / visites).
--  Une ligne par session de visiteur (anonyme), lecture équipe.
-- ============================================================

create table if not exists public.site_visits (
  id         uuid primary key default gen_random_uuid(),
  path       text,
  session_id text,               -- identifiant de session (anonyme, généré côté client)
  created_at timestamptz not null default now()
);
create index if not exists site_visits_created_idx on public.site_visits (created_at);

alter table public.site_visits enable row level security;

-- Le visiteur anonyme peut enregistrer sa visite ; il ne lit rien.
drop policy if exists site_visits_public_insert on public.site_visits;
create policy site_visits_public_insert on public.site_visits
  for insert with check (true);

drop policy if exists site_visits_read on public.site_visits;
create policy site_visits_read on public.site_visits
  for select using (auth.role() = 'authenticated');
