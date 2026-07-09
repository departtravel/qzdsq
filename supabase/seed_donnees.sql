-- ============================================================
--  DTS OPERATION ERP — Données réelles DTS (charges, prestataires)
--  À exécuter APRÈS maj_finale.sql. Idempotent.
--  Montants en DT. Les assurances/taxes "à remplir" sont à 0 (éditables
--  dans l'onglet Charges fixes).
-- ============================================================

-- ---- Véhicules (parc) avec leasing ----
insert into public.vehicles (matricule, marque, mode_possession, leasing_mensuel, actif)
select v.mat, v.marque, 'PROPRIETE', v.leasing, true
from (values
  ('Toyota VX','Toyota',3300),
  ('Toyota TX','Toyota',3300),
  ('Hiace','Toyota',3600),
  ('Autocar','Autocar',6300),
  ('Ford TTG','Ford',4200),
  ('Ford DTS','Ford',4200),
  ('Suzuki Ertiga','Suzuki',1250)
) as v(mat, marque, leasing)
where not exists (select 1 from public.vehicles x where x.matricule = v.mat);

-- ---- Salaires (charges fixes) ----
insert into public.fixed_charges (libelle, categorie, montant, periodicite)
select v.lib, 'SALAIRE', v.m, 'MENSUEL'
from (values
  ('Salaire Karima',1500),('Salaire Aymen',1500),('Salaire Amine',1500),
  ('Salaire Hiba',1200),('Salaire Imed',1200),('Salaire Montana',2300),
  ('Salaire Adel',1000),('Salaire Hersi',900),('Salaire Dhaou Sousse',1500),
  ('Salaire Farah',800),('Salaire Mohamed',900),
  ('Salaire chauffeur Autocar',1000),('Salaire chauffeur Hiace',1000),
  ('Salaire chauffeur Suzuki',1000),('Salaire chauffeur Ford TTG',1000),
  ('Salaire Walid',1000),('Salaire chauffeur Ford DTS',1000),
  ('Salaire chauffeur TX',1000)
) as v(lib, m)
where not exists (select 1 from public.fixed_charges f where f.libelle = v.lib);

-- Salaires guides permanents non déjà listés (Adel/Montana déjà en Salaires)
insert into public.fixed_charges (libelle, categorie, montant, periodicite, note)
select v.lib, 'SALAIRE', v.m, 'MENSUEL', 'guide permanent'
from (values
  ('Salaire guide Ali Msabhia',2000),
  ('Salaire guide Boukéri',2000),
  ('Salaire guide Hamza',2000)
) as v(lib, m)
where not exists (select 1 from public.fixed_charges f where f.libelle = v.lib);

-- ---- Leasings (liés au véhicule) ----
insert into public.fixed_charges (libelle, categorie, montant, periodicite, vehicle_id)
select v.lib, 'LEASING', v.m, 'MENSUEL', (select id from public.vehicles where matricule = v.mat)
from (values
  ('Leasing Toyota VX',3300,'Toyota VX'),
  ('Leasing Toyota TX',3300,'Toyota TX'),
  ('Leasing Hiace',3600,'Hiace'),
  ('Leasing Autocar',6300,'Autocar'),
  ('Leasing Ford TTG',4200,'Ford TTG'),
  ('Leasing Ford DTS',4200,'Ford DTS'),
  ('Leasing Suzuki Ertiga',1250,'Suzuki Ertiga')
) as v(lib, m, mat)
where not exists (select 1 from public.fixed_charges f where f.libelle = v.lib);

-- ---- Loyers & divers ----
insert into public.fixed_charges (libelle, categorie, montant, periodicite)
select v.lib, v.cat, v.m, 'MENSUEL'
from (values
  ('Loyer bureau Djerba','LOYER',1000),
  ('Loyer maison Hammamet','LOYER',650),
  ('DA3m','AUTRE',1700)
) as v(lib, cat, m)
where not exists (select 1 from public.fixed_charges f where f.libelle = v.lib);

-- ---- Assurances (annuelles ; le mensuel = montant/12) ----
insert into public.fixed_charges (libelle, categorie, montant, periodicite, note)
select 'Assurance FTAV', 'ASSURANCE_FTAV', 2200, 'ANNUEL', null
where not exists (select 1 from public.fixed_charges f where f.libelle = 'Assurance FTAV');

insert into public.fixed_charges (libelle, categorie, montant, periodicite, vehicle_id, note)
select v.lib, 'ASSURANCE_VEHICULE', 0, 'ANNUEL', (select id from public.vehicles where matricule = v.mat), 'à remplir'
from (values
  ('Assurance Toyota TX','Toyota TX'),
  ('Assurance Toyota VX','Toyota VX'),
  ('Assurance Hiace','Hiace'),
  ('Assurance Autocar','Autocar'),
  ('Assurance Ford TTG','Ford TTG'),
  ('Assurance Ford DTS','Ford DTS'),
  ('Assurance Suzuki Ertiga','Suzuki Ertiga')
) as v(lib, mat)
where not exists (select 1 from public.fixed_charges f where f.libelle = v.lib);

-- ---- Taxes de circulation (mensuelles, à remplir) ----
insert into public.fixed_charges (libelle, categorie, montant, periodicite, vehicle_id, note)
select v.lib, 'TAXE_VEHICULE', 0, 'MENSUEL', (select id from public.vehicles where matricule = v.mat), 'à remplir'
from (values
  ('Taxe Toyota TX','Toyota TX'),
  ('Taxe Toyota VX','Toyota VX'),
  ('Taxe Hiace','Hiace'),
  ('Taxe Autocar','Autocar'),
  ('Taxe Ford TTG','Ford TTG'),
  ('Taxe Ford DTS','Ford DTS'),
  ('Taxe Suzuki Ertiga','Suzuki Ertiga')
) as v(lib, mat)
where not exists (select 1 from public.fixed_charges f where f.libelle = v.lib);

-- ---- Guides permanents (base, salariés) ----
insert into public.guides (nom, type_guide, salaire_mensuel, actif)
select v.nom, 'SALARIE', v.sal, true
from (values
  ('Ali Msabhia',2000),('Boukéri',2000),('Hamza',2000),
  ('Adel (guide)',2000),('Montana (guide)',2300)
) as v(nom, sal)
where not exists (select 1 from public.guides g where g.nom = v.nom);

-- ---- Guides extras (150 DT/jour, 100 DT demi-journée) ----
insert into public.guides (nom, type_guide, actif)
select v.nom, 'EXTRA', true
from (values
  ('Mohamed Hamdi'),('Toutou'),('Waghlani'),('Zizou'),('Yosr'),('Mzoughi')
) as v(nom)
where not exists (select 1 from public.guides g where g.nom = v.nom);

insert into public.guide_prices (guide_id, demi_journee, journee, deux_jours)
select g.id, 100, 150, 300
from public.guides g
where g.type_guide = 'EXTRA'
  and g.nom in ('Mohamed Hamdi','Toutou','Waghlani','Zizou','Yosr','Mzoughi')
  and not exists (select 1 from public.guide_prices p where p.guide_id = g.id);

-- ---- Restaurants ----
insert into public.restaurants (nom, ville)
select v.nom, v.ville
from (values
  ('El Borj Tataouine','Tataouine'),
  ('Sahara Lounge Ghilane','Ksar Ghilane'),
  ('Restaurant Les Jardins','Sahara'),
  ('Restaurant Ammar El Jem','El Jem'),
  ('Restaurant Ammar Jelma','Jelma'),
  ('Restaurant Sidi Idriss','Sahara'),
  ('Restaurant Monte Carlo Lagoulette','La Goulette')
) as v(nom, ville)
where not exists (select 1 from public.restaurants r where r.nom = v.nom);

-- ---- Hôtels ----
insert into public.accommodations (nom, type, ville)
select v.nom, 'HOTEL', v.ville
from (values
  ('Ksar Rouge Tozeur','Tozeur'),
  ('Tamerza Palace Tozeur','Tozeur'),
  ('Touring Djerba','Djerba'),
  ('Belvedère Fourati Tunis','Tunis'),
  ('Kasbah Kairouan','Kairouan')
) as v(nom, ville)
where not exists (select 1 from public.accommodations a where a.nom = v.nom);

-- ---- Campements ----
insert into public.accommodations (nom, type, ville)
select v.nom, 'CAMP', v.ville
from (values
  ('Sahara Lounge Camp','Ksar Ghilane'),
  ('Dunes Insolites Camp','Sahara'),
  ('Tiniri Camp','Sahara'),
  ('Abdelmoula Camp','Sahara'),
  ('Bir Soltane Camp','Bir Soltane')
) as v(nom, ville)
where not exists (select 1 from public.accommodations a where a.nom = v.nom);
