-- ============================================================
-- DTS OPERATION ERP — TVA (prix TTC -> HT + TVA par ligne)
-- Colle dans Supabase > SQL Editor > Run without RLS. Idempotent.
-- Prérequis : maj_finale.sql exécuté.
-- ============================================================

-- >>>>>>>>>>>>>>>>>> tva.sql <<<<<<<<<<<<<<<<<<

-- ============================================================
--  DTS OPERATION ERP — TVA (montants TTC) & numérotation factures
--  À exécuter après maj_finale.sql. Idempotent.
--
--  Hypothèse : tous les tarifs saisis sont TTC (TVA incluse).
--  On isole la part HT et la part TVA au taux configuré (défaut 19 %).
--  Décomposition indicative — le régime réel (TVA sur marge pour agence
--  réceptive) est à valider avec votre comptable.
-- ============================================================

-- Taux de TVA global (paramètre)
insert into public.app_settings (key, value) values ('tva_taux', '19')
on conflict (key) do nothing;

-- Un fournisseur assujetti à la TVA ouvre droit à TVA déductible sur ses factures.
alter table public.suppliers add column if not exists assujetti_tva boolean not null default false;

-- ---- Numérotation séquentielle des pièces (factures internes) ----
create sequence if not exists public.facture_seq start 1;

-- Numéro de facture attribué à une transaction fournisseur validée.
alter table public.supplier_transactions add column if not exists numero_piece text;
alter table public.supplier_transactions add column if not exists echeance date;

-- Attribue un numéro séquentiel (FAC-AAAA-000N) à la validation d'une facture.
create or replace function public.tg_numero_facture()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.type_operation = 'FACTURE'
     and new.statut = 'VALIDEE'
     and (old.statut is distinct from 'VALIDEE')
     and new.numero_piece is null then
    new.numero_piece := 'FAC-' || to_char(coalesce(new.date, current_date), 'YYYY') ||
                        '-' || lpad(nextval('public.facture_seq')::text, 5, '0');
  end if;
  return new;
end $$;
drop trigger if exists numero_facture on public.supplier_transactions;
create trigger numero_facture before update on public.supplier_transactions
  for each row execute function public.tg_numero_facture();

-- >>>>>>>>>>>>>>>>>> tva_lignes.sql <<<<<<<<<<<<<<<<<<

-- ============================================================
--  DTS OPERATION ERP — TVA par ligne (prix TTC → HT + TVA)
--  À exécuter après tva.sql. Idempotent.
--  Chaque prix est saisi TTC avec son taux (19 % ou 7 %).
--  L'ERP extrait automatiquement la part HT et la part TVA.
-- ============================================================
alter table public.excursion_cost_lines
  add column if not exists taux_tva numeric not null default 19 check (taux_tva >= 0);

alter table public.fixed_charges
  add column if not exists taux_tva numeric not null default 19 check (taux_tva >= 0);

alter table public.extras
  add column if not exists taux_tva numeric not null default 19 check (taux_tva >= 0);
