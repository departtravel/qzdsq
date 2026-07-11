-- ============================================================
--  DTS — AVIS CLIENTS (vitrine)
--  À exécuter APRÈS produits_media.sql.
--  Le client dépose un avis (modéré) ; une fois publié, la note
--  moyenne et le nombre d'avis du produit sont recalculés.
-- ============================================================

create table if not exists public.reviews (
  id           uuid primary key default gen_random_uuid(),
  excursion_id uuid not null references public.excursions(id) on delete cascade,
  client_nom   text not null,
  pays         text,
  note         integer not null check (note between 1 and 5),
  commentaire  text,
  statut       text not null default 'EN_ATTENTE'
               check (statut in ('EN_ATTENTE','PUBLIE','REJETE')),
  created_at   timestamptz not null default now()
);
create index if not exists reviews_excursion_idx on public.reviews (excursion_id, statut);

-- ----- Recalcul de la note du produit -----------------------
create or replace function public.recalc_note_produit(p_excursion uuid)
returns void language sql as $$
  update public.excursions e set
    note_moyenne = sub.moy,
    nb_avis      = sub.n
  from (
    select round(avg(note)::numeric, 1) as moy, count(*) as n
    from public.reviews
    where excursion_id = p_excursion and statut = 'PUBLIE'
  ) sub
  where e.id = p_excursion;
$$;

create or replace function public.reviews_after_change()
returns trigger language plpgsql as $$
begin
  perform public.recalc_note_produit(coalesce(new.excursion_id, old.excursion_id));
  return null;
end $$;

drop trigger if exists reviews_recalc on public.reviews;
create trigger reviews_recalc
  after insert or update or delete on public.reviews
  for each row execute function public.reviews_after_change();

-- ----- RLS ---------------------------------------------------
alter table public.reviews enable row level security;

-- Lecture publique : uniquement les avis PUBLIÉS.
drop policy if exists reviews_public_read on public.reviews;
create policy reviews_public_read on public.reviews
  for select using (statut = 'PUBLIE');

-- L'équipe voit tout (modération).
drop policy if exists reviews_admin_read on public.reviews;
create policy reviews_admin_read on public.reviews
  for select using (auth.role() = 'authenticated');

-- Le client anonyme peut déposer un avis (en attente de modération).
drop policy if exists reviews_public_insert on public.reviews;
create policy reviews_public_insert on public.reviews
  for insert with check (statut = 'EN_ATTENTE');

-- Modération réservée à l'agence.
drop policy if exists reviews_admin_write on public.reviews;
create policy reviews_admin_write on public.reviews
  for all using (public.is_admin()) with check (public.is_admin());
