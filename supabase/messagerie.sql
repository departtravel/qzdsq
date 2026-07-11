-- ============================================================
--  DTS — MESSAGERIE (contact client → agence)
--  À exécuter APRÈS erp.sql.
--  Le visiteur anonyme peut OUVRIR une conversation et ENVOYER
--  des messages ; l'équipe (authentifiée) lit tout et répond.
-- ============================================================

create table if not exists public.conversations (
  id               uuid primary key default gen_random_uuid(),
  client_nom       text,
  client_email     text,
  client_telephone text,
  sujet            text,
  excursion_id     uuid references public.excursions(id) on delete set null,
  statut           text not null default 'OUVERTE'
                   check (statut in ('OUVERTE','EN_COURS','FERMEE')),
  lu               boolean not null default false,   -- lu par l'agence ?
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists conversations_statut_idx
  on public.conversations (statut, updated_at desc);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  expediteur      text not null check (expediteur in ('CLIENT','AGENCE')),
  corps           text not null,
  created_at      timestamptz not null default now()
);
create index if not exists messages_conversation_idx
  on public.messages (conversation_id, created_at);

-- ----- RLS ---------------------------------------------------
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Lecture réservée à l'équipe authentifiée.
drop policy if exists conversations_read on public.conversations;
create policy conversations_read on public.conversations
  for select using (auth.role() = 'authenticated');
drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages
  for select using (auth.role() = 'authenticated');

-- Écriture (mise à jour statut, réponses) réservée à l'agence.
drop policy if exists conversations_write on public.conversations;
create policy conversations_write on public.conversations
  for all using (public.is_admin()) with check (public.is_admin());

-- Le client anonyme peut ouvrir une conversation…
drop policy if exists conversations_public_insert on public.conversations;
create policy conversations_public_insert on public.conversations
  for insert with check (statut = 'OUVERTE');

-- …et envoyer des messages CLIENT (jamais des messages AGENCE).
drop policy if exists messages_public_insert on public.messages;
create policy messages_public_insert on public.messages
  for insert with check (expediteur = 'CLIENT');
-- Les réponses AGENCE sont insérées par l'équipe (policy admin ci-dessous).
drop policy if exists messages_agence_write on public.messages;
create policy messages_agence_write on public.messages
  for all using (public.is_admin()) with check (public.is_admin());
