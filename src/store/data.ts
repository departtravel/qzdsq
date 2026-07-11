// ============================================================
//  Vitrine — accès aux données PUBLIQUES du catalogue (anon).
//  Lecture seule ; s'appuie sur les policies de public_read.sql.
// ============================================================
import { supabase } from '../lib/supabase'
import type { Excursion } from '../lib/erp'
import type {
  ProductTranslation, ProductVariant, ProductDiscount,
  ProductDeparture, ProductCity, ProductExtra, City, Locale,
} from '../lib/produits'

export interface CatalogItem {
  excursion: Excursion
  translations: ProductTranslation[]
  variants: ProductVariant[]
  discounts: ProductDiscount[]
  departures: ProductDeparture[]
  cities: ProductCity[]
}

export interface ProductBundle extends CatalogItem {
  translations: ProductTranslation[]
  extras: ProductExtra[]
  optionTranslations: Record<string, ProductTranslation[]>
}

const activeOnly = (e: Excursion) => e.statut === 'ACTIVE'

/** Charge le catalogue complet (produits actifs) pour la home. */
export async function fetchCatalog(): Promise<{ items: CatalogItem[]; cities: City[] }> {
  const [ex, tr, vr, ds, dp, pc, ci] = await Promise.all([
    supabase.from('excursions').select('*').order('code_interne'),
    supabase.from('product_translations').select('*'),
    supabase.from('product_variants').select('*'),
    supabase.from('product_discounts').select('*').eq('actif', true),
    supabase.from('product_departures').select('*'),
    supabase.from('product_cities').select('*'),
    supabase.from('cities').select('*').eq('actif', true).order('nom'),
  ])
  const excursions = ((ex.data as Excursion[]) ?? []).filter(activeOnly)
  function group<T>(rows: any[] | null): Map<string, T[]> {
    const m = new Map<string, T[]>()
    for (const r of rows ?? []) {
      const arr = m.get(r.excursion_id) ?? []
      arr.push(r as T)
      m.set(r.excursion_id, arr)
    }
    return m
  }
  const gt = group<ProductTranslation>(tr.data as any)
  const gv = group<ProductVariant>(vr.data as any)
  const gd = group<ProductDiscount>(ds.data as any)
  const gp = group<ProductDeparture>(dp.data as any)
  const gc = group<ProductCity>(pc.data as any)
  const items: CatalogItem[] = excursions.map((e) => ({
    excursion: e,
    translations: gt.get(e.id) ?? [],
    variants: gv.get(e.id) ?? [],
    discounts: gd.get(e.id) ?? [],
    departures: gp.get(e.id) ?? [],
    cities: gc.get(e.id) ?? [],
  }))
  return { items, cities: (ci.data as City[]) ?? [] }
}

/** Charge un produit complet pour la page détail. */
export async function fetchProduct(id: string): Promise<ProductBundle | null> {
  const [ex, tr, op, ot, vr, ds, dp, pc] = await Promise.all([
    supabase.from('excursions').select('*').eq('id', id).single(),
    supabase.from('product_translations').select('*').eq('excursion_id', id),
    supabase.from('excursion_options').select('*').eq('excursion_id', id).eq('actif', true).order('ordre'),
    supabase.from('option_translations').select('*'),
    supabase.from('product_variants').select('*').eq('excursion_id', id).eq('actif', true).order('ordre'),
    supabase.from('product_discounts').select('*').eq('excursion_id', id).eq('actif', true),
    supabase.from('product_departures').select('*').eq('excursion_id', id).order('date_depart'),
    supabase.from('product_cities').select('*').eq('excursion_id', id),
  ])
  if (ex.error || !ex.data) return null
  const optIds = new Set(((op.data as any[]) ?? []).map((o) => o.id))
  const optTr: Record<string, ProductTranslation[]> = {}
  for (const t of (ot.data as any[]) ?? []) {
    if (optIds.has(t.option_id)) (optTr[t.option_id] ??= []).push(t)
  }
  return {
    excursion: ex.data as Excursion,
    translations: (tr.data as ProductTranslation[]) ?? [],
    extras: (op.data as ProductExtra[]) ?? [],
    optionTranslations: optTr,
    variants: (vr.data as ProductVariant[]) ?? [],
    discounts: (ds.data as ProductDiscount[]) ?? [],
    departures: (dp.data as ProductDeparture[]) ?? [],
    cities: (pc.data as ProductCity[]) ?? [],
  }
}

/** Traduction d'un produit dans la locale voulue, avec repli sur la source. */
export function tradProduit(b: { excursion: Excursion; translations: ProductTranslation[] }, loc: Locale) {
  const t = b.translations.find((x) => x.locale === loc)
  return {
    nom: t?.nom || b.excursion.nom,
    description: t?.description || b.excursion.description || '',
    programme: t?.programme || '',
    inclus: t?.inclus || '',
    non_inclus: t?.non_inclus || '',
  }
}
