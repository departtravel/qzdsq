-- ============================================================
--  DTS OPERATION ERP — Catalogue DTS (complément de seed)
--  À exécuter APRÈS supabase/erp.sql ET supabase/seed.sql.
--  Ré-exécutable (idempotent via ON CONFLICT / WHERE NOT EXISTS).
--
--  Complète les lignes de coût de référence du cahier des charges
--  pour des excursions déjà présentes dans seed.sql.
--  Prix en TND. type_depense : PAR_PERSONNE | PAR_VEHICULE | PAR_GROUPE | FIXE.
-- ============================================================

-- ----- Canal de vente (idempotent) --------------------------
insert into public.ota_channels (nom, commission_percentage, devise) values
  ('GetYourGuide DTS', 30, 'EUR')
on conflict (nom) do nothing;

-- ============================================================
--  LIGNES DE COÛT DE RÉFÉRENCE
-- ============================================================

-- ----- GYG-TDE-005 : Tunis / Bardo / Carthage (option transport)
insert into public.excursion_cost_lines
  (excursion_id, jour, categorie, type_depense, nom_depense, quantite, unite, prix_unitaire, devise, inclure_comptabilite)
select e.id, 1, v.cat, v.td, v.nom, 1, v.unite, v.pu, 'TND', true
from (values
  ('RESTAURANT','PAR_PERSONNE','Restaurant Monte Carlo', 'personne', 30),
  ('GUIDE',     'FIXE',        'Guide journée',          'forfait',  150),
  ('EXTRA',     'PAR_PERSONNE','Musée Bardo',            'personne', 30),
  ('EXTRA',     'PAR_PERSONNE','Carthage',               'personne', 20)
) as v(cat, td, nom, unite, pu)
join public.excursions e on e.code_interne = 'GYG-TDE-005'
where not exists (
  select 1 from public.excursion_cost_lines c
  where c.excursion_id = e.id and c.nom_depense = v.nom and c.jour = 1);

-- ----- GYG-TDE-003 : Djerba cheval / dromadaire / quad
insert into public.excursion_cost_lines
  (excursion_id, jour, categorie, type_depense, nom_depense, quantite, unite, prix_unitaire, devise, inclure_comptabilite)
select e.id, 1, v.cat, v.td, v.nom, 1, v.unite, v.pu, 'TND', true
from (values
  ('RESTAURANT','PAR_PERSONNE','Restaurant Port Aghir', 'personne', 30),
  ('EXTRA',     'PAR_PERSONNE','Caravane Djerba',       'personne', 40),
  ('EXTRA',     'PAR_VEHICULE','Quad',                  'vehicule', 60)
) as v(cat, td, nom, unite, pu)
join public.excursions e on e.code_interne = 'GYG-TDE-003'
where not exists (
  select 1 from public.excursion_cost_lines c
  where c.excursion_id = e.id and c.nom_depense = v.nom and c.jour = 1);

-- ----- GYG-TDE-006 : coucher de soleil désert
insert into public.excursion_cost_lines
  (excursion_id, jour, categorie, type_depense, nom_depense, quantite, unite, prix_unitaire, devise, inclure_comptabilite)
select e.id, 1, v.cat, v.td, v.nom, 1, v.unite, v.pu, 'TND', true
from (values
  ('TRANSPORT', 'PAR_VEHICULE','4x4 coucher soleil (cap 6)', 'vehicule', 450),
  ('GUIDE',     'FIXE',        'Guide journée',              'forfait',  150),
  ('RESTAURANT','PAR_PERSONNE','Dîner Sahara Lounge',        'personne', 15)
) as v(cat, td, nom, unite, pu)
join public.excursions e on e.code_interne = 'GYG-TDE-006'
where not exists (
  select 1 from public.excursion_cost_lines c
  where c.excursion_id = e.id and c.nom_depense = v.nom and c.jour = 1);

-- ----- GYG-TDE-008 : Kairouan demi-journée
insert into public.excursion_cost_lines
  (excursion_id, jour, categorie, type_depense, nom_depense, quantite, unite, prix_unitaire, devise, inclure_comptabilite)
select e.id, 1, v.cat, v.td, v.nom, 1, v.unite, v.pu, 'TND', true
from (values
  ('GUIDE','FIXE',        'Guide demi-journée',      'forfait',  100),
  ('EXTRA','PAR_PERSONNE','Entrée sites Kairouan',   'personne', 20)
) as v(cat, td, nom, unite, pu)
join public.excursions e on e.code_interne = 'GYG-TDE-008'
where not exists (
  select 1 from public.excursion_cost_lines c
  where c.excursion_id = e.id and c.nom_depense = v.nom and c.jour = 1);

-- ----- GYG-TDE-009 : El Jem depuis Sousse
insert into public.excursion_cost_lines
  (excursion_id, jour, categorie, type_depense, nom_depense, quantite, unite, prix_unitaire, devise, inclure_comptabilite)
select e.id, 1, v.cat, v.td, v.nom, 1, v.unite, v.pu, 'TND', true
from (values
  ('GUIDE','FIXE',        'Guide demi-journée', 'forfait',  100),
  ('EXTRA','PAR_PERSONNE','Ticket El Jem',      'personne', 20)
) as v(cat, td, nom, unite, pu)
join public.excursions e on e.code_interne = 'GYG-TDE-009'
where not exists (
  select 1 from public.excursion_cost_lines c
  where c.excursion_id = e.id and c.nom_depense = v.nom and c.jour = 1);

-- ----- GYG-TT-002 : 2 jours désert — 3 variantes SM / HAM / TUN
insert into public.excursion_cost_lines
  (excursion_id, jour, categorie, type_depense, nom_depense, quantite, unite, prix_unitaire, devise, inclure_comptabilite)
select e.id, v.jour, v.cat, v.td, v.nom, 1, v.unite, v.pu, 'TND', true
from (values
  (1,'GUIDE',      'FIXE',        'Guide extra 2 jours',       'forfait',  300),
  (1,'RESTAURANT', 'PAR_PERSONNE','Restaurant Sidi Idriss',    'personne', 15),
  (1,'HEBERGEMENT','PAR_PERSONNE','Camp Dunes Insolites',      'personne', 90),
  (2,'RESTAURANT', 'PAR_PERSONNE','Restaurant Les Jardins',    'personne', 15)
) as v(jour, cat, td, nom, unite, pu)
cross join (values ('GYG-TT-002-SM'),('GYG-TT-002-HAM'),('GYG-TT-002-TUN')) as codes(code)
join public.excursions e on e.code_interne = codes.code
where not exists (
  select 1 from public.excursion_cost_lines c
  where c.excursion_id = e.id and c.nom_depense = v.nom and c.jour = v.jour);

-- ----- GYG-TT-003 : Tataouine / Chenini
insert into public.excursion_cost_lines
  (excursion_id, jour, categorie, type_depense, nom_depense, quantite, unite, prix_unitaire, devise, inclure_comptabilite)
select e.id, 1, v.cat, v.td, v.nom, 1, v.unite, v.pu, 'TND', true
from (values
  ('GUIDE',     'FIXE',        'Guide journée',       'forfait',  150),
  ('RESTAURANT','PAR_PERSONNE','Restaurant El Borj',  'personne', 15),
  ('EXTRA',     'PAR_PERSONNE','Ksar Hadada',         'personne', 3)
) as v(cat, td, nom, unite, pu)
join public.excursions e on e.code_interne = 'GYG-TT-003'
where not exists (
  select 1 from public.excursion_cost_lines c
  where c.excursion_id = e.id and c.nom_depense = v.nom and c.jour = 1);

-- ----- GYG-TT-012 : Ksar Ghilane & Tataouine 1 journée
insert into public.excursion_cost_lines
  (excursion_id, jour, categorie, type_depense, nom_depense, quantite, unite, prix_unitaire, devise, inclure_comptabilite)
select e.id, 1, v.cat, v.td, v.nom, 1, v.unite, v.pu, 'TND', true
from (values
  ('GUIDE',     'FIXE',        'Guide journée',        'forfait',  150),
  ('RESTAURANT','PAR_PERSONNE','Restaurant Sahara Lounge','personne', 15),
  ('EXTRA',     'PAR_PERSONNE','Camel Ride',           'personne', 20),
  ('EXTRA',     'PAR_VEHICULE','Quad',                 'vehicule', 45)
) as v(cat, td, nom, unite, pu)
join public.excursions e on e.code_interne = 'GYG-TT-012'
where not exists (
  select 1 from public.excursion_cost_lines c
  where c.excursion_id = e.id and c.nom_depense = v.nom and c.jour = 1);

-- ============================================================
--  HISTORIQUE DES COÛTS (module IA)
--  Hausse Restaurant Sidi Idriss : 15 -> 18 DT
-- ============================================================
insert into public.cost_history (categorie, reference_id, ancien_prix, nouveau_prix, date)
select 'RESTAURANT', r.id, 15, 18, timestamptz '2026-01-01 00:00:00+00'
from public.restaurants r
where r.nom = 'Sidi Idriss'
  and not exists (
    select 1 from public.cost_history h
    where h.categorie = 'RESTAURANT' and h.reference_id = r.id
      and h.ancien_prix = 15 and h.nouveau_prix = 18);

-- Variante enfant Sidi Idriss : 7.5 -> 9 DT
insert into public.cost_history (categorie, reference_id, ancien_prix, nouveau_prix, date)
select 'RESTAURANT', r.id, 7.5, 9, timestamptz '2026-01-01 00:00:00+00'
from public.restaurants r
where r.nom = 'Sidi Idriss'
  and not exists (
    select 1 from public.cost_history h
    where h.categorie = 'RESTAURANT' and h.reference_id = r.id
      and h.ancien_prix = 7.5 and h.nouveau_prix = 9);
