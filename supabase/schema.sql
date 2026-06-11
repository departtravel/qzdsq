-- ============================================================================
-- Centre & Rapatriement — schéma de base de données
-- À exécuter dans Supabase → SQL Editor.
-- ============================================================================

-- Extension pour gen_random_uuid()
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Profils & rôles (admin = écriture, viewer = lecture seule)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  role       text not null default 'viewer' check (role in ('admin', 'viewer')),
  created_at timestamptz not null default now()
);

-- Crée automatiquement un profil à l'inscription d'un utilisateur.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Fonction utilitaire : l'utilisateur courant est-il admin ?
create or replace function public.is_admin()
returns boolean
language sql
stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ----------------------------------------------------------------------------
-- Personnes
-- ----------------------------------------------------------------------------
create table if not exists public.persons (
  id                   uuid primary key default gen_random_uuid(),
  first_name           text not null default '',
  last_name            text not null default '',
  sexe                 text check (sexe in ('M', 'F', 'autre')),
  birth_date           date,
  nationality          text,
  nationality_presumed boolean not null default false,
  doc_type             text not null default 'aucun'
                         check (doc_type in ('cin', 'passeport', 'laissez_passer', 'aucun')),
  passport_number      text,
  doc_country          text,
  situation            text not null default 'non_identifie'
                         check (situation in ('identifie', 'non_identifie', 'en_investigation', 'rapatrie')),
  entry_at             timestamptz not null default now(),
  exit_at              timestamptz,
  remark               text,
  repatriation_country text,
  repatriation_date    date,
  created_at           timestamptz not null default now(),
  created_by           uuid references auth.users (id) on delete set null,
  -- Au moins un nom OU une remarque (cas « inconnu »).
  constraint person_has_label check (
    length(trim(first_name)) > 0 or length(trim(last_name)) > 0 or remark is not null
  )
);

create index if not exists persons_situation_idx on public.persons (situation);
create index if not exists persons_entry_idx on public.persons (entry_at desc);

-- Renseigne created_by automatiquement.
create or replace function public.set_created_by()
returns trigger language plpgsql as $$
begin
  new.created_by := coalesce(new.created_by, auth.uid());
  return new;
end;
$$;

drop trigger if exists persons_set_created_by on public.persons;
create trigger persons_set_created_by
  before insert on public.persons
  for each row execute function public.set_created_by();

-- ----------------------------------------------------------------------------
-- Documents scannés (CIN, passeport, laissez-passer…)
-- ----------------------------------------------------------------------------
create table if not exists public.person_documents (
  id           uuid primary key default gen_random_uuid(),
  person_id    uuid not null references public.persons (id) on delete cascade,
  label        text not null,
  doc_type     text not null default 'aucun'
                 check (doc_type in ('cin', 'passeport', 'laissez_passer', 'aucun')),
  storage_path text not null,
  mime         text,
  size_bytes   bigint,
  uploaded_at  timestamptz not null default now()
);

create index if not exists person_documents_person_idx on public.person_documents (person_id);

-- ----------------------------------------------------------------------------
-- Row Level Security
--   Lecture : tout utilisateur authentifié.
--   Écriture : administrateurs uniquement.
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.persons enable row level security;
alter table public.person_documents enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);

drop policy if exists persons_select on public.persons;
create policy persons_select on public.persons
  for select to authenticated using (true);

drop policy if exists persons_write on public.persons;
create policy persons_write on public.persons
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists docs_select on public.person_documents;
create policy docs_select on public.person_documents
  for select to authenticated using (true);

drop policy if exists docs_write on public.person_documents;
create policy docs_write on public.person_documents
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- Stockage : bucket privé pour les pièces d'identité
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('person-documents', 'person-documents', false)
on conflict (id) do nothing;

-- Lecture des fichiers : tout utilisateur authentifié (via URL signée).
drop policy if exists docs_storage_read on storage.objects;
create policy docs_storage_read on storage.objects
  for select to authenticated
  using (bucket_id = 'person-documents');

-- Écriture / suppression des fichiers : administrateurs uniquement.
drop policy if exists docs_storage_write on storage.objects;
create policy docs_storage_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'person-documents' and public.is_admin());

drop policy if exists docs_storage_delete on storage.objects;
create policy docs_storage_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'person-documents' and public.is_admin());

-- ============================================================================
-- Après exécution : promeus ton compte en administrateur
--   update public.profiles set role = 'admin' where email = 'ton-email@exemple.com';
-- ============================================================================
