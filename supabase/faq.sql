-- ============================================================
--  DTS — FAQ éditable (SEO : rich results FAQPage)
--  À exécuter APRÈS erp.sql.
--  FAQ générale (excursion_id null) ou spécifique à un produit.
-- ============================================================
create table if not exists public.faqs (
  id           uuid primary key default gen_random_uuid(),
  excursion_id uuid references public.excursions(id) on delete cascade,
  question     text not null,
  reponse      text not null,
  categorie    text,
  ordre        integer not null default 0,
  actif        boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists faqs_ordre_idx on public.faqs (excursion_id, ordre);

alter table public.faqs enable row level security;

drop policy if exists faqs_public_read on public.faqs;
create policy faqs_public_read on public.faqs
  for select using (actif = true);

drop policy if exists faqs_admin_write on public.faqs;
create policy faqs_admin_write on public.faqs
  for all using (public.is_admin()) with check (public.is_admin());

-- Quelques questions par défaut (SEO).
insert into public.faqs (question, reponse, ordre) values
  ('Comment réserver une excursion ?', 'Choisissez votre ville de départ, votre excursion, la date et vos options, puis validez en ligne. Vous recevez une confirmation immédiate par e-mail.', 1),
  ('Le paiement est-il sécurisé ?', 'Oui, les paiements en ligne sont traités par Stripe. Vous pouvez régler un acompte ou la totalité.', 2),
  ('Puis-je annuler ma réservation ?', 'La plupart de nos excursions bénéficient de l''annulation gratuite. Les conditions précises figurent sur chaque fiche.', 3),
  ('Proposez-vous des sorties privées ?', 'Oui, la majorité de nos excursions existent en version groupe et en version privative. Nous organisons aussi des circuits 100 % sur mesure.', 4)
on conflict do nothing;
