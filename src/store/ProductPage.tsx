import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useStore } from './StoreContext'
import { fetchProduct, tradProduit, createBooking, type ProductBundle } from './data'
import { setSeo } from './seo'
import {
  pricingVariante, pricingProduit, calculerPrixProduit, meilleureReduction, placesRestantes,
  type TypeSortie, type ProductVariant, type City,
} from '../lib/produits'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { Cover } from './Cover'
import { Stars } from './HomePage'

const today = () => new Date().toISOString().slice(0, 10)

export function ProductPage() {
  const { id } = useParams()
  const { locale, cityId } = useStore()
  const [b, setB] = useState<ProductBundle | null>(null)
  const [cities, setCities] = useState<Record<string, City>>({})
  const [loading, setLoading] = useState(true)

  // Config du configurateur
  const [variantId, setVariantId] = useState<string | null>(null)
  const [mode, setMode] = useState<TypeSortie>('GROUPE')
  const [villeDepart, setVilleDepart] = useState<string>('')
  const [villeArrivee, setVilleArrivee] = useState<string>('')
  const [dateDep, setDateDep] = useState<string>('')
  const [adultes, setAdultes] = useState(2)
  const [enfants, setEnfants] = useState(0)
  const [bebes, setBebes] = useState(0)
  const [extras, setExtras] = useState<Set<string>>(new Set())
  const [checkout, setCheckout] = useState(false)

  useEffect(() => {
    if (!id) return
    Promise.all([
      fetchProduct(id),
      isSupabaseConfigured ? supabase.from('cities').select('*') : Promise.resolve({ data: [] as City[] }),
    ]).then(([bundle, ci]) => {
      setB(bundle)
      const map: Record<string, City> = {}
      for (const c of ((ci as any).data as City[]) ?? []) map[c.id] = c
      setCities(map)
      if (bundle) {
        const depart = bundle.cities.filter((c) => c.role === 'DEPART')
        const pref = depart.find((c) => c.city_id === cityId)
          ?? depart.find((c) => c.par_defaut) ?? depart[0]
        if (pref) setVilleDepart(pref.city_id)
        if (!bundle.excursion.groupe_dispo && bundle.excursion.prive_dispo) setMode('PRIVE')
        setExtras(new Set(bundle.extras.filter((e) => e.obligatoire).map((e) => e.id)))
        const t = tradProduit(bundle, locale)
        setSeo({
          title: `${t.nom} — Depart Travel Services`,
          description: t.description?.slice(0, 155),
          jsonLd: {
            '@context': 'https://schema.org', '@type': 'TouristTrip',
            name: t.nom, description: t.description,
            offers: {
              '@type': 'Offer', priceCurrency: bundle.excursion.devise,
              price: pricingVariante(pricingProduit(bundle.excursion), null).prix_adulte,
              availability: 'https://schema.org/InStock',
            },
          },
        })
      }
      setLoading(false)
    })
  }, [id, cityId, locale])

  const variant = useMemo<ProductVariant | null>(
    () => b?.variants.find((v) => v.id === variantId) ?? null, [b, variantId],
  )
  const pricing = useMemo(() => b ? pricingVariante(pricingProduit(b.excursion), variant) : null, [b, variant])

  const supplementArrivee = useMemo(() => {
    if (!b || !villeArrivee) return 0
    return b.cities.find((c) => c.role === 'ARRIVEE' && c.city_id === villeArrivee)?.supplement ?? 0
  }, [b, villeArrivee])

  const selectedExtras = useMemo(
    () => (b?.extras ?? []).filter((e) => extras.has(e.id)), [b, extras],
  )

  const devis = useMemo(() => {
    if (!b || !pricing) return null
    const cfg = { mode, adultes, enfants, bebes, extrasSelected: selectedExtras, supplementVilleArrivee: supplementArrivee }
    const breakdown = calculerPrixProduit(pricing, cfg, b.excursion.devise)
    // Réduction appliquée à la part « excursion » (base), pas aux extras.
    const promo = meilleureReduction(b.discounts, variantId, breakdown.base, dateDep || today())
    const remise = promo?.remise ?? 0
    return { breakdown, remise, promoNom: promo?.discount.nom, total: Math.max(0, breakdown.total - remise) }
  }, [b, pricing, mode, adultes, enfants, bebes, selectedExtras, supplementArrivee, variantId, dateDep])

  if (loading) return <div className="mx-auto max-w-6xl px-4 py-10 text-slate-500">Chargement…</div>
  if (!b) return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-slate-500">Produit introuvable.</p>
      <Link to="/" className="text-brand-600">← Retour</Link>
    </div>
  )

  const t = tradProduit(b, locale)
  const villesDepart = b.cities.filter((c) => c.role === 'DEPART')
  const villesArrivee = b.cities.filter((c) => c.role === 'ARRIVEE')
  const cityName = (cid: string) => cities[cid]?.nom ?? '—'
  const departsOuverts = b.departures.filter((d) => d.statut === 'OUVERT' && d.date_depart >= today())

  const toggleExtra = (eid: string, obligatoire: boolean) => {
    if (obligatoire) return
    setExtras((s) => { const n = new Set(s); n.has(eid) ? n.delete(eid) : n.add(eid); return n })
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Link to="/" className="text-sm text-brand-600">← Toutes les excursions</Link>

      <div className="mt-3 grid gap-6 lg:grid-cols-3">
        {/* ---- Colonne contenu ---- */}
        <div className="lg:col-span-2">
          <Cover imageUrl={b.excursion.image_url} seed={t.nom} categorie={b.excursion.categorie}
            className="h-72 w-full" rounded="rounded-2xl" />
          {b.excursion.note_moyenne != null && (
            <div className="mt-3"><Stars note={b.excursion.note_moyenne} avis={b.excursion.nb_avis} /></div>
          )}
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
            <span>{b.excursion.categorie || 'Excursion'}</span>
            {b.excursion.duree && <><span>·</span><span>{b.excursion.duree}</span></>}
          </div>
          <h1 className="mt-1 text-2xl font-bold text-slate-800">{t.nom}</h1>
          {t.description && <p className="mt-3 whitespace-pre-line text-slate-600">{t.description}</p>}
          {t.programme && <Bloc titre="Programme" texte={t.programme} />}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {t.inclus && <Bloc titre="✅ Inclus" texte={t.inclus} />}
            {t.non_inclus && <Bloc titre="❌ Non inclus" texte={t.non_inclus} />}
          </div>
        </div>

        {/* ---- Colonne configurateur (sticky) ---- */}
        <aside className="lg:col-span-1">
          <div className="sticky top-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            {/* Ville de départ d'abord */}
            <Field label="📍 Départ de">
              <select value={villeDepart} onChange={(e) => setVilleDepart(e.target.value)} className={selCls}>
                {villesDepart.length === 0 && <option value="">{b.excursion.ville_depart || '—'}</option>}
                {villesDepart.map((c) => <option key={c.city_id} value={c.city_id}>{cityName(c.city_id)}</option>)}
              </select>
            </Field>

            {villesArrivee.length > 0 && (
              <Field label="🏁 Fin dans une autre ville (option)">
                <select value={villeArrivee} onChange={(e) => setVilleArrivee(e.target.value)} className={selCls}>
                  <option value="">Retour au point de départ</option>
                  {villesArrivee.map((c) => (
                    <option key={c.city_id} value={c.city_id}>
                      {cityName(c.city_id)}{c.supplement > 0 ? ` (+${c.supplement} ${c.devise})` : ''}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            {b.variants.length > 0 && (
              <Field label="🧩 Option">
                <select value={variantId ?? ''} onChange={(e) => setVariantId(e.target.value || null)} className={selCls}>
                  <option value="">Formule standard</option>
                  {b.variants.map((v) => <option key={v.id} value={v.id}>{v.nom}</option>)}
                </select>
              </Field>
            )}

            {/* Groupe / Privatif */}
            {(b.excursion.groupe_dispo ?? true) && (b.excursion.prive_dispo ?? true) && (
              <Field label="Type de sortie">
                <div className="grid grid-cols-2 gap-2">
                  <Toggle on={mode === 'GROUPE'} onClick={() => setMode('GROUPE')}>👥 Groupe</Toggle>
                  <Toggle on={mode === 'PRIVE'} onClick={() => setMode('PRIVE')}>⭐ Privatif</Toggle>
                </div>
              </Field>
            )}

            {departsOuverts.length > 0 && (
              <Field label="📅 Date de départ">
                <select value={dateDep} onChange={(e) => setDateDep(e.target.value)} className={selCls}>
                  <option value="">Choisir une date</option>
                  {departsOuverts.map((d) => {
                    const r = placesRestantes(d)
                    return (
                      <option key={d.id} value={d.date_depart}>
                        {d.date_depart}{d.heure ? ` ${d.heure}` : ''}{r != null && r <= 5 ? ` — plus que ${r} places` : ''}
                      </option>
                    )
                  })}
                </select>
              </Field>
            )}

            <Field label="Voyageurs">
              <div className="space-y-2">
                <Stepper label="Adultes" value={adultes} set={setAdultes} min={1} />
                <Stepper label="Enfants" value={enfants} set={setEnfants} min={0} />
                <Stepper label="Bébés" value={bebes} set={setBebes} min={0} />
              </div>
            </Field>

            {b.extras.length > 0 && (
              <Field label="➕ Extras">
                <div className="space-y-1">
                  {b.extras.map((e) => {
                    const trOpt = b.optionTranslations[e.id]?.find((x) => x.locale === locale)
                    return (
                      <label key={e.id} className="flex items-center justify-between gap-2 rounded border border-slate-200 px-2 py-1.5 text-sm">
                        <span className="flex items-center gap-2">
                          <input type="checkbox" checked={extras.has(e.id)} disabled={e.obligatoire}
                            onChange={() => toggleExtra(e.id, e.obligatoire)} />
                          {trOpt?.nom || e.nom_option}{e.obligatoire && <em className="text-xs text-slate-400"> (inclus)</em>}
                        </span>
                        <span className="text-slate-500">+{e.prix_adulte} {b.excursion.devise}</span>
                      </label>
                    )
                  })}
                </div>
              </Field>
            )}

            {/* Récap prix live */}
            {devis && (
              <div className="mt-4 border-t pt-3 text-sm">
                {devis.remise > 0 && (
                  <div className="mb-1 flex items-center justify-between text-red-600">
                    <span>{devis.promoNom || 'Réduction'}</span>
                    <span>-{devis.remise} {b.excursion.devise}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-base font-bold text-slate-800">
                  <span>Total</span>
                  <span>
                    {devis.remise > 0 && (
                      <span className="mr-2 text-sm font-normal text-slate-400 line-through">{devis.breakdown.total}</span>
                    )}
                    {devis.total} {b.excursion.devise}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {mode === 'PRIVE' ? 'Sortie privative' : 'Sortie en groupe'} · {adultes + enfants + bebes} voyageur(s)
                </p>
              </div>
            )}

            <button onClick={() => setCheckout(true)}
              className="mt-4 w-full rounded-lg bg-brand-500 py-3 font-semibold text-white hover:bg-brand-600">
              Réserver
            </button>
            <p className="mt-2 text-center text-xs text-slate-400">Confirmation immédiate · Annulation gratuite</p>
          </div>
        </aside>
      </div>

      {checkout && devis && (
        <CheckoutModal
          onClose={() => setCheckout(false)}
          nomProduit={t.nom}
          total={devis.total}
          devise={b.excursion.devise}
          draft={{
            excursion_id: b.excursion.id,
            date_excursion: dateDep || null,
            heure_depart: b.departures.find((d) => d.date_depart === dateDep)?.heure ?? null,
            type_sortie: mode,
            variant_id: variantId,
            ville_depart_id: villeDepart || null,
            ville_arrivee_id: villeArrivee || null,
            supplement_ville: supplementArrivee,
            reduction_montant: devis.remise,
            reduction_nom: devis.promoNom ?? null,
            montant_total: devis.total,
            devise: b.excursion.devise,
            langue: locale,
            nombre_adultes: adultes,
            nombre_enfants: enfants,
            nombre_bebes: bebes,
            extras: selectedExtras.map((e) => ({ option_id: e.id, nom: e.nom_option, prix: e.prix_adulte })),
          }}
        />
      )}
    </div>
  )
}

// ---------- Modal de finalisation de réservation ----------
function CheckoutModal({
  onClose, nomProduit, total, devise, draft,
}: {
  onClose: () => void
  nomProduit: string
  total: number
  devise: string
  draft: Omit<import('./data').BookingDraft, 'client_nom' | 'client_email' | 'client_telephone' | 'notes'>
}) {
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [tel, setTel] = useState('')
  const [notes, setNotes] = useState('')
  const [state, setState] = useState<'form' | 'sending' | 'done' | 'error'>('form')
  const [msg, setMsg] = useState('')

  const submit = async () => {
    if (!nom || !email) { setMsg('Nom et email sont requis.'); return }
    setState('sending'); setMsg('')
    const res = await createBooking({ ...draft, client_nom: nom, client_email: email, client_telephone: tel, notes })
    if ('error' in res) { setState('error'); setMsg(res.error) }
    else setState('done')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        {state === 'done' ? (
          <div className="text-center">
            <div className="text-4xl">✅</div>
            <h3 className="mt-2 text-lg font-bold">Demande envoyée !</h3>
            <p className="mt-2 text-sm text-slate-500">
              Merci {nom}. Nous avons bien reçu votre demande pour « {nomProduit} ».
              Notre équipe vous confirme par email très vite.
            </p>
            <button onClick={onClose} className="mt-4 rounded-lg bg-brand-500 px-4 py-2 font-medium text-white">Fermer</button>
          </div>
        ) : (
          <>
            <h3 className="text-lg font-bold text-slate-800">Finaliser ma réservation</h3>
            <p className="mt-1 text-sm text-slate-500">{nomProduit}</p>
            <div className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700">
              Total : {total} {devise}
            </div>
            <div className="mt-4 space-y-2">
              <input className={ckCls} placeholder="Nom complet *" value={nom} onChange={(e) => setNom(e.target.value)} />
              <input className={ckCls} type="email" placeholder="Email *" value={email} onChange={(e) => setEmail(e.target.value)} />
              <input className={ckCls} placeholder="Téléphone / WhatsApp" value={tel} onChange={(e) => setTel(e.target.value)} />
              <textarea className={ckCls} rows={2} placeholder="Remarques (hôtel, horaire souhaité…)" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            {msg && <p className="mt-2 text-sm text-red-600">{msg}</p>}
            <div className="mt-4 flex gap-2">
              <button onClick={onClose} className="flex-1 rounded-lg border border-slate-300 py-2 text-sm">Annuler</button>
              <button onClick={submit} disabled={state === 'sending'}
                className="flex-[2] rounded-lg bg-brand-500 py-2 font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
                {state === 'sending' ? 'Envoi…' : 'Confirmer la demande'}
              </button>
            </div>
            <p className="mt-2 text-center text-xs text-slate-400">Sans paiement en ligne pour l’instant · confirmation par email</p>
          </>
        )}
      </div>
    </div>
  )
}

const ckCls = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm'

const selCls = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-xs font-medium text-slate-500">{label}</label>
      {children}
    </div>
  )
}

function Bloc({ titre, texte }: { titre: string; texte: string }) {
  return (
    <div className="mt-4">
      <h3 className="mb-1 font-semibold text-slate-800">{titre}</h3>
      <p className="whitespace-pre-line text-sm text-slate-600">{texte}</p>
    </div>
  )
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-sm ${on ? 'border-brand-500 bg-brand-50 font-medium text-brand-700' : 'border-slate-300 text-slate-600'}`}>
      {children}
    </button>
  )
}

function Stepper({ label, value, set, min }: { label: string; value: number; set: (n: number) => void; min: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-600">{label}</span>
      <div className="flex items-center gap-2">
        <button onClick={() => set(Math.max(min, value - 1))} className="h-7 w-7 rounded border border-slate-300 text-slate-600">−</button>
        <span className="w-6 text-center text-sm">{value}</span>
        <button onClick={() => set(value + 1)} className="h-7 w-7 rounded border border-slate-300 text-slate-600">+</button>
      </div>
    </div>
  )
}
