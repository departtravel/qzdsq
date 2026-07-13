-- ============================================================
--  DTS OPERATION ERP — Import de la base GUIDES (données réelles)
--  Idempotent : n'écrase rien, n'ajoute que ce qui manque (clé = nom).
--  - guides : nom, téléphone, carte pro, CIN, langues, zone (adresse),
--    type (SALARIE / EXTRA), actif.
--  - guide_prices : tarif demi-journée / journée pour les EXTRA.
--  - suppliers : fiche fournisseur (ref GUIDE) pour chaque guide.
--  À exécuter après INSTALL_TOUT.sql.
-- ============================================================

-- ---------- Guides -------------------------------------------
insert into public.guides
  (nom, telephone, numero_carte_professionnelle, cin, langues, adresse, type_guide, actif)
select v.nom, v.tel, v.carte, v.cin, v.langues, v.zone, v.typ, v.actif
from (values
  ('Ali Msabhia',          '29240767 / 22241295', '2087', '6145123',  array['FR','EN'],            'Hammamet, Sousse, Tunis, Monastir, Mahdia', 'SALARIE', true),
  ('Adel Bouaziz',         '93177569',            '1797', null,        array['FR','EN','DE','IT'],  'Hammamet, Sousse, Tunis, Monastir, Mahdia', 'SALARIE', true),
  ('Nourdine Boukari',     '24332451',            '264',  '2133520',   array['FR','EN','IT','DE'],  'Hammamet, Sousse, Tunis, Monastir, Mahdia', 'SALARIE', true),
  ('Hamza Boujderia',      '26687553',            '2129', '6397540',   array['FR','EN'],            'Hammamet, Sousse, Tunis, Monastir, Mahdia', 'SALARIE', true),
  ('Hamdi El Hani',        '97593463',            null,   null,        array['FR','EN'],            'Hammamet, Sousse, Tunis, Monastir, Mahdia', 'EXTRA',   true),
  ('Fathi Mzoughi',        '21803813',            '813',  '4131882',   array['FR','EN','DE'],       'Hammamet, Sousse, Tunis, Monastir, Mahdia', 'EXTRA',   true),
  ('Mohamed Ben Khalifa',  '21053850',            '2222', '8481367',   array['FR','EN'],            'Hammamet, Sousse, Tunis, Monastir, Mahdia', 'EXTRA',   true),
  ('Abdalah Khlifa',       '98292487',            null,   null,        array['FR','EN','DE'],       'Hammamet, Sousse, Tunis, Monastir, Mahdia', 'EXTRA',   false),
  ('Naceur Chaibi',        '98454623',            null,   null,        array['FR','EN','DE','IT'],  'Hammamet, Sousse, Tunis, Monastir, Mahdia', 'EXTRA',   true),
  ('Ali Cherfi',           '25262453',            null,   null,        array['FR','EN'],            'Hammamet, Sousse, Tunis, Monastir, Mahdia', 'EXTRA',   false),
  ('Seifeddine Chedly',    '98588115',            null,   null,        array['ES','FR','EN'],       'Hammamet, Sousse, Tunis, Monastir, Mahdia', 'EXTRA',   true),
  ('Montasar Ltaeif',      '99424313',            '2523', '9101350',   array['FR','EN','DE'],       'Djerba',                                    'SALARIE', true),
  ('Abdeslem Rebi',        '22737322',            '2521', '5851903',   array['FR','EN','DE','IT'],  'Djerba',                                    'EXTRA',   true),
  ('Tawfik Ben Moussa',    '25881887',            '1394', '5711894',   array['FR','EN','DE'],       'Djerba',                                    'EXTRA',   true),
  ('Mohamed Hamdi',        '95493417',            '2624', '9134297',   array['FR','EN'],            'Médenine',                                  'EXTRA',   true),
  ('Mohamed Belili',       '94860795',            '2453', '8821683',   array['FR','EN'],            'Djerba',                                    'EXTRA',   true),
  ('Yosr El Hami',         '20078120',            '2246', '5471050',   array['FR','EN'],            'Djerba',                                    'EXTRA',   true),
  ('Mohamed Hamrouni',     '97347016',            '2164', '3194853',   array['FR','EN'],            'Djerba',                                    'EXTRA',   true),
  ('Jalel Oughleni',       '97105408',            '1387', '798628',    array['FR','EN','DE','IT'],  'Djerba',                                    'EXTRA',   true),
  ('Jalel Ounali',         '94979428',            '1277', '689078',    array['FR','IT','DE'],       'Djerba',                                    'EXTRA',   false),
  ('Lassad Afi',           '97243533',            '1942', '6049284',   array['FR','EN'],            'Djerba',                                    'EXTRA',   false),
  ('Zouhair Ben Tazaiet',  '98212233',            '1001', '5059523',   array['FR','EN','DE'],       'Djerba',                                    'EXTRA',   false),
  ('Houssein Abdellaoui',  '50317509',            '2754', '13472690',  array['FR','EN'],            'Djerba',                                    'EXTRA',   false),
  ('Tarek Malli',          '20780153',            '2433', '5916981',   array['FR','IT'],            'Djerba',                                    'EXTRA',   false),
  ('Khaled Mefteh',        '23297974',            '2016', '5834489',   array['FR','EN','DE'],       'Djerba',                                    'EXTRA',   false),
  ('Hamda Ferchichi',      '27253727',            '1328', '2591738',   array['FR','EN','IT'],       'Djerba',                                    'EXTRA',   false),
  ('Ftouma Sbaa',          '26011290',            '2733', '8682103',   array['FR','EN'],            'Djerba',                                    'EXTRA',   false),
  ('Samir Rguia',          '28602270',            '1337', '3155286',   array['FR','DE'],            'Djerba',                                    'EXTRA',   false)
) as v(nom, tel, carte, cin, langues, zone, typ, actif)
where not exists (select 1 from public.guides g where lower(g.nom) = lower(v.nom));

-- ---------- Tarifs des guides EXTRA (demi-journée / journée) --
-- deux_jours estimé = journée × 2.
insert into public.guide_prices (guide_id, demi_journee, journee, deux_jours, date_application)
select g.id, v.demi, v.jour, v.jour * 2, current_date
from (values
  ('Hamdi El Hani',       100, 150),
  ('Fathi Mzoughi',       120, 200),
  ('Mohamed Ben Khalifa', 100, 150),
  ('Abdalah Khlifa',      120, 200),
  ('Naceur Chaibi',       100, 150),
  ('Ali Cherfi',          100, 150),
  ('Seifeddine Chedly',   100, 150),
  ('Abdeslem Rebi',       100, 150),
  ('Tawfik Ben Moussa',   100, 150),
  ('Mohamed Hamdi',       null, 150),
  ('Mohamed Belili',      100, 150),
  ('Yosr El Hami',        100, 150),
  ('Mohamed Hamrouni',    100, 150),
  ('Jalel Oughleni',      100, 150),
  ('Jalel Ounali',        100, 150),
  ('Lassad Afi',          100, 150),
  ('Zouhair Ben Tazaiet', 100, 150),
  ('Houssein Abdellaoui', 100, 150),
  ('Tarek Malli',         100, 150),
  ('Khaled Mefteh',       100, 150),
  ('Hamda Ferchichi',     100, 150),
  ('Ftouma Sbaa',         100, 150),
  ('Samir Rguia',         100, 150)
) as v(nom, demi, jour)
join public.guides g on lower(g.nom) = lower(v.nom)
where not exists (select 1 from public.guide_prices gp where gp.guide_id = g.id);

-- ---------- Fiche fournisseur pour chaque guide --------------
insert into public.suppliers (nom, type, ref_type, ref_id)
select g.nom, 'GUIDE', 'GUIDE', g.id
from public.guides g
where not exists (
  select 1 from public.suppliers s where s.ref_type = 'GUIDE' and s.ref_id = g.id
);
