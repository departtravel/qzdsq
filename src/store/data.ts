// ============================================================
//  Vitrine — accès aux données PUBLIQUES du catalogue (anon).
//  Lecture seule ; s'appuie sur les policies de public_read.sql.
// ============================================================
import { supabase, isSupabaseConfigured } from '../lib/supabase'
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
  if (!isSupabaseConfigured) {
    const { DEMO_ITEMS, DEMO_CITIES } = await import('./demo')
    return { items: DEMO_ITEMS, cities: DEMO_CITIES }
  }
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
  if (!isSupabaseConfigured) return null
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

/** Déclenche un email transactionnel (best-effort, jamais bloquant). */
async function notify(type: 'booking' | 'quote' | 'contact' | 'reply', data: Record<string, unknown>): Promise<void> {
  try {
    if (!isSupabaseConfigured) return
    await supabase.functions.invoke('send-email', { body: { type, data } })
  } catch { /* silencieux : l'email ne doit jamais casser le parcours */ }
}

// ----- Création d'une réservation depuis la vitrine ----------
export interface BookingDraft {
  excursion_id: string
  date_excursion: string | null
  heure_depart: string | null
  type_sortie: 'GROUPE' | 'PRIVE'
  variant_id: string | null
  ville_depart_id: string | null
  ville_arrivee_id: string | null
  supplement_ville: number
  reduction_montant: number
  reduction_nom: string | null
  montant_total: number
  devise: string
  langue: string
  client_nom: string
  client_email: string
  client_telephone: string
  nombre_adultes: number
  nombre_enfants: number
  nombre_bebes: number
  notes: string | null
  extras: { option_id: string; nom: string; prix: number }[]
  /** Nom du produit (email uniquement, pas une colonne DB). */
  produit?: string
}

/** Insère une réservation (statut NOUVELLE, source WEB) + ses extras. */
export async function createBooking(d: BookingDraft): Promise<{ id: string } | { error: string }> {
  if (!isSupabaseConfigured) return { error: 'Supabase non configuré' }
  const { extras, produit: _produit, ...booking } = d
  const { data, error } = await supabase
    .from('bookings')
    .insert({ ...booking, statut: 'NOUVELLE', source: 'WEB' })
    .select('id')
    .single()
  if (error) return { error: error.message }
  const bookingId = data.id as string
  if (extras.length) {
    await supabase.from('booking_extras').insert(
      extras.map((e) => ({ booking_id: bookingId, option_id: e.option_id, nom: e.nom, prix: e.prix })),
    )
  }
  await notify('booking', {
    client_nom: d.client_nom, client_email: d.client_email, client_telephone: d.client_telephone,
    produit: d.produit ?? 'Excursion', date: d.date_excursion,
    mode: d.type_sortie === 'PRIVE' ? 'Privatif' : 'Groupe',
    voyageurs: d.nombre_adultes + d.nombre_enfants + d.nombre_bebes,
    total: d.montant_total, devise: d.devise,
  })
  return { id: bookingId }
}

// ----- Paiement en ligne (Stripe) ----------------------------
/** Crée une session Stripe et renvoie l'URL de redirection. */
export async function createCheckout(args: {
  booking_id: string; montant_total: number; devise: string
  mode: 'acompte' | 'total'; acompte_pct?: number | null; produit: string
}): Promise<{ url: string } | { error: string }> {
  if (!isSupabaseConfigured) return { error: 'Paiement non disponible en démo.' }
  try {
    const { data, error } = await supabase.functions.invoke('create-checkout', {
      body: { ...args, origin: location.origin },
    })
    if (error) return { error: error.message }
    if (data?.error) return { error: data.error }
    return { url: data.url as string }
  } catch (e) {
    return { error: String(e) }
  }
}

// ----- Contact / messagerie ----------------------------------
export interface ContactDraft {
  client_nom: string
  client_email: string
  client_telephone: string
  sujet: string
  excursion_id: string | null
  message: string
}

/** Ouvre une conversation et poste le premier message du client. */
export async function createConversation(d: ContactDraft): Promise<{ id: string } | { error: string }> {
  if (!isSupabaseConfigured) return { error: 'Supabase non configuré' }
  const { message, ...conv } = d
  const { data, error } = await supabase
    .from('conversations')
    .insert({ ...conv, statut: 'OUVERTE' })
    .select('id')
    .single()
  if (error) return { error: error.message }
  const convId = data.id as string
  const m = await supabase.from('messages').insert({
    conversation_id: convId, expediteur: 'CLIENT', corps: message,
  })
  if (m.error) return { error: m.error.message }
  await notify('contact', { client_nom: d.client_nom, client_email: d.client_email, message })
  return { id: convId }
}

// ----- Demandes de devis (événements + circuits) -------------
export type QuoteType = 'TEAM_BUILDING' | 'EVG' | 'EVJF' | 'MARIAGE' | 'CIRCUIT' | 'AUTRE'

export interface QuoteDraft {
  type: QuoteType
  client_nom: string
  client_email: string
  client_telephone: string
  nb_personnes: number | null
  date_souhaitee: string | null
  ville_depart: string | null
  budget: number | null
  devise?: string
  message: string | null
  details?: unknown
  montant_estime?: number | null
}

/** Enregistre une demande de devis (statut NOUVELLE, source WEB). */
export async function createQuote(d: QuoteDraft): Promise<{ id: string } | { error: string }> {
  if (!isSupabaseConfigured) return { error: 'Supabase non configuré' }
  const { data, error } = await supabase
    .from('quote_requests')
    .insert({ ...d, statut: 'NOUVELLE', source: 'WEB' })
    .select('id')
    .single()
  if (error) return { error: error.message }
  await notify('quote', {
    client_nom: d.client_nom, client_email: d.client_email, client_telephone: d.client_telephone,
    quote_type: d.type, message: d.message,
  })
  return { id: data.id as string }
}

// ----- Compteur de visites (pour le taux de conversion) ------
/** Enregistre une visite, au plus une fois par session navigateur. */
export async function trackVisit(): Promise<void> {
  try {
    if (!isSupabaseConfigured) return
    let sid = sessionStorage.getItem('dts_sid')
    if (!sid) {
      sid = Math.random().toString(36).slice(2) + Date.now().toString(36)
      sessionStorage.setItem('dts_sid', sid)
      await supabase.from('site_visits').insert({ path: location.pathname, session_id: sid })
    }
  } catch { /* silencieux : ne jamais bloquer la vitrine */ }
}

// ----- Avis clients ------------------------------------------
export interface Review {
  id: string
  excursion_id: string
  client_nom: string
  pays: string | null
  note: number
  commentaire: string | null
  created_at: string
}

/** Avis PUBLIÉS d'un produit (les plus récents d'abord). */
export async function fetchReviews(excursionId: string): Promise<Review[]> {
  if (!isSupabaseConfigured) return []
  const { data } = await supabase
    .from('reviews').select('*')
    .eq('excursion_id', excursionId).eq('statut', 'PUBLIE')
    .order('created_at', { ascending: false })
  return (data as Review[]) ?? []
}

/** Dépose un avis (en attente de modération). */
export async function createReview(d: {
  excursion_id: string; client_nom: string; pays: string | null; note: number; commentaire: string | null
}): Promise<{ ok: true } | { error: string }> {
  if (!isSupabaseConfigured) return { error: 'Supabase non configuré' }
  const { error } = await supabase.from('reviews').insert({ ...d, statut: 'EN_ATTENTE' })
  if (error) return { error: error.message }
  return { ok: true }
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
