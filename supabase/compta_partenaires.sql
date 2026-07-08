-- ============================================================
--  DTS OPERATION ERP — Relevé comptable par prestataire
--  Relie chaque ligne de coût à son partenaire réel (restaurant,
--  hébergement, extra) pour agréger la consommation par prestataire.
--  À exécuter APRÈS erp.sql / seed.sql / seed_dts.sql. Idempotent.
-- ============================================================

-- Lien ligne de coût -> partenaire
alter table public.excursion_cost_lines
  add column if not exists partner_type text;  -- RESTAURANT | HEBERGEMENT | EXTRA
alter table public.excursion_cost_lines
  add column if not exists partner_id uuid;

create index if not exists cost_lines_partner_idx
  on public.excursion_cost_lines (partner_type, partner_id);

-- ----- Rattachement automatique par nom (données seedées) ---
-- RESTAURANT : la ligne "Restaurant Sidi Idriss" -> restaurant "Sidi Idriss"
update public.excursion_cost_lines c
set partner_type = 'RESTAURANT', partner_id = r.id
from public.restaurants r
where c.categorie = 'RESTAURANT'
  and c.partner_id is null
  and c.nom_depense ilike '%' || r.nom || '%';

-- HEBERGEMENT : "Camp Sahara Lounge" -> accommodation "Sahara Lounge"
update public.excursion_cost_lines c
set partner_type = 'HEBERGEMENT', partner_id = a.id
from public.accommodations a
where c.categorie = 'HEBERGEMENT'
  and c.partner_id is null
  and c.nom_depense ilike '%' || a.nom || '%';

-- EXTRA : "Ticket El Jem" -> extra "Ticket El Jem"
update public.excursion_cost_lines c
set partner_type = 'EXTRA', partner_id = e.id
from public.extras e
where c.categorie = 'EXTRA'
  and c.partner_id is null
  and c.nom_depense ilike '%' || e.nom || '%';

-- Astuce : pour les lignes ajoutées ensuite, renseigne partner_type/partner_id
-- à la création afin qu'elles apparaissent dans le relevé du prestataire.
