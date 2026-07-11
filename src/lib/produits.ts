// ============================================================
//  DTS — Logique PRODUIT / CONFIGURATEUR (façon supplier GYG)
//  Calcul du prix client : mode groupe/privé + extras + ville.
// ============================================================

/** Langues gérées dès la création d'un produit. */
export const LOCALES = ['fr', 'en', 'es', 'de', 'it', 'pt', 'pl', 'ru'] as const
export type Locale = (typeof LOCALES)[number]

export const LOCALE_LABELS: Record<Locale, string> = {
  fr: 'Français', en: 'English', es: 'Español', de: 'Deutsch',
  it: 'Italiano', pt: 'Português', pl: 'Polski', ru: 'Русский',
}

export type TypeSortie = 'GROUPE' | 'PRIVE'

export interface ProductExtra {
  id: string
  excursion_id: string
  nom_option: string
  description: string | null
  categorie: string | null
  prix_adulte: number
  prix_enfant: number
  prix_bebe: number
  actif: boolean
  obligatoire: boolean
  ordre: number
}

export interface ProductTranslation {
  id?: string
  excursion_id?: string
  locale: Locale
  nom: string
  description: string
  programme: string
  inclus: string
  non_inclus: string
}

export interface City {
  id: string
  nom: string
  pays: string
  actif: boolean
}

export interface ProductCity {
  id: string
  excursion_id: string
  city_id: string
  role: 'DEPART' | 'ARRIVEE'
  supplement: number
  devise: string
  par_defaut: boolean
}

export interface ProductDeparture {
  id: string
  excursion_id: string
  date_depart: string
  heure: string | null
  type_sortie: TypeSortie
  capacite: number | null
  places_reservees: number
  statut: 'OUVERT' | 'COMPLET' | 'ANNULE' | 'TERMINE'
  note: string | null
}

/** Tarifs de base d'un produit selon le mode de sortie. */
export interface ProductPricing {
  prix_adulte: number
  prix_enfant: number
  prix_bebe: number
  prix_prive_adulte: number
  prix_prive_enfant: number
  prix_prive_bebe: number
}

export interface BookingConfig {
  mode: TypeSortie
  adultes: number
  enfants: number
  bebes: number
  /** Extras cochés par le client (les obligatoires sont toujours inclus). */
  extrasSelected: ProductExtra[]
  /** Supplément de la ville d'arrivée choisie (0 si fin = départ). */
  supplementVilleArrivee?: number
}

export interface PriceLine {
  label: string
  montant: number
}

export interface PriceBreakdown {
  base: number
  extras: number
  supplementVille: number
  total: number
  lignes: PriceLine[]
  devise: string
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Prix de base selon le mode (groupe/privé) et l'effectif. */
export function prixBase(p: ProductPricing, cfg: BookingConfig): number {
  const prive = cfg.mode === 'PRIVE'
  const pa = prive ? p.prix_prive_adulte : p.prix_adulte
  const pe = prive ? p.prix_prive_enfant : p.prix_enfant
  const pb = prive ? p.prix_prive_bebe : p.prix_bebe
  return round2(pa * cfg.adultes + pe * cfg.enfants + pb * cfg.bebes)
}

/** Coût d'un extra pour l'effectif donné. */
export function coutExtra(extra: ProductExtra, cfg: BookingConfig): number {
  return round2(
    extra.prix_adulte * cfg.adultes +
    extra.prix_enfant * cfg.enfants +
    extra.prix_bebe * cfg.bebes,
  )
}

/**
 * Calcule le prix total d'une réservation :
 *   base(mode) + Σ extras cochés + supplément ville d'arrivée.
 * Le prix de chaque extra s'AJOUTE au prix de l'excursion (cf. cahier des charges).
 */
export function calculerPrixProduit(
  pricing: ProductPricing,
  cfg: BookingConfig,
  devise = 'EUR',
): PriceBreakdown {
  const base = prixBase(pricing, cfg)
  const lignes: PriceLine[] = [
    { label: `Excursion (${cfg.mode === 'PRIVE' ? 'privatif' : 'groupe'})`, montant: base },
  ]

  let extras = 0
  for (const ex of cfg.extrasSelected) {
    const c = coutExtra(ex, cfg)
    extras += c
    lignes.push({ label: `Extra — ${ex.nom_option}`, montant: c })
  }
  extras = round2(extras)

  const supplementVille = round2(cfg.supplementVilleArrivee ?? 0)
  if (supplementVille > 0) {
    lignes.push({ label: 'Supplément ville d’arrivée', montant: supplementVille })
  }

  const total = round2(base + extras + supplementVille)
  return { base, extras, supplementVille, total, lignes, devise }
}

// ----- Options / variantes réservables -----------------------
export interface ProductVariant {
  id: string
  excursion_id: string
  nom: string
  ville_depart_id: string | null
  duree: string | null
  nombre_jours: number
  prix_adulte: number | null
  prix_enfant: number | null
  prix_bebe: number | null
  prix_prive_adulte: number | null
  prix_prive_enfant: number | null
  prix_prive_bebe: number | null
  inclus_extra: string | null
  actif: boolean
  ordre: number
}

/** Tarifs effectifs d'une option : ceux de l'option, sinon ceux du produit. */
export function pricingVariante(base: ProductPricing, v: Partial<ProductVariant> | null): ProductPricing {
  if (!v) return base
  const pick = (a: number | null | undefined, b: number) => (a == null ? b : a)
  return {
    prix_adulte: pick(v.prix_adulte, base.prix_adulte),
    prix_enfant: pick(v.prix_enfant, base.prix_enfant),
    prix_bebe: pick(v.prix_bebe, base.prix_bebe),
    prix_prive_adulte: pick(v.prix_prive_adulte, base.prix_prive_adulte),
    prix_prive_enfant: pick(v.prix_prive_enfant, base.prix_prive_enfant),
    prix_prive_bebe: pick(v.prix_prive_bebe, base.prix_prive_bebe),
  }
}

// ----- Réductions --------------------------------------------
export interface ProductDiscount {
  id: string
  excursion_id: string
  variant_id: string | null      // null => toutes les options du produit
  nom: string
  type: 'PCT' | 'MONTANT'
  valeur: number
  devise: string
  permanente: boolean
  date_debut: string | null
  date_fin: string | null
  actif: boolean
}

/** Une réduction est-elle active à la date donnée (YYYY-MM-DD) ? */
export function reductionActive(d: ProductDiscount, dateISO: string): boolean {
  if (!d.actif) return false
  if (d.permanente) return true
  if (d.date_debut && dateISO < d.date_debut) return false
  if (d.date_fin && dateISO > d.date_fin) return false
  return true
}

/**
 * Réduction applicable à une option pour une date donnée.
 * On retient les réductions ciblant cette option OU tout le produit,
 * et on garde celle qui offre le meilleur montant.
 */
export function meilleureReduction(
  discounts: ProductDiscount[],
  variantId: string | null,
  montant: number,
  dateISO: string,
): { discount: ProductDiscount; remise: number } | null {
  let best: { discount: ProductDiscount; remise: number } | null = null
  for (const d of discounts) {
    if (!reductionActive(d, dateISO)) continue
    if (d.variant_id && d.variant_id !== variantId) continue // ciblée sur une autre option
    const remise = d.type === 'PCT'
      ? round2((montant * d.valeur) / 100)
      : Math.min(round2(d.valeur), montant)
    if (!best || remise > best.remise) best = { discount: d, remise }
  }
  return best
}

/** Places restantes sur un départ fixe (null = illimité). */
export function placesRestantes(d: ProductDeparture): number | null {
  if (d.capacite == null) return null
  return Math.max(0, d.capacite - d.places_reservees)
}

/** Une fiche de traduction vide pour une locale. */
export function emptyTranslation(locale: Locale): ProductTranslation {
  return { locale, nom: '', description: '', programme: '', inclus: '', non_inclus: '' }
}
