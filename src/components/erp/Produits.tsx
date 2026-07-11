import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import type { Excursion } from '../../lib/erp'
import {
  LOCALES, LOCALE_LABELS, emptyTranslation,
  type Locale, type ProductTranslation, type ProductExtra,
  type City, type ProductCity, type ProductDeparture, type ProductPricing,
  type ProductVariant, type ProductDiscount,
} from '../../lib/produits'

// ============================================================
//  Back-office PRODUITS (façon supplier GetYourGuide)
//  Création / édition / duplication d'un produit avec :
//   - tarif GROUPE + PRIVÉ
//   - extras réservables (add-ons)
//   - traductions 8 langues
//   - villes de départ / d'arrivée (+ supplément)
//   - départs fixes
//  + catalogue filtrable (durée, catégorie, prix)
// ============================================================

type Onglet = 'general' | 'traductions' | 'tarifs' | 'options' | 'extras' | 'villes' | 'departs' | 'reductions'

// _key : identifiant local stable pour relier une réduction à une option
// avant même que l'option ait un id en base.
type VariantRow = Partial<ProductVariant> & { _key: string }
type DiscountRow = Partial<ProductDiscount> & { variant_key: string | null }

interface FullProduct {
  excursion: Partial<Excursion> & ProductPricing & {
    taux_conversion_prive?: number
    prive_dispo?: boolean
    groupe_dispo?: boolean
    langue_source?: string
  }
  translations: ProductTranslation[]
  extras: Partial<ProductExtra>[]
  villes: Partial<ProductCity>[]
  departs: Partial<ProductDeparture>[]
  variants: VariantRow[]
  discounts: DiscountRow[]
}

let _keySeq = 0
const newKey = () => `k${++_keySeq}`

const emptyProduct = (): FullProduct => ({
  excursion: {
    code_interne: '', nom: '', categorie: '', duree: 'journée', nombre_jours: 1,
    ville_depart: '', destination: '', devise: 'EUR', statut: 'ACTIVE',
    prix_adulte: 0, prix_enfant: 0, prix_bebe: 0,
    prix_prive_adulte: 0, prix_prive_enfant: 0, prix_prive_bebe: 0,
    taux_conversion_prive: 4.2, commission_ota: 30, taux_conversion: 3.34,
    prive_dispo: true, groupe_dispo: true, langue_source: 'fr',
  },
  translations: LOCALES.map(emptyTranslation),
  extras: [],
  villes: [],
  departs: [],
  variants: [],
  discounts: [],
})

export function Produits() {
  const [rows, setRows] = useState<Excursion[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<FullProduct | null>(null)

  // Filtres user-friendly
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [duree, setDuree] = useState('')
  const [prixMax, setPrixMax] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [ex, ci] = await Promise.all([
      supabase.from('excursions').select('*').order('code_interne'),
      supabase.from('cities').select('*').eq('actif', true).order('nom'),
    ])
    if (ex.error) setError(ex.error.message)
    setRows((ex.data as Excursion[]) ?? [])
    setCities((ci.data as City[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const categories = useMemo(
    () => [...new Set(rows.map((r) => r.categorie).filter(Boolean))] as string[],
    [rows],
  )
  const durees = useMemo(
    () => [...new Set(rows.map((r) => r.duree).filter(Boolean))] as string[],
    [rows],
  )

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const max = prixMax ? Number(prixMax) : Infinity
    return rows.filter((r) =>
      (!needle || r.nom.toLowerCase().includes(needle) || r.code_interne.toLowerCase().includes(needle)) &&
      (!cat || r.categorie === cat) &&
      (!duree || r.duree === duree) &&
      (r.prix_adulte ?? 0) <= max,
    )
  }, [rows, q, cat, duree, prixMax])

  const openNew = () => setEditing(emptyProduct())

  const openEdit = async (id: string) => {
    setError(null)
    const [ex, tr, op, pc, dp, vr, ds] = await Promise.all([
      supabase.from('excursions').select('*').eq('id', id).single(),
      supabase.from('product_translations').select('*').eq('excursion_id', id),
      supabase.from('excursion_options').select('*').eq('excursion_id', id).order('ordre'),
      supabase.from('product_cities').select('*').eq('excursion_id', id),
      supabase.from('product_departures').select('*').eq('excursion_id', id).order('date_depart'),
      supabase.from('product_variants').select('*').eq('excursion_id', id).order('ordre'),
      supabase.from('product_discounts').select('*').eq('excursion_id', id),
    ])
    if (ex.error) { setError(ex.error.message); return }
    const byLocale = new Map((tr.data ?? []).map((t: any) => [t.locale, t]))
    setEditing({
      excursion: ex.data as any,
      translations: LOCALES.map((l) => ({ ...emptyTranslation(l), ...(byLocale.get(l) ?? {}) })),
      extras: (op.data as any[]) ?? [],
      villes: (pc.data as any[]) ?? [],
      departs: (dp.data as any[]) ?? [],
      // _key = id existant : les réductions ciblées le référencent via variant_key.
      variants: ((vr.data as any[]) ?? []).map((v) => ({ ...v, _key: v.id })),
      discounts: ((ds.data as any[]) ?? []).map((d) => ({ ...d, variant_key: d.variant_id ?? null })),
    })
  }

  // Duplication : on recharge tout puis on efface les identifiants + code.
  const clone = async (id: string, nom: string) => {
    await openEdit(id)
    setEditing((prev) => {
      if (!prev) return prev
      return {
        excursion: {
          ...prev.excursion, id: undefined, created_at: undefined,
          code_interne: '', nom: `${nom} (copie)`,
        },
        translations: prev.translations.map((t) => ({ ...t, id: undefined, excursion_id: undefined })),
        extras: prev.extras.map((e) => ({ ...e, id: undefined, excursion_id: undefined })),
        villes: prev.villes.map((v) => ({ ...v, id: undefined, excursion_id: undefined })),
        departs: prev.departs.map((d) => ({ ...d, id: undefined, excursion_id: undefined })),
        // Nouvelles clés locales ; on reporte le lien réduction→option.
        variants: prev.variants.map((v) => {
          const _key = newKey()
          return { ...v, id: undefined, excursion_id: undefined, _key, _old: v._key }
        }) as any,
        discounts: prev.discounts.map((d) => ({ ...d, id: undefined, excursion_id: undefined })),
      }
    })
    // Re-mappe variant_key des réductions vers les nouvelles clés d'options.
    setEditing((prev) => {
      if (!prev) return prev
      const remap = new Map((prev.variants as any[]).map((v) => [v._old, v._key]))
      return {
        ...prev,
        variants: prev.variants.map((v) => { const { ...rest } = v as any; delete rest._old; return rest }),
        discounts: prev.discounts.map((d) => ({
          ...d, variant_key: d.variant_key ? (remap.get(d.variant_key) ?? null) : null,
        })),
      }
    })
  }

  if (editing)
    return (
      <ProduitForm
        product={editing}
        cities={cities}
        onCancel={() => setEditing(null)}
        onSaved={() => { setEditing(null); load() }}
        onError={setError}
      />
    )

  if (loading) return <p className="text-slate-500">Chargement du catalogue…</p>

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Produits ({filtered.length}/{rows.length})</h2>
        <button onClick={openNew} className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          + Nouveau produit
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error} — as-tu exécuté <code>supabase/erp.sql</code> puis <code>supabase/produits.sql</code> ?
        </div>
      )}

      {/* ----- Filtres user-friendly ----- */}
      <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg bg-white p-3 shadow sm:grid-cols-4">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔎 Rechercher…"
          className="rounded border border-slate-300 px-3 py-2 text-sm" />
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="rounded border border-slate-300 px-3 py-2 text-sm">
          <option value="">Toutes catégories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={duree} onChange={(e) => setDuree(e.target.value)} className="rounded border border-slate-300 px-3 py-2 text-sm">
          <option value="">Toutes durées</option>
          {durees.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <input value={prixMax} onChange={(e) => setPrixMax(e.target.value)} type="number" min={0} placeholder="Prix max €"
          className="rounded border border-slate-300 px-3 py-2 text-sm" />
      </div>

      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-3 py-2">Code</th><th className="px-3 py-2">Nom</th>
              <th className="px-3 py-2">Catégorie</th><th className="px-3 py-2">Durée</th>
              <th className="px-3 py-2 text-right">Groupe €</th><th className="px-3 py-2 text-right">Privé €</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id} className="border-b last:border-0 hover:bg-blue-50">
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-500">{e.code_interne}</td>
                <td className="px-3 py-2">{e.nom}</td>
                <td className="px-3 py-2 text-slate-500">{e.categorie}</td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-500">{e.duree}</td>
                <td className="px-3 py-2 text-right">{e.prix_adulte}</td>
                <td className="px-3 py-2 text-right">{(e as any).prix_prive_adulte ?? '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  <button onClick={() => openEdit(e.id)} className="mr-2 text-blue-600 hover:underline">Éditer</button>
                  <button onClick={() => clone(e.id, e.nom)} className="text-slate-500 hover:underline">Dupliquer</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && <p className="mt-4 text-sm text-slate-500">Aucun produit ne correspond aux filtres.</p>}
    </div>
  )
}

// ============================================================
//  Formulaire produit (multi-onglets)
// ============================================================
function ProduitForm({
  product, cities, onCancel, onSaved, onError,
}: {
  product: FullProduct
  cities: City[]
  onCancel: () => void
  onSaved: () => void
  onError: (m: string) => void
}) {
  const [p, setP] = useState<FullProduct>(product)
  const [tab, setTab] = useState<Onglet>('general')
  const [saving, setSaving] = useState(false)
  const isNew = !p.excursion.id

  const setEx = (patch: Partial<FullProduct['excursion']>) =>
    setP((s) => ({ ...s, excursion: { ...s.excursion, ...patch } }))

  const num = (v: string) => (v === '' ? 0 : Number(v))

  const save = async () => {
    if (!p.excursion.code_interne || !p.excursion.nom) {
      onError('Le code interne et le nom sont obligatoires.'); setTab('general'); return
    }
    setSaving(true)
    try {
      // 1) Excursion (insert ou update)
      const ex = { ...p.excursion } as any
      delete ex.created_at
      let excursionId = ex.id
      if (isNew) {
        delete ex.id
        const { data, error } = await supabase.from('excursions').insert(ex).select('id').single()
        if (error) throw error
        excursionId = data.id
      } else {
        const { error } = await supabase.from('excursions').update(ex).eq('id', excursionId)
        if (error) throw error
      }

      // 2) Traductions (upsert par locale, on ne garde que celles remplies)
      const trs = p.translations
        .filter((t) => t.nom || t.description || t.programme || t.inclus || t.non_inclus)
        .map((t) => ({
          excursion_id: excursionId, locale: t.locale, nom: t.nom, description: t.description,
          programme: t.programme, inclus: t.inclus, non_inclus: t.non_inclus,
        }))
      if (trs.length)
        await supabase.from('product_translations').upsert(trs, { onConflict: 'excursion_id,locale' })

      // 3) Extras : on remplace l'ensemble (delete + insert) pour ce produit
      await supabase.from('excursion_options').delete().eq('excursion_id', excursionId)
      const extras = p.extras.filter((e) => e.nom_option).map((e, i) => ({
        excursion_id: excursionId, nom_option: e.nom_option, description: e.description ?? null,
        categorie: e.categorie ?? null, prix_adulte: e.prix_adulte ?? 0, prix_enfant: e.prix_enfant ?? 0,
        prix_bebe: e.prix_bebe ?? 0, actif: e.actif ?? true, obligatoire: e.obligatoire ?? false, ordre: i,
      }))
      if (extras.length) await supabase.from('excursion_options').insert(extras)

      // 4) Villes
      await supabase.from('product_cities').delete().eq('excursion_id', excursionId)
      const villes = p.villes.filter((v) => v.city_id).map((v) => ({
        excursion_id: excursionId, city_id: v.city_id, role: v.role ?? 'DEPART',
        supplement: v.supplement ?? 0, devise: v.devise ?? 'EUR', par_defaut: v.par_defaut ?? false,
      }))
      if (villes.length) await supabase.from('product_cities').insert(villes)

      // 5) Départs fixes
      await supabase.from('product_departures').delete().eq('excursion_id', excursionId)
      const departs = p.departs.filter((d) => d.date_depart).map((d) => ({
        excursion_id: excursionId, date_depart: d.date_depart, heure: d.heure ?? null,
        type_sortie: d.type_sortie ?? 'GROUPE', capacite: d.capacite ?? null,
        places_reservees: d.places_reservees ?? 0, statut: d.statut ?? 'OUVERT', note: d.note ?? null,
      }))
      if (departs.length) await supabase.from('product_departures').insert(departs)

      // 6) Options / variantes — insérées d'abord pour récupérer leurs id,
      //    puis on relie les réductions ciblées via _key -> id réel.
      await supabase.from('product_variants').delete().eq('excursion_id', excursionId)
      const keptVariants = p.variants.filter((v) => v.nom)
      const keyToId = new Map<string, string>()
      if (keptVariants.length) {
        const payload = keptVariants.map((v, i) => ({
          excursion_id: excursionId, nom: v.nom, ville_depart_id: v.ville_depart_id ?? null,
          duree: v.duree ?? null, nombre_jours: v.nombre_jours ?? 1,
          prix_adulte: v.prix_adulte ?? null, prix_enfant: v.prix_enfant ?? null, prix_bebe: v.prix_bebe ?? null,
          prix_prive_adulte: v.prix_prive_adulte ?? null, prix_prive_enfant: v.prix_prive_enfant ?? null,
          prix_prive_bebe: v.prix_prive_bebe ?? null, inclus_extra: v.inclus_extra ?? null,
          actif: v.actif ?? true, ordre: i,
        }))
        const { data, error } = await supabase.from('product_variants').insert(payload).select('id')
        if (error) throw error
        keptVariants.forEach((v, i) => keyToId.set(v._key, (data as any[])[i].id))
      }

      // 7) Réductions (variant_key null => tout le produit)
      await supabase.from('product_discounts').delete().eq('excursion_id', excursionId)
      const discounts = p.discounts.filter((d) => d.nom).map((d) => ({
        excursion_id: excursionId,
        variant_id: d.variant_key ? (keyToId.get(d.variant_key) ?? null) : null,
        nom: d.nom, type: d.type ?? 'PCT', valeur: d.valeur ?? 0, devise: d.devise ?? 'EUR',
        permanente: d.permanente ?? false,
        date_debut: d.permanente ? null : (d.date_debut || null),
        date_fin: d.permanente ? null : (d.date_fin || null),
        actif: d.actif ?? true,
      }))
      if (discounts.length) await supabase.from('product_discounts').insert(discounts)

      onSaved()
    } catch (e: any) {
      onError(e.message ?? String(e)); setSaving(false)
    }
  }

  const TABS: { key: Onglet; label: string }[] = [
    { key: 'general', label: 'Général' },
    { key: 'traductions', label: '🌐 Traductions' },
    { key: 'tarifs', label: '💶 Tarifs groupe/privé' },
    { key: 'options', label: '🧩 Options' },
    { key: 'extras', label: '➕ Extras' },
    { key: 'villes', label: '📍 Villes' },
    { key: 'departs', label: '📅 Départs fixes' },
    { key: 'reductions', label: '🏷️ Réductions' },
  ]

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {isNew ? 'Nouveau produit' : `Édition — ${p.excursion.nom}`}
        </h2>
        <div className="flex gap-2">
          <button onClick={onCancel} className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">Annuler</button>
          <button onClick={save} disabled={saving}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1 border-b">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`rounded-t px-3 py-2 text-sm ${tab === t.key ? 'border-b-2 border-blue-600 font-medium text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-lg bg-white p-4 shadow">
        {tab === 'general' && <OngletGeneral p={p} setEx={setEx} num={num} />}
        {tab === 'traductions' && <OngletTraductions p={p} setP={setP} />}
        {tab === 'tarifs' && <OngletTarifs p={p} setEx={setEx} num={num} />}
        {tab === 'options' && <OngletOptions p={p} setP={setP} cities={cities} num={num} />}
        {tab === 'extras' && <OngletExtras p={p} setP={setP} num={num} />}
        {tab === 'villes' && <OngletVilles p={p} setP={setP} cities={cities} num={num} />}
        {tab === 'departs' && <OngletDeparts p={p} setP={setP} num={num} />}
        {tab === 'reductions' && <OngletReductions p={p} setP={setP} num={num} />}
      </div>
    </div>
  )
}

const L = ({ children }: { children: ReactNode }) => (
  <label className="mb-1 block text-xs font-medium text-slate-500">{children}</label>
)
const inputCls = 'w-full rounded border border-slate-300 px-3 py-2 text-sm'

// ---------- Onglet Général ----------
function OngletGeneral({ p, setEx, num }: any) {
  const e = p.excursion
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div><L>Code interne *</L><input className={inputCls} value={e.code_interne ?? ''} onChange={(x) => setEx({ code_interne: x.target.value })} /></div>
      <div><L>Nom (langue source) *</L><input className={inputCls} value={e.nom ?? ''} onChange={(x) => setEx({ nom: x.target.value })} placeholder="Ksar Ghilane 1 day desert tour" /></div>
      <div><L>Catégorie</L><input className={inputCls} value={e.categorie ?? ''} onChange={(x) => setEx({ categorie: x.target.value })} placeholder="Désert, Culture…" /></div>
      <div><L>Durée</L>
        <select className={inputCls} value={e.duree ?? ''} onChange={(x) => setEx({ duree: x.target.value })}>
          {['demi-journée', 'journée', '2 jours', '3 jours', '4 jours', '5 jours et +'].map((d) => <option key={d}>{d}</option>)}
        </select>
      </div>
      <div><L>Nombre de jours</L><input type="number" min={1} className={inputCls} value={e.nombre_jours ?? 1} onChange={(x) => setEx({ nombre_jours: num(x.target.value) || 1 })} /></div>
      <div><L>Destination</L><input className={inputCls} value={e.destination ?? ''} onChange={(x) => setEx({ destination: x.target.value })} /></div>
      <div><L>Devise</L>
        <select className={inputCls} value={e.devise ?? 'EUR'} onChange={(x) => setEx({ devise: x.target.value })}>
          {['EUR', 'USD', 'TND'].map((d) => <option key={d}>{d}</option>)}
        </select>
      </div>
      <div><L>Statut</L>
        <select className={inputCls} value={e.statut ?? 'ACTIVE'} onChange={(x) => setEx({ statut: x.target.value })}>
          {['ACTIVE', 'BROUILLON', 'ARCHIVE'].map((d) => <option key={d}>{d}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2"><L>Photo principale (URL)</L><input className={inputCls} value={e.image_url ?? ''} onChange={(x) => setEx({ image_url: x.target.value })} placeholder="https://…/photo.jpg" /></div>
      <div><L>Note moyenne (0-5)</L><input type="number" min={0} max={5} step="0.1" className={inputCls} value={e.note_moyenne ?? ''} onChange={(x) => setEx({ note_moyenne: x.target.value === '' ? null : num(x.target.value) })} /></div>
      <div><L>Nombre d'avis</L><input type="number" min={0} className={inputCls} value={e.nb_avis ?? ''} onChange={(x) => setEx({ nb_avis: num(x.target.value) })} /></div>
      <div className="flex items-center gap-4 sm:col-span-2">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={e.best_seller ?? false} onChange={(x) => setEx({ best_seller: x.target.checked })} /> 🏆 Best-seller</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={e.nouveaute ?? false} onChange={(x) => setEx({ nouveaute: x.target.checked })} /> ✨ Nouveauté</label>
      </div>
    </div>
  )
}

// ---------- Onglet Traductions ----------
function OngletTraductions({ p, setP }: any) {
  const [loc, setLoc] = useState<Locale>('fr')
  const t: ProductTranslation = p.translations.find((x: ProductTranslation) => x.locale === loc)
  const upd = (patch: Partial<ProductTranslation>) =>
    setP((s: FullProduct) => ({ ...s, translations: s.translations.map((x) => x.locale === loc ? { ...x, ...patch } : x) }))
  const filled = (l: Locale) => {
    const tr = p.translations.find((x: ProductTranslation) => x.locale === l)
    return tr && (tr.nom || tr.description)
  }
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1">
        {LOCALES.map((l) => (
          <button key={l} onClick={() => setLoc(l)}
            className={`rounded px-3 py-1 text-xs ${loc === l ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
            {LOCALE_LABELS[l]}{filled(l) ? ' ✓' : ''}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3">
        <div><L>Nom / titre</L><input className={inputCls} value={t.nom} onChange={(x) => upd({ nom: x.target.value })} /></div>
        <div><L>Description</L><textarea className={inputCls} rows={3} value={t.description} onChange={(x) => upd({ description: x.target.value })} /></div>
        <div><L>Programme</L><textarea className={inputCls} rows={3} value={t.programme} onChange={(x) => upd({ programme: x.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><L>Inclus</L><textarea className={inputCls} rows={2} value={t.inclus} onChange={(x) => upd({ inclus: x.target.value })} /></div>
          <div><L>Non inclus</L><textarea className={inputCls} rows={2} value={t.non_inclus} onChange={(x) => upd({ non_inclus: x.target.value })} /></div>
        </div>
      </div>
    </div>
  )
}

// ---------- Onglet Tarifs groupe / privé ----------
function OngletTarifs({ p, setEx, num }: any) {
  const e = p.excursion
  const priceInput = (label: string, key: string) => (
    <div><L>{label}</L><input type="number" min={0} step="0.01" className={inputCls} value={e[key] ?? 0} onChange={(x) => setEx({ [key]: num(x.target.value) })} /></div>
  )
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div className="rounded-lg border border-slate-200 p-4">
        <div className="mb-3 flex items-center gap-2">
          <input type="checkbox" checked={e.groupe_dispo ?? true} onChange={(x) => setEx({ groupe_dispo: x.target.checked })} />
          <h3 className="font-medium">👥 Sortie en groupe</h3>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {priceInput('Adulte', 'prix_adulte')}
          {priceInput('Enfant', 'prix_enfant')}
          {priceInput('Bébé', 'prix_bebe')}
        </div>
      </div>
      <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
        <div className="mb-3 flex items-center gap-2">
          <input type="checkbox" checked={e.prive_dispo ?? true} onChange={(x) => setEx({ prive_dispo: x.target.checked })} />
          <h3 className="font-medium">⭐ Sortie privative</h3>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {priceInput('Adulte', 'prix_prive_adulte')}
          {priceInput('Enfant', 'prix_prive_enfant')}
          {priceInput('Bébé', 'prix_prive_bebe')}
        </div>
        <div className="mt-3 w-1/2">
          <L>Conversion privatif (marge)</L>
          <input type="number" min={0} step="0.01" className={inputCls} value={e.taux_conversion_prive ?? 4.2} onChange={(x) => setEx({ taux_conversion_prive: num(x.target.value) })} />
        </div>
      </div>
      <div className="md:col-span-2">
        <L>Acompte demandé en ligne (% du total — vide = valeur par défaut)</L>
        <input type="number" min={0} max={100} className={`${inputCls} sm:w-1/3`} value={e.acompte_pct ?? ''} onChange={(x) => setEx({ acompte_pct: x.target.value === '' ? null : num(x.target.value) })} placeholder="ex. 30" />
      </div>
    </div>
  )
}

// ---------- Onglet Extras ----------
function OngletExtras({ p, setP, num }: any) {
  const add = () => setP((s: FullProduct) => ({ ...s, extras: [...s.extras, { nom_option: '', categorie: 'Activité', prix_adulte: 0, prix_enfant: 0, prix_bebe: 0, actif: true, obligatoire: false }] }))
  const upd = (i: number, patch: any) => setP((s: FullProduct) => ({ ...s, extras: s.extras.map((e, j) => j === i ? { ...e, ...patch } : e) }))
  const del = (i: number) => setP((s: FullProduct) => ({ ...s, extras: s.extras.filter((_, j) => j !== i) }))
  return (
    <div>
      <p className="mb-3 text-sm text-slate-500">Extras réservables par le client (ex. Camel ride, Quad tour). Le prix coché s’ajoute au prix de l’excursion.</p>
      <div className="space-y-2">
        {p.extras.map((e: any, i: number) => (
          <div key={i} className="grid grid-cols-12 gap-2 rounded border border-slate-200 p-2">
            <input className="col-span-3 rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Nom (Camel ride)" value={e.nom_option ?? ''} onChange={(x) => upd(i, { nom_option: x.target.value })} />
            <input className="col-span-2 rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Catégorie" value={e.categorie ?? ''} onChange={(x) => upd(i, { categorie: x.target.value })} />
            <input type="number" className="col-span-2 rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Adulte" value={e.prix_adulte ?? 0} onChange={(x) => upd(i, { prix_adulte: num(x.target.value) })} />
            <input type="number" className="col-span-2 rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Enfant" value={e.prix_enfant ?? 0} onChange={(x) => upd(i, { prix_enfant: num(x.target.value) })} />
            <label className="col-span-2 flex items-center gap-1 text-xs text-slate-500">
              <input type="checkbox" checked={e.obligatoire ?? false} onChange={(x) => upd(i, { obligatoire: x.target.checked })} /> obligatoire
            </label>
            <button onClick={() => del(i)} className="col-span-1 text-red-500 hover:underline">✕</button>
          </div>
        ))}
      </div>
      <button onClick={add} className="mt-3 rounded border border-blue-300 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50">+ Ajouter un extra</button>
    </div>
  )
}

// ---------- Onglet Villes ----------
function OngletVilles({ p, setP, cities, num }: any) {
  const add = (role: 'DEPART' | 'ARRIVEE') => setP((s: FullProduct) => ({ ...s, villes: [...s.villes, { city_id: cities[0]?.id, role, supplement: 0, devise: 'EUR', par_defaut: false }] }))
  const upd = (i: number, patch: any) => setP((s: FullProduct) => ({ ...s, villes: s.villes.map((v, j) => j === i ? { ...v, ...patch } : v) }))
  const del = (i: number) => setP((s: FullProduct) => ({ ...s, villes: s.villes.filter((_, j) => j !== i) }))
  const rows = (role: 'DEPART' | 'ARRIVEE') =>
    p.villes.map((v: any, i: number) => ({ v, i })).filter((r: any) => (r.v.role ?? 'DEPART') === role)

  const Block = ({ role, titre, hint, withSup }: any) => (
    <div className="rounded-lg border border-slate-200 p-4">
      <h3 className="mb-1 font-medium">{titre}</h3>
      <p className="mb-3 text-xs text-slate-500">{hint}</p>
      <div className="space-y-2">
        {rows(role).map(({ v, i }: any) => (
          <div key={i} className="flex items-center gap-2">
            <select className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm" value={v.city_id ?? ''} onChange={(x) => upd(i, { city_id: x.target.value })}>
              {cities.map((c: City) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
            {withSup && (
              <input type="number" className="w-28 rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Supplément €" value={v.supplement ?? 0} onChange={(x) => upd(i, { supplement: num(x.target.value) })} />
            )}
            <label className="flex items-center gap-1 text-xs text-slate-500">
              <input type="checkbox" checked={v.par_defaut ?? false} onChange={(x) => upd(i, { par_defaut: x.target.checked })} /> défaut
            </label>
            <button onClick={() => del(i)} className="text-red-500 hover:underline">✕</button>
          </div>
        ))}
      </div>
      <button onClick={() => add(role)} className="mt-3 rounded border border-blue-300 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50">+ Ajouter une ville</button>
    </div>
  )

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Block role="DEPART" titre="🚏 Villes de départ" hint="Le client choisit d’abord sa ville de début d’excursion." withSup={false} />
      <Block role="ARRIVEE" titre="🏁 Villes d’arrivée (fin ailleurs)" hint="Fin dans une autre ville = supplément ajouté au prix." withSup={true} />
    </div>
  )
}

// ---------- Onglet Options / variantes ----------
function OngletOptions({ p, setP, cities, num }: any) {
  const add = () => setP((s: FullProduct) => ({
    ...s, variants: [...s.variants, {
      _key: newKey(), nom: '', ville_depart_id: cities[0]?.id ?? null, duree: s.excursion.duree ?? 'journée',
      nombre_jours: s.excursion.nombre_jours ?? 1, actif: true,
      prix_adulte: null, prix_enfant: null, prix_bebe: null,
      prix_prive_adulte: null, prix_prive_enfant: null, prix_prive_bebe: null, inclus_extra: '',
    }],
  }))
  const upd = (i: number, patch: any) => setP((s: FullProduct) => ({ ...s, variants: s.variants.map((v, j) => j === i ? { ...v, ...patch } : v) }))
  const del = (i: number) => setP((s: FullProduct) => ({ ...s, variants: s.variants.filter((_, j) => j !== i) }))
  const n = (val: string) => (val === '' ? null : num(val))
  return (
    <div>
      <p className="mb-3 text-sm text-slate-500">
        Variantes réservables du produit (ex. « 2 jours désert depuis Tunis », « … depuis Hammamet », « … avec quad inclus »).
        Laisse un prix vide pour reprendre celui de la fiche produit.
      </p>
      <div className="space-y-3">
        {p.variants.map((v: VariantRow, i: number) => (
          <div key={v._key} className="rounded border border-slate-200 p-3">
            <div className="mb-2 flex items-center gap-2">
              <input className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Nom de l'option" value={v.nom ?? ''} onChange={(x) => upd(i, { nom: x.target.value })} />
              <select className="rounded border border-slate-300 px-2 py-1 text-sm" value={v.ville_depart_id ?? ''} onChange={(x) => upd(i, { ville_depart_id: x.target.value || null })}>
                <option value="">— ville départ —</option>
                {cities.map((c: City) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
              <input className="w-40 rounded border border-slate-300 px-2 py-1 text-sm" placeholder="inclus (quad…)" value={v.inclus_extra ?? ''} onChange={(x) => upd(i, { inclus_extra: x.target.value })} />
              <button onClick={() => del(i)} className="text-red-500 hover:underline">✕</button>
            </div>
            <div className="grid grid-cols-6 gap-2">
              <input type="number" className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Grp adulte" value={v.prix_adulte ?? ''} onChange={(x) => upd(i, { prix_adulte: n(x.target.value) })} />
              <input type="number" className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Grp enfant" value={v.prix_enfant ?? ''} onChange={(x) => upd(i, { prix_enfant: n(x.target.value) })} />
              <input type="number" className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Grp bébé" value={v.prix_bebe ?? ''} onChange={(x) => upd(i, { prix_bebe: n(x.target.value) })} />
              <input type="number" className="rounded border border-amber-300 px-2 py-1 text-sm" placeholder="Priv adulte" value={v.prix_prive_adulte ?? ''} onChange={(x) => upd(i, { prix_prive_adulte: n(x.target.value) })} />
              <input type="number" className="rounded border border-amber-300 px-2 py-1 text-sm" placeholder="Priv enfant" value={v.prix_prive_enfant ?? ''} onChange={(x) => upd(i, { prix_prive_enfant: n(x.target.value) })} />
              <input type="number" className="rounded border border-amber-300 px-2 py-1 text-sm" placeholder="Priv bébé" value={v.prix_prive_bebe ?? ''} onChange={(x) => upd(i, { prix_prive_bebe: n(x.target.value) })} />
            </div>
          </div>
        ))}
      </div>
      <button onClick={add} className="mt-3 rounded border border-blue-300 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50">+ Ajouter une option</button>
    </div>
  )
}

// ---------- Onglet Réductions ----------
function OngletReductions({ p, setP, num }: any) {
  const add = () => setP((s: FullProduct) => ({
    ...s, discounts: [...s.discounts, {
      variant_key: null, nom: '', type: 'PCT', valeur: 0, devise: 'EUR',
      permanente: true, date_debut: null, date_fin: null, actif: true,
    }],
  }))
  const upd = (i: number, patch: any) => setP((s: FullProduct) => ({ ...s, discounts: s.discounts.map((d, j) => j === i ? { ...d, ...patch } : d) }))
  const del = (i: number) => setP((s: FullProduct) => ({ ...s, discounts: s.discounts.filter((_, j) => j !== i) }))
  return (
    <div>
      <p className="mb-3 text-sm text-slate-500">
        Réduction permanente ou sur une période (calendrier). Cible : tout le produit ou une seule option.
        Le client ne verra que le prix promotionnel.
      </p>
      <div className="space-y-2">
        {p.discounts.map((d: DiscountRow, i: number) => (
          <div key={i} className="rounded border border-slate-200 p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <input className="w-48 rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Nom (Promo été)" value={d.nom ?? ''} onChange={(x) => upd(i, { nom: x.target.value })} />
              <select className="rounded border border-slate-300 px-2 py-1 text-sm" value={d.type ?? 'PCT'} onChange={(x) => upd(i, { type: x.target.value })}>
                <option value="PCT">%</option><option value="MONTANT">Montant</option>
              </select>
              <input type="number" className="w-24 rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Valeur" value={d.valeur ?? 0} onChange={(x) => upd(i, { valeur: num(x.target.value) })} />
              <select className="rounded border border-slate-300 px-2 py-1 text-sm" value={d.variant_key ?? ''} onChange={(x) => upd(i, { variant_key: x.target.value || null })}>
                <option value="">Tout le produit</option>
                {p.variants.filter((v: VariantRow) => v.nom).map((v: VariantRow) => <option key={v._key} value={v._key}>{v.nom}</option>)}
              </select>
              <button onClick={() => del(i)} className="ml-auto text-red-500 hover:underline">✕</button>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="flex items-center gap-1"><input type="checkbox" checked={d.permanente ?? false} onChange={(x) => upd(i, { permanente: x.target.checked })} /> Permanente</label>
              {!d.permanente && <>
                <span className="text-slate-500">du</span>
                <input type="date" className="rounded border border-slate-300 px-2 py-1 text-sm" value={d.date_debut ?? ''} onChange={(x) => upd(i, { date_debut: x.target.value || null })} />
                <span className="text-slate-500">au</span>
                <input type="date" className="rounded border border-slate-300 px-2 py-1 text-sm" value={d.date_fin ?? ''} onChange={(x) => upd(i, { date_fin: x.target.value || null })} />
              </>}
              <label className="flex items-center gap-1"><input type="checkbox" checked={d.actif ?? true} onChange={(x) => upd(i, { actif: x.target.checked })} /> Active</label>
            </div>
          </div>
        ))}
      </div>
      <button onClick={add} className="mt-3 rounded border border-blue-300 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50">+ Ajouter une réduction</button>
    </div>
  )
}

// ---------- Onglet Départs fixes ----------
function OngletDeparts({ p, setP, num }: any) {
  const add = () => setP((s: FullProduct) => ({ ...s, departs: [...s.departs, { date_depart: '', heure: '', type_sortie: 'GROUPE', capacite: null, places_reservees: 0, statut: 'OUVERT' }] }))
  const upd = (i: number, patch: any) => setP((s: FullProduct) => ({ ...s, departs: s.departs.map((d, j) => j === i ? { ...d, ...patch } : d) }))
  const del = (i: number) => setP((s: FullProduct) => ({ ...s, departs: s.departs.filter((_, j) => j !== i) }))
  return (
    <div>
      <p className="mb-3 text-sm text-slate-500">Départs programmés (excursions et circuits multijours). La date de fin découle du nombre de jours.</p>
      <div className="space-y-2">
        {p.departs.map((d: any, i: number) => (
          <div key={i} className="grid grid-cols-12 gap-2 rounded border border-slate-200 p-2">
            <input type="date" className="col-span-3 rounded border border-slate-300 px-2 py-1 text-sm" value={d.date_depart ?? ''} onChange={(x) => upd(i, { date_depart: x.target.value })} />
            <input type="time" className="col-span-2 rounded border border-slate-300 px-2 py-1 text-sm" value={d.heure ?? ''} onChange={(x) => upd(i, { heure: x.target.value })} />
            <select className="col-span-2 rounded border border-slate-300 px-2 py-1 text-sm" value={d.type_sortie ?? 'GROUPE'} onChange={(x) => upd(i, { type_sortie: x.target.value })}>
              <option value="GROUPE">Groupe</option><option value="PRIVE">Privatif</option>
            </select>
            <input type="number" className="col-span-2 rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Capacité" value={d.capacite ?? ''} onChange={(x) => upd(i, { capacite: x.target.value === '' ? null : num(x.target.value) })} />
            <select className="col-span-2 rounded border border-slate-300 px-2 py-1 text-sm" value={d.statut ?? 'OUVERT'} onChange={(x) => upd(i, { statut: x.target.value })}>
              {['OUVERT', 'COMPLET', 'ANNULE', 'TERMINE'].map((s) => <option key={s}>{s}</option>)}
            </select>
            <button onClick={() => del(i)} className="col-span-1 text-red-500 hover:underline">✕</button>
          </div>
        ))}
      </div>
      <button onClick={add} className="mt-3 rounded border border-blue-300 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50">+ Ajouter un départ</button>
    </div>
  )
}
