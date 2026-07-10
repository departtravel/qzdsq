-- ============================================================
--  DTS OPERATION ERP — Mot de passe admin & nom des utilisateurs
--  À exécuter après INSTALL_TOUT.sql. Idempotent.
-- ============================================================

-- Nom affiché de chaque utilisateur (en plus de l'email)
alter table public.profiles add column if not exists full_name text;

-- Secrets réservés aux super admins (mot de passe maître des actions sensibles).
-- Lecture ET écriture uniquement pour les super admins (is_admin()).
create table if not exists public.admin_secrets (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);
insert into public.admin_secrets (key, value) values ('admin_password', '')
on conflict (key) do nothing;

alter table public.admin_secrets enable row level security;
drop policy if exists admin_secrets_read on public.admin_secrets;
create policy admin_secrets_read on public.admin_secrets
  for select using (public.is_admin());
drop policy if exists admin_secrets_write on public.admin_secrets;
create policy admin_secrets_write on public.admin_secrets
  for all using (public.is_admin()) with check (public.is_admin());
