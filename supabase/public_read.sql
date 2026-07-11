-- ============================================================
--  DTS — Lecture PUBLIQUE du catalogue (vitrine client)
--  À exécuter APRÈS erp.sql et produits.sql.
--  Les visiteurs anonymes (role 'anon') peuvent LIRE le catalogue
--  pour afficher produits, options, prix, promos, départs…
--  Aucune écriture, aucune donnée de coût/rentabilité exposée.
-- ============================================================

do $$
declare t text;
begin
  foreach t in array array[
    'excursions', 'excursion_options',
    'product_translations', 'option_translations',
    'cities', 'product_cities', 'product_departures',
    'product_variants', 'variant_translations', 'product_discounts'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I_public_read on public.%I;', t, t);
    execute format(
      'create policy %I_public_read on public.%I for select using (true);',
      t, t);
  end loop;
end $$;

-- Note : les tables de coûts / rentabilité (excursion_cost_lines,
-- extras, vehicle_costs, driver_costs, suppliers…) NE sont PAS exposées :
-- elles gardent leurs policies « authenticated » d'origine.
