-- ============================================================
-- DTS OPERATION ERP — MISE À JOUR (sorties, flotte, catalogue DTS)
-- Colle TOUT ce fichier dans Supabase > SQL Editor > Run without RLS.
-- Ré-exécutable sans risque.
-- ============================================================

-- >>>>>>>>>>>>>>>>>> flotte_erp.sql <<<<<<<<<<<<<<<<<<

-- ============================================================
--  DTS OPERATION ERP — Flotte : places & mode de possession
--  À exécuter après schema.sql. Idempotent.
-- ============================================================
alter table public.vehicles add column if not exists places integer check (places >= 0);
alter table public.vehicles add column if not exists mode_possession text;
  -- PROPRIETE | LOCATION_LONGUE_DUREE | LOCATION_EXCURSION
alter table public.vehicles add column if not exists leasing_mensuel numeric check (leasing_mensuel >= 0);
  -- si PROPRIETE (mensualité de leasing/crédit, 0 si payé)
alter table public.vehicles add column if not exists loyer_mensuel numeric check (loyer_mensuel >= 0);
  -- si LOCATION_LONGUE_DUREE (prix par mois)
alter table public.vehicles add column if not exists tarif_excursion numeric check (tarif_excursion >= 0);
  -- si LOCATION_EXCURSION (tarif par sortie)

-- >>>>>>>>>>>>>>>>>> sorties.sql <<<<<<<<<<<<<<<<<<

-- ============================================================
--  DTS OPERATION ERP — Sorties (départs) & extras par réservation
--  À exécuter après erp.sql / rbac.sql. Idempotent.
--
--  Modèle : plusieurs RÉSERVATIONS (bookings) du même produit et
--  de la même date sont regroupées en une SORTIE (departure) à
--  laquelle on affecte un guide + un transport/véhicule.
-- ============================================================

-- ----- Sorties (départs opérationnels) ----------------------
create table if not exists public.departures (
  id           uuid primary key default gen_random_uuid(),
  date         date not null,
  excursion_id uuid references public.excursions(id) on delete set null,
  guide_id     uuid references public.guides(id) on delete set null,
  vehicle_id   uuid references public.erp_vehicles(id) on delete set null,
  driver_id    uuid references public.chauffeurs(id) on delete set null,
  transport_id uuid references public.transports(id) on delete set null,
  statut       text not null default 'PLANIFIEE', -- PLANIFIEE | CONFIRMEE | TERMINEE | ANNULEE
  notes        text,
  created_at   timestamptz not null default now()
);
create index if not exists departures_date_idx on public.departures (date);

-- Lien réservation -> sortie
alter table public.bookings
  add column if not exists departure_id uuid references public.departures(id) on delete set null;

-- ----- Extras choisis par réservation -----------------------
create table if not exists public.booking_extras (
  id         uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  extra_id   uuid not null references public.extras(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (booking_id, extra_id)
);
create index if not exists booking_extras_booking_idx on public.booking_extras (booking_id);

-- ----- RLS --------------------------------------------------
alter table public.departures enable row level security;
drop policy if exists departures_read on public.departures;
create policy departures_read on public.departures
  for select using (auth.role() = 'authenticated');
drop policy if exists departures_write on public.departures;
create policy departures_write on public.departures for all
  using (public.has_erp_role('OPERATIONS','LOGISTIQUE'))
  with check (public.has_erp_role('OPERATIONS','LOGISTIQUE'));

alter table public.booking_extras enable row level security;
drop policy if exists booking_extras_read on public.booking_extras;
create policy booking_extras_read on public.booking_extras
  for select using (auth.role() = 'authenticated');
drop policy if exists booking_extras_write on public.booking_extras;
create policy booking_extras_write on public.booking_extras for all
  using (public.has_erp_role('RESERVATION','CONFIRMATION','OPERATIONS','LOGISTIQUE'))
  with check (public.has_erp_role('RESERVATION','CONFIRMATION','OPERATIONS','LOGISTIQUE'));

-- >>>>>>>>>>>>>>>>>> seed_dts_catalogue.sql <<<<<<<<<<<<<<<<<<

-- ============================================================
--  DTS OPERATION ERP — Catalogue GetYourGuide DTS (Compte 3)
--  À exécuter dans Supabase > SQL Editor. Idempotent.
--  Prix en EUR. Commission 30 %, taux 3,34 (valeurs par défaut).
--  Les options multiples sont éclatées en produits distincts.
-- ============================================================
insert into public.excursions
  (code_interne, nom, ota_channel_id, compte_ota, ville_depart, duree, nombre_jours, prix_adulte, prix_enfant)
select v.code, v.nom, o.id, 'GetYourGuide DTS', v.ville, v.duree, v.jours, v.pa, v.pe
from (values
  ('GYG-DTS-001', 'Depuis Sousse : excursion express de 2 jours dans le Sahara', 'Sousse', '2 jours', 2, 135, 120),
  ('GYG-DTS-002', 'Depuis Hammamet : excursion express de 2 jours dans le Sahara', 'Hammamet', '2 jours', 2, 135, 125),
  ('GYG-DTS-003', 'Depuis Tunis : excursion express de 2 jours dans le Sahara', 'Tunis', '2 jours', 2, 175, 100),
  ('GYG-DTS-004', 'Expérience premium dans le Sahara', 'Tunis', '2 jours', 2, 275, 185),
  ('GYG-DTS-005', 'Circuit de 3 jours dans le sud et le Sahara (Tunis, Sousse, Hammamet)', 'Tunis', '3 jours', 3, 350, 350),
  ('GYG-DTS-006', 'Tournée des bars de Djerba : buvez, dansez et explorez Djerba', 'Djerba', 'soirée', 1, 37, 37),
  ('GYG-DTS-007', 'Transfert Djerba : hôtels de Djerba vers aéroport de Djerba', 'Djerba', 'transfert', 1, 20, 20),
  ('GYG-DTS-008', 'Transfert Djerba : aéroport de Djerba vers hôtels de Djerba', 'Djerba', 'transfert', 1, 25, 25),
  ('GYG-DTS-009', 'Transfert Djerba : aéroport de Djerba vers hôtels de Zarzis', 'Djerba', 'transfert', 1, 45, 45),
  ('GYG-DTS-010', 'Kairouan et El Jem (déjeuner inclus) : avec votre propre voiture', 'Kairouan', 'journée', 1, 15, 10),
  ('GYG-DTS-011', 'Depuis Sousse : journée guidée à Kairouan et El Jem', 'Sousse', 'journée', 1, 75, 55),
  ('GYG-DTS-012', 'Depuis Hammamet : journée guidée à Kairouan et El Jem', 'Hammamet', 'journée', 1, 85, 60),
  ('GYG-DTS-013', 'Depuis Tunis : journée guidée à Kairouan et El Jem avec déjeuner', 'Tunis', 'journée', 1, 130, 80),
  ('GYG-DTS-014', 'Hammamet : excursion de 3 jours à Djerba, El Jem et le Sahara', 'Hammamet', '3 jours', 3, 325, 270),
  ('GYG-DTS-015', 'Tunis : Médina, Bardo, Carthage et Sidi Bou Saïd avec déjeuner', 'Tunis', 'journée', 1, 60, 45),
  ('GYG-DTS-016', 'Hammamet : Médina, Bardo, Carthage et Sidi Bou Saïd avec déjeuner', 'Hammamet', 'journée', 1, 80, 60),
  ('GYG-DTS-017', 'Sousse : Médina, Bardo, Carthage et Sidi Bou Saïd avec déjeuner', 'Sousse', 'journée', 1, 119, 85),
  ('GYG-DTS-018', 'Djerba : excursion 4x4 dans le Sahara et une nuit sous tente', 'Djerba', '2 jours', 2, 130, 90),
  ('GYG-DTS-019', 'Djerba/Zarzis : journée à Ksar Ghilane, Tataouine et Chenini', 'Djerba', 'journée', 1, 69, 55),
  ('GYG-DTS-020', 'Depuis Djerba : Sahara en 4x4 à Ksar Ghilane et Matmata', 'Djerba', 'journée', 1, 69, 49),
  ('GYG-DTS-021', 'Djerba Explore : crocodiles, reptiles et musées', 'Djerba', 'demi-journée', 1, 24, 12),
  ('GYG-DTS-022', 'Depuis Tunis et Hammamet : 2 jours dans le Sahara avec nuit sous tente', 'Tunis', '2 jours', 2, 125, 125),
  ('GYG-DTS-023', 'Tataouine et Chenini : visite d''une journée guidée', 'Tataouine', 'journée', 1, 49, 40),
  ('GYG-DTS-024', 'Djerba : balade à dos de chameau de 3 heures (Lagon bleu et plage de Seguia)', 'Djerba', 'activité', 1, 25, 20),
  ('GYG-DTS-025', 'Tunis et Hammamet : croisière pirate avec déjeuner et baignade', 'Hammamet', 'journée', 1, 45, 30),
  ('GYG-DTS-026', 'Tunis : sortie en bateau au coucher du soleil, dîner et Sidi Bou Saïd', 'Tunis', 'soirée', 1, 30, 20),
  ('GYG-DTS-027', 'Djerba : 1h30 de jet ski à usage individuel', 'Djerba', 'activité', 1, 105, 105),
  ('GYG-DTS-028', 'Djerba : 1h30 de jet ski à usage double', 'Djerba', 'activité', 1, 109, 109),
  ('GYG-DTS-029', 'Depuis Djerba et Zarzis : 2 jours dans le Sahara, nuit sous tente + quad', 'Djerba', '2 jours', 2, 130, 130),
  ('GYG-DTS-030', 'Paddle & Sunset à Djerba + dîner traditionnel sur la plage', 'Djerba', 'activité', 1, 45, 35),
  ('GYG-DTS-031', 'Croisière d''une demi-journée à Djerba avec barbecue et arrêts baignade', 'Djerba', 'demi-journée', 1, 53, 49),
  ('GYG-DTS-032', 'Depuis Tunis : demi-journée guidée à Carthage et Sidi Bou Saïd', 'Tunis', 'demi-journée', 1, 30, 20),
  ('GYG-DTS-033', 'Depuis Hammamet : demi-journée guidée à Carthage et Sidi Bou Saïd', 'Hammamet', 'demi-journée', 1, 45, 30),
  ('GYG-DTS-034', 'Depuis Sousse : demi-journée guidée à Carthage et Sidi Bou Saïd', 'Sousse', 'demi-journée', 1, 60, 45),
  ('GYG-DTS-035', 'Excursion 4x4 au Sahara : coucher de soleil, lever de soleil et nuit sous tente', 'Djerba', '2 jours', 2, 124, 83),
  ('GYG-DTS-036', 'Djerba : quad, chameau et balade à cheval avec prise en charge', 'Djerba', 'journée', 1, 75, 55),
  ('GYG-DTS-037', 'Depuis Djerba : circuit de 2 jours à Tozeur et à l''oasis de montagne', 'Djerba', '2 jours', 2, 170, 170),
  ('GYG-DTS-038', 'Hammamet : visite de Carthage et croisière pirate', 'Hammamet', 'journée', 1, 85, 65),
  ('GYG-DTS-039', 'Circuit de 3 jours sur les lieux de tournage de Star Wars', 'Tozeur', '3 jours', 3, 750, 750),
  ('GYG-DTS-040', 'Depuis Djerba : circuit de 3 jours dans le désert tunisien', 'Djerba', '3 jours', 3, 690, 690),
  ('GYG-DTS-041', 'Depuis Hammamet et Sousse : demi-journée au parc animalier Friguia', 'Hammamet', 'demi-journée', 1, 36, 25),
  ('GYG-DTS-042', 'Depuis Djerba et Zarzis : Tataouine, Chenini et Ksar Hadada', 'Djerba', 'journée', 1, 49, 40),
  ('GYG-DTS-043', 'Depuis Tozeur : circuit 4x4 dans les dunes de sable et Mos Espa', 'Tozeur', 'journée', 1, 43, 43),
  ('GYG-DTS-044', 'Depuis Djerba et Zarzis : Tataouine-Chenini et Star Wars', 'Djerba', 'journée', 1, 49, 39),
  ('GYG-DTS-045', 'Demi-journée en calèche avec déjeuner de poisson grillé et baignade', 'Djerba', 'demi-journée', 1, 70, 70),
  ('GYG-DTS-046', 'Djerba : visite guidée privée d''une demi-journée des temps forts de l''île', 'Djerba', 'demi-journée', 1, 70, 70),
  ('GYG-DTS-047', 'De Djerba : Flamingo Island en bateau pirate avec déjeuner', 'Djerba', 'journée', 1, 20, 20),
  ('GYG-DTS-048', 'Visite de 2 heures en calèche au coucher du soleil (campagne et lagune)', 'Djerba', 'activité', 1, 19, 10),
  ('GYG-DTS-049', 'Djerba : aventure en quad de 3 heures avec prise en charge et boisson', 'Djerba', 'activité', 1, 40, 30),
  ('GYG-DTS-050', 'À ne pas manquer à Djerba : visite de l''île en petit groupe (demi-journée)', 'Djerba', 'demi-journée', 1, 19, 15),
  ('GYG-DTS-051', 'Au départ de Djerba : visite privée de 5 jours sur la Guerre des étoiles', 'Djerba', '5 jours', 5, 1550, 1550),
  ('GYG-DTS-052', 'Djerba : 2 heures en bateau pour observer les dauphins', 'Djerba', 'activité', 1, 41, 34),
  ('GYG-DTS-053', 'Djerba : 3 heures de randonnée guidée en quad avec le Lagon Bleu', 'Djerba', 'activité', 1, 51, 51),
  ('GYG-DTS-054', 'Tozeur : oasis de montagne (Chebika, Tamerza et Ong Jmel)', 'Tozeur', 'journée', 1, 100, 75),
  ('GYG-DTS-055', 'Au départ de Hammamet : visite guidée d''une journée à Tunis', 'Hammamet', 'journée', 1, 90, 55),
  ('GYG-DTS-056', 'Djerba : excursion de pêche d''une demi-journée avec transferts hôtel', 'Djerba', 'demi-journée', 1, 75, 50),
  ('GYG-DTS-057', 'Djerba : vol en parachute ascensionnel et sortie en bateau', 'Djerba', 'activité', 1, 45, 45),
  ('GYG-DTS-058', 'De Tozeur & Naftah : assister au lever du soleil à Chott Djerid', 'Tozeur', 'activité', 1, 70, 70)
) as v(code, nom, ville, duree, jours, pa, pe)
join public.ota_channels o on o.nom = 'GetYourGuide DTS'
on conflict (code_interne) do nothing;

