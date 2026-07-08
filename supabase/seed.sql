-- ============================================================
--  DTS OPERATION ERP — Données initiales (seed)
--  À exécuter APRÈS supabase/erp.sql.
--  Ré-exécutable (idempotent via ON CONFLICT / WHERE NOT EXISTS).
--
--  Données RÉELLES du cahier des charges — aucune donnée fictive.
--  Règle GetYourGuide : commission 30 %, taux 1 EUR = 3,34 TND.
-- ============================================================

-- ----- Canaux de vente --------------------------------------
insert into public.ota_channels (nom, commission_percentage, devise) values
  ('GetYourGuide TDE',            30, 'EUR'),
  ('GetYourGuide Tunisia-Trips',  30, 'EUR'),
  ('GetYourGuide DTS',            30, 'EUR'),
  ('Depart Travel Services',       0, 'EUR'),
  ('Viator',                      25, 'EUR'),
  ('TourRadar',                   25, 'EUR'),
  ('Musement',                    25, 'EUR')
on conflict (nom) do nothing;

-- ----- Taux de change ---------------------------------------
insert into public.exchange_rates (devise, taux, date) values
  ('EUR', 3.34, current_date),
  ('USD', 3.10, current_date)
on conflict (devise, date) do nothing;

-- ----- Restaurants + prix -----------------------------------
insert into public.restaurants (nom, ville) values
  ('Sidi Idriss', 'Sahara'),
  ('Ammar El Jem', 'El Jem'),
  ('Port Aghir', 'Djerba'),
  ('Monte Carlo', 'Tunis'),
  ('Sahara Lounge', 'Sahara'),
  ('Les Jardins', 'Sahara'),
  ('El Borj', 'Tataouine')
on conflict do nothing;

insert into public.restaurant_prices (restaurant_id, date_debut, prix_adulte, prix_enfant, prix_bebe)
select r.id, date '2025-01-01', v.pa, v.pe, 0
from (values
  ('Sidi Idriss', 15, 7.5),
  ('Ammar El Jem', 25, 12.5),
  ('Port Aghir', 30, 15),
  ('Monte Carlo', 30, 15),
  ('Sahara Lounge', 15, 7.5),
  ('Les Jardins', 15, 7.5),
  ('El Borj', 15, 7.5)
) as v(nom, pa, pe)
join public.restaurants r on r.nom = v.nom
where not exists (select 1 from public.restaurant_prices p where p.restaurant_id = r.id);

-- Historique : Sidi Idriss passe à 18 DT en 2026
insert into public.restaurant_prices (restaurant_id, date_debut, prix_adulte, prix_enfant, prix_bebe)
select r.id, date '2026-01-01', 18, 9, 0
from public.restaurants r
where r.nom = 'Sidi Idriss'
  and not exists (
    select 1 from public.restaurant_prices p
    where p.restaurant_id = r.id and p.date_debut = date '2026-01-01');

-- ----- Hébergements + prix ----------------------------------
insert into public.accommodations (nom, type, ville) values
  ('Sahara Lounge', 'CAMP', 'Sahara'),
  ('Dunes Insolites', 'CAMP', 'Sahara')
on conflict do nothing;

insert into public.accommodation_prices (accommodation_id, date, prix_adulte, prix_enfant, prix_bebe)
select a.id, date '2025-01-01', v.pa, v.pe, 0
from (values
  ('Sahara Lounge', 55, 35),
  ('Dunes Insolites', 90, 45)
) as v(nom, pa, pe)
join public.accommodations a on a.nom = v.nom
where not exists (select 1 from public.accommodation_prices p where p.accommodation_id = a.id);

-- ----- Extras -----------------------------------------------
insert into public.extras (nom, categorie, type_tarification, prix_achat, devise_achat, prix_vente, devise_vente, capacite, inclure_comptabilite) values
  ('Ticket El Jem',            'ENTREE',  'PAR_PERSONNE', 20,  'TND', 0,   'EUR', null, true),
  ('Dromadaire',               'ANIMAL',  'PAR_PERSONNE', 20,  'TND', 25,  'EUR', null, true),
  ('Quad simple',              'QUAD',    'PAR_VEHICULE', 40,  'TND', 45,  'EUR', 1,    true),
  ('Quad double',              'QUAD',    'PAR_VEHICULE', 40,  'TND', 60,  'EUR', 2,    true),
  ('4x4 Ong Jmal',             '4X4',     'PAR_VEHICULE', 180, 'TND', 0,   'EUR', 5,    true),
  ('4x4 (5 pers)',             '4X4',     'PAR_VEHICULE', 200, 'TND', 0,   'EUR', 5,    true),
  ('4x4 coucher soleil',       '4X4',     'PAR_VEHICULE', 450, 'TND', 0,   'EUR', 6,    true),
  ('Ksar Hadada',              'ENTREE',  'PAR_PERSONNE', 3,   'TND', 0,   'EUR', null, true),
  ('Guide local Chenini',      'GUIDE',   'PAR_GROUPE',   20,  'TND', 0,   'EUR', null, true),
  ('Caravane Djerba',          'ANIMAL',  'PAR_PERSONNE', 40,  'TND', 0,   'EUR', null, true),
  ('Musée Bardo',              'ENTREE',  'PAR_PERSONNE', 30,  'TND', 0,   'EUR', null, true),
  ('Carthage',                 'ENTREE',  'PAR_PERSONNE', 20,  'TND', 0,   'EUR', null, true),
  ('Entrée sites Kairouan',    'ENTREE',  'PAR_PERSONNE', 20,  'TND', 0,   'EUR', null, true),
  ('Tente single',             'HEBERG',  'PAR_PERSONNE', 30,  'TND', 45,  'EUR', null, true),
  ('Tente luxe',               'HEBERG',  'PAR_PERSONNE', 95,  'TND', 120, 'EUR', null, true),
  ('Camel Ride Sabria',        'ANIMAL',  'PAR_PERSONNE', 20,  'TND', 25,  'EUR', null, true),
  ('Quad Sabria',              'QUAD',    'PAR_VEHICULE', 45,  'TND', 60,  'EUR', 1,    true),
  ('4x4 Sabria',               '4X4',     'PAR_VEHICULE', 50,  'TND', 45,  'EUR', 5,    true)
on conflict do nothing;

-- ----- Tarifs guides par défaut (extra) ---------------------
insert into public.guide_prices (guide_id, demi_journee, journee, deux_jours, date_application)
select null, 100, 150, 300, current_date
where not exists (select 1 from public.guide_prices where guide_id is null);

-- ============================================================
--  CATALOGUE EXCURSIONS
--  Prix en EUR. Commission 30 %, taux 3,34.
-- ============================================================

-- Helper : insertion des excursions rattachées à leur canal OTA.
insert into public.excursions
  (code_interne, nom, ota_channel_id, compte_ota, ville_depart, duree, nombre_jours, prix_adulte, prix_enfant)
select v.code, v.nom, o.id, v.compte, v.ville, v.duree, v.jours, v.pa, v.pe
from (values
  -- GetYourGuide TDE
  ('GYG-TDE-001','De Hammamet : 1/2 journée à la découverte d''El Jem','GetYourGuide TDE','Hammamet','demi-journée',1,43,35),
  ('GYG-TDE-002','Depuis Tunis et Hammamet : visite de 2 jours à Ksar Ghilane et Tataouine','GetYourGuide TDE','Hammamet','2 jours',2,125,125),
  ('GYG-TDE-003','Djerba : Journée fun cheval, dromadaire et quad avec repas','GetYourGuide TDE','Djerba','journée',1,110,60),
  ('GYG-TDE-004','Djerba : repas traditionnel couscous famille locale','GetYourGuide TDE','Djerba','demi-journée',1,25,15),
  ('GYG-TDE-005','Hammamet : Full day Tunis Medina, Bardo, Carthage & Sidi Bou Saïd','GetYourGuide TDE','Hammamet','journée',1,75,45),
  ('GYG-TDE-006','Djerba : coucher de soleil désert, soirée bédouine','GetYourGuide TDE','Djerba','journée',1,140,100),
  ('GYG-TDE-007','Hammamet : randonnée Zaghouan et Zriba','GetYourGuide TDE','Hammamet','demi-journée',1,50,45),
  ('GYG-TDE-008','Hammamet : visite guidée demi-journée Kairouan','GetYourGuide TDE','Hammamet','demi-journée',1,55,30),
  ('GYG-TDE-009','Depuis Sousse : El Jem Colisée et Musée','GetYourGuide TDE','Sousse','demi-journée',1,65,35),
  -- GetYourGuide Tunisia-Trips
  ('GYG-TT-002-SM','Excursion 2 jours désert (depuis Sousse/Monastir)','GetYourGuide Tunisia-Trips','Sousse','2 jours',2,150,135),
  ('GYG-TT-002-HAM','Excursion 2 jours désert (depuis Hammamet)','GetYourGuide Tunisia-Trips','Hammamet','2 jours',2,175,150),
  ('GYG-TT-002-TUN','Excursion 2 jours désert (depuis Tunis)','GetYourGuide Tunisia-Trips','Tunis','2 jours',2,185,160),
  ('GYG-TT-003','Djerba & Zarzis : Tataouine Chenini & berbères','GetYourGuide Tunisia-Trips','Djerba','journée',1,49,39),
  ('GYG-TT-004','Djerba/Zarzis : circuit 2 jours Sahara nuit sous tente','GetYourGuide Tunisia-Trips','Djerba','2 jours',2,124,109),
  ('GYG-TT-005','Bateau pirate Djerba → Flamingo Island','GetYourGuide Tunisia-Trips','Djerba','journée',1,20,12),
  ('GYG-TT-006','Transfert aéroport Djerba → hôtel','GetYourGuide Tunisia-Trips','Djerba','transfert',1,20,20),
  ('GYG-TT-007','Spa Djerba','GetYourGuide Tunisia-Trips','Djerba','demi-journée',1,100,100),
  ('GYG-TT-008','Ksar Ghilane aventure quad + fort romain','GetYourGuide Tunisia-Trips','Djerba','journée',1,30,30),
  ('GYG-TT-010','Demi-journée Djerba boisson gratuite','GetYourGuide Tunisia-Trips','Djerba','demi-journée',1,19,15),
  ('GYG-TT-011','Balade chameau 1H Ksar Ghilane','GetYourGuide Tunisia-Trips','Djerba','activité',1,20,15),
  ('GYG-TT-012','Circuit Ksar Ghilane & Tataouine Chenini 1 journée','GetYourGuide Tunisia-Trips','Djerba','journée',1,69,49),
  ('GYG-TT-013','Djerba quad 1H30','GetYourGuide Tunisia-Trips','Djerba','activité',1,25,17),
  ('GYG-TT-014','Djerba chameau 1H30','GetYourGuide Tunisia-Trips','Djerba','activité',1,25,25),
  ('GYG-TT-015','5 jours désert tunisien','GetYourGuide Tunisia-Trips','Tunis','5 jours',5,1185,1185),
  ('GYG-TT-016','3 jours quad Sahara','GetYourGuide Tunisia-Trips','Djerba','3 jours',3,1450,1450),
  ('GYG-TT-017','Djerba randonnée cheval 1H30','GetYourGuide Tunisia-Trips','Djerba','activité',1,25,25),
  ('GYG-TT-018','Dîner romantique Casino Djerba','GetYourGuide Tunisia-Trips','Djerba','soirée',1,150,150)
) as v(code, nom, compte, ville, duree, jours, pa, pe)
join public.ota_channels o on o.nom = v.compte
on conflict (code_interne) do nothing;

-- Options de l'excursion GYG-TDE-005 (Tunis/Bardo/Carthage)
insert into public.excursion_options (excursion_id, nom_option, prix_adulte, prix_enfant)
select e.id, v.nom, v.pa, v.pe
from (values
  ('Guide uniquement', 20, 10),
  ('Transport inclus', 75, 45)
) as v(nom, pa, pe)
join public.excursions e on e.code_interne = 'GYG-TDE-005'
where not exists (
  select 1 from public.excursion_options x
  where x.excursion_id = e.id and x.nom_option = v.nom);

-- ============================================================
--  LIGNES DE COÛT — exemple complet : GYG-TDE-002
--  Ksar Ghilane / Tataouine 2 jours (référence de calcul)
-- ============================================================
insert into public.excursion_cost_lines
  (excursion_id, jour, categorie, type_depense, nom_depense, quantite, unite, prix_unitaire, devise, inclure_comptabilite)
select e.id, v.jour, v.cat, v.td, v.nom, v.qte, v.unite, v.pu, v.dev, true
from (values
  (1,'GUIDE',      'FIXE',        'Guide extra 2 jours',      1, 'forfait',  300, 'TND'),
  (1,'RESTAURANT', 'PAR_PERSONNE','Restaurant Sidi Idriss',   1, 'personne', 15,  'TND'),
  (1,'HEBERGEMENT','PAR_PERSONNE','Camp Sahara Lounge',       1, 'personne', 55,  'TND'),
  (2,'RESTAURANT', 'PAR_PERSONNE','Restaurant Ammar El Jem',  1, 'personne', 25,  'TND'),
  (2,'EXTRA',      'PAR_PERSONNE','Ticket El Jem',            1, 'personne', 20,  'TND'),
  (2,'EXTRA',      'PAR_PERSONNE','Ksar Hadada',              1, 'personne', 3,   'TND'),
  (2,'EXTRA',      'PAR_GROUPE',  'Guide local Chenini',      1, 'groupe',   20,  'TND')
) as v(jour, cat, td, nom, qte, unite, pu, dev)
join public.excursions e on e.code_interne = 'GYG-TDE-002'
where not exists (
  select 1 from public.excursion_cost_lines c
  where c.excursion_id = e.id and c.nom_depense = v.nom and c.jour = v.jour);

-- Lignes de coût — GYG-TDE-001 (El Jem demi-journée)
insert into public.excursion_cost_lines
  (excursion_id, jour, categorie, type_depense, nom_depense, quantite, unite, prix_unitaire, devise, inclure_comptabilite)
select e.id, 1, v.cat, v.td, v.nom, 1, v.unite, v.pu, 'TND', true
from (values
  ('GUIDE','FIXE',        'Guide extra demi-journée', 'forfait',  100),
  ('EXTRA','PAR_PERSONNE','Ticket El Jem',            'personne', 20)
) as v(cat, td, nom, unite, pu)
join public.excursions e on e.code_interne = 'GYG-TDE-001'
where not exists (
  select 1 from public.excursion_cost_lines c
  where c.excursion_id = e.id and c.nom_depense = v.nom);
