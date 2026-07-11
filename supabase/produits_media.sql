-- ============================================================
--  DTS — Médias & réputation produit (vitrine premium)
--  À exécuter APRÈS produits.sql.
-- ============================================================
alter table public.excursions
  add column if not exists image_url     text,
  add column if not exists galerie       text[],        -- URLs de photos supplémentaires
  add column if not exists note_moyenne  numeric check (note_moyenne is null or (note_moyenne >= 0 and note_moyenne <= 5)),
  add column if not exists nb_avis        integer default 0 check (nb_avis >= 0),
  add column if not exists best_seller    boolean not null default false,
  add column if not exists nouveaute      boolean not null default false,
  add column if not exists points_forts   text[];       -- « Guide francophone », « Petit groupe »…
