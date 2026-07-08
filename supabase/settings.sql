-- ============================================================
--  DTS OPERATION ERP — Paramètres généraux (logo, coordonnées)
--  À exécuter APRÈS supabase/rbac.sql. Idempotent.
-- ============================================================
create table if not exists public.app_settings (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);

-- Valeurs par défaut (coordonnées imprimées sur les documents).
insert into public.app_settings (key, value) values
  ('company_name', 'Depart Travel Services'),
  ('company_info', ''),
  ('logo', '')
on conflict (key) do nothing;

alter table public.app_settings enable row level security;
drop policy if exists app_settings_read on public.app_settings;
create policy app_settings_read on public.app_settings
  for select using (auth.role() = 'authenticated');
drop policy if exists app_settings_write on public.app_settings;
create policy app_settings_write on public.app_settings for all
  using (public.is_admin()) with check (public.is_admin()); -- ADMIN seulement
