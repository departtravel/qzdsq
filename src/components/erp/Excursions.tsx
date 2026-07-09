import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  calculerRentabilite,
  type CostLine,
  type Excursion,
} from '../../lib/erp'
import { ExcursionForm } from './ExcursionForm'
import { useErpRole, peutEcrire } from '../../lib/roles'

// Vue catalogue des excursions OTA + simulateur de rentabilité.
export function Excursions() {
  const { role } = useErpRole()
  const [excursions, setExcursions] = useState<Excursion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('excursions')
      .select('*')
      .order('code_interne')
    if (error) setError(error.message)
    setExcursions((data as Excursion[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <p className="text-slate-500">Chargement du catalogue…</p>
  if (error)
    return (
      <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error} — as-tu exécuté <code>supabase/erp.sql</code> puis <code>supabase/seed.sql</code> ?
      </div>
    )

  const selected = excursions.find((e) => e.id === selectedId) ?? null
  if (selected)
    return <ExcursionDetail excursion={selected} onBack={() => setSelectedId(null)} />

  if (showForm)
    return (
      <ExcursionForm
        onCancel={() => setShowForm(false)}
        onCreated={() => {
          setShowForm(false)
          load()
        }}
      />
    )

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Catalogue excursions ({excursions.length})</h2>
        {peutEcrire.catalogue(role) && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Ajouter une excursion
          </button>
        )}
      </div>
      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Nom</th>
              <th className="px-3 py-2">Compte OTA</th>
              <th className="px-3 py-2">Durée</th>
              <th className="px-3 py-2 text-right">Adulte</th>
              <th className="px-3 py-2 text-right">Enfant</th>
            </tr>
          </thead>
          <tbody>
            {excursions.map((e) => (
              <tr
                key={e.id}
                onClick={() => setSelectedId(e.id)}
                className="cursor-pointer border-b last:border-0 hover:bg-blue-50"
              >
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-500">{e.code_interne}</td>
                <td className="px-3 py-2">{e.nom}</td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-500">{e.compte_ota}</td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-500">{e.duree}</td>
                <td className="px-3 py-2 text-right">{e.prix_adulte} €</td>
                <td className="px-3 py-2 text-right">{e.prix_enfant} €</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {excursions.length === 0 && (
        <p className="mt-4 text-sm text-slate-500">
          Aucune excursion. Exécute <code>supabase/seed.sql</code> pour charger le catalogue.
        </p>
      )}
    </div>
  )
}

function ExcursionDetail({ excursion, onBack }: { excursion: Excursion; onBack: () => void }) {
  const { role } = useErpRole()
  const canWrite = peutEcrire.catalogue(role)
  const [lignes, setLignes] = useState<CostLine[]>([])
  const [loading, setLoading] = useState(true)
  const [adultes, setAdultes] = useState(10)
  const [enfants, setEnfants] = useState(0)
  const [bebes, setBebes] = useState(0)
  const [capacite, setCapacite] = useState(5)
  // Prix de vente modifiables
  const [pa, setPa] = useState(excursion.prix_adulte)
  const [pe, setPe] = useState(excursion.prix_enfant)
  const [pb, setPb] = useState(excursion.prix_bebe)

  async function savePrix(patch: { prix_adulte?: number; prix_enfant?: number; prix_bebe?: number }) {
    await supabase.from('excursions').update(patch).eq('id', excursion.id)
  }

  const reload = useCallback(async () => {
    const { data } = await supabase
      .from('excursion_cost_lines')
      .select('*')
      .eq('excursion_id', excursion.id)
      .order('jour')
    setLignes((data as CostLine[]) ?? [])
    setLoading(false)
  }, [excursion.id])

  useEffect(() => {
    reload()
  }, [reload])

  const r = useMemo(
    () =>
      calculerRentabilite({
        excursion: { ...excursion, prix_adulte: pa, prix_enfant: pe, prix_bebe: pb },
        lignes,
        adultes,
        enfants,
        bebes,
        capaciteVehicule: capacite,
      }),
    [excursion, lignes, adultes, enfants, bebes, capacite, pa, pe, pb],
  )

  const positif = r.margeTnd >= 0

  return (
    <div>
      <button onClick={onBack} className="mb-4 text-sm text-blue-700 hover:underline">
        ← Retour au catalogue
      </button>
      <div className="mb-4">
        <p className="font-mono text-xs text-slate-400">{excursion.code_interne}</p>
        <h2 className="text-xl font-bold">{excursion.nom}</h2>
        <p className="text-sm text-slate-500">
          {excursion.compte_ota} · {excursion.duree} · Commission {excursion.commission_ota}% · Taux{' '}
          {excursion.taux_conversion} TND/EUR
        </p>
      </div>

      {/* Prix de vente (modifiables) */}
      <div className="mb-4 rounded-lg bg-white p-4 shadow">
        <p className="mb-2 text-xs text-slate-500">💶 Prix de vente (EUR) — modifiables</p>
        <div className="flex flex-wrap gap-4">
          <PrixField label="Prix adulte" value={pa} onChange={setPa} onSave={(v) => savePrix({ prix_adulte: v })} disabled={!canWrite} />
          <PrixField label="Prix enfant" value={pe} onChange={setPe} onSave={(v) => savePrix({ prix_enfant: v })} disabled={!canWrite} />
          <PrixField label="Prix bébé" value={pb} onChange={setPb} onSave={(v) => savePrix({ prix_bebe: v })} disabled={!canWrite} />
        </div>
      </div>

      {/* Simulateur d'effectif */}
      <div className="mb-4 rounded-lg bg-white p-4 shadow">
        <p className="mb-2 text-xs text-slate-500">
          🧮 <strong>Simulateur</strong> — teste une rentabilité « si j'avais X participants ».
          Ces chiffres ne sont pas une vraie réservation ; modifie-les librement.
        </p>
        <div className="flex flex-wrap gap-4">
          <NumField label="Adultes" value={adultes} onChange={setAdultes} />
          <NumField label="Enfants" value={enfants} onChange={setEnfants} />
          <NumField label="Bébés" value={bebes} onChange={setBebes} />
          <NumField label="Capacité véhicule" value={capacite} onChange={setCapacite} min={1} />
        </div>
      </div>

      {/* Cartes résultat */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="CA net" value={`${r.caNetTnd.toFixed(0)} TND`} sub={`${r.caNetEur.toFixed(0)} €`} />
        <Stat label="Coût total" value={`${r.coutTotalTnd.toFixed(0)} TND`} sub={`${r.coutParPersonneTnd.toFixed(1)}/pers`} />
        <Stat
          label="Marge"
          value={`${r.margeTnd.toFixed(0)} TND`}
          sub={`${r.margePct.toFixed(1)} %`}
          tone={positif ? 'good' : 'bad'}
        />
        <Stat
          label="Seuil rentabilité"
          value={r.seuilRentabilite == null ? '∞' : `${r.seuilRentabilite} pers`}
          sub="minimum payants"
          tone={r.seuilRentabilite == null ? 'bad' : 'neutral'}
        />
      </div>

      {/* Détail des coûts */}
      <div className="rounded-lg bg-white p-4 shadow">
        <h3 className="mb-2 font-semibold">Détail des coûts ({loading ? '…' : lignes.length} lignes)</h3>
        {r.detail.length === 0 ? (
          <p className="text-sm text-slate-500">
            Aucune ligne de coût saisie pour cette excursion.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-1">Catégorie</th>
                <th className="py-1">Dépense</th>
                <th className="py-1">Type</th>
                <th className="py-1 text-right">Total TND</th>
              </tr>
            </thead>
            <tbody>
              {r.detail.map((d, i) => (
                <tr key={i} className="border-t">
                  <td className="py-1 text-slate-500">{d.categorie}</td>
                  <td className="py-1">{d.nom}</td>
                  <td className="py-1">
                    <span className={`rounded px-1.5 py-0.5 text-xs ${d.variable ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                      {d.variable ? 'variable' : 'fixe'}
                    </span>
                  </td>
                  <td className="py-1 text-right">{d.totalTnd.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {canWrite && <CostLinesEditor excursionId={excursion.id} lignes={lignes} onChanged={reload} />}
    </div>
  )
}

const CATS = ['TRANSPORT', 'GUIDE', 'CHAUFFEUR', 'RESTAURANT', 'HEBERGEMENT', 'EXTRA', 'GASOIL', 'PEAGE', 'PARKING', 'AUTRE'] as const
const TYPES = ['PAR_PERSONNE', 'PAR_VEHICULE', 'PAR_GROUPE', 'FIXE'] as const

interface Partner { id: string; nom: string }

// Éditeur des lignes de coût d'une excursion existante (repas, hébergement,
// guide, transport, extras…). Renseigne partner_type/partner_id pour la compta.
function CostLinesEditor({
  excursionId, lignes, onChanged,
}: { excursionId: string; lignes: CostLine[]; onChanged: () => void | Promise<void> }) {
  const [restaurants, setRestaurants] = useState<Partner[]>([])
  const [accommodations, setAccommodations] = useState<Partner[]>([])
  const [extras, setExtras] = useState<(Partner & { prix_achat: number | null; devise_achat: string | null })[]>([])
  // Prix adulte du partenaire (dernier tarif connu), pour pré-remplissage.
  const [restoPrix, setRestoPrix] = useState<Map<string, number>>(new Map())
  const [hebergPrix, setHebergPrix] = useState<Map<string, number>>(new Map())
  const [error, setError] = useState<string | null>(null)

  const [jour, setJour] = useState(1)
  const [categorie, setCategorie] = useState<string>('RESTAURANT')
  const [typeDep, setTypeDep] = useState<string>('PAR_PERSONNE')
  const [nom, setNom] = useState('')
  const [prix, setPrix] = useState('')
  const [devise, setDevise] = useState('TND')
  const [tva, setTva] = useState('19')
  const [partnerId, setPartnerId] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('restaurants').select('id, nom').order('nom'),
      supabase.from('accommodations').select('id, nom').order('nom'),
      supabase.from('extras').select('id, nom, prix_achat, devise_achat').order('nom'),
      supabase.from('restaurant_prices').select('restaurant_id, prix_adulte, date_debut').order('date_debut', { ascending: false }),
      supabase.from('accommodation_prices').select('accommodation_id, prix_adulte, date').order('date', { ascending: false }),
    ]).then(([r, a, e, rp, ap]) => {
      setRestaurants((r.data as Partner[]) ?? [])
      setAccommodations((a.data as Partner[]) ?? [])
      setExtras((e.data as (Partner & { prix_achat: number | null; devise_achat: string | null })[]) ?? [])
      // On garde le tarif le plus récent (la requête est triée décroissant).
      const rm = new Map<string, number>()
      for (const x of (rp.data as { restaurant_id: string; prix_adulte: number }[]) ?? [])
        if (!rm.has(x.restaurant_id)) rm.set(x.restaurant_id, x.prix_adulte)
      setRestoPrix(rm)
      const am = new Map<string, number>()
      for (const x of (ap.data as { accommodation_id: string; prix_adulte: number }[]) ?? [])
        if (!am.has(x.accommodation_id)) am.set(x.accommodation_id, x.prix_adulte)
      setHebergPrix(am)
    })
  }, [])

  const partenaires = categorie === 'RESTAURANT' ? restaurants : categorie === 'HEBERGEMENT' ? accommodations : categorie === 'EXTRA' ? extras : []
  const partnerType = categorie === 'RESTAURANT' || categorie === 'HEBERGEMENT' || categorie === 'EXTRA' ? categorie : null

  async function ajouter() {
    setError(null)
    if (!nom.trim()) { setError('Nom de la dépense requis.'); return }
    const { error } = await supabase.from('excursion_cost_lines').insert({
      excursion_id: excursionId,
      jour,
      categorie,
      type_depense: typeDep,
      nom_depense: nom.trim(),
      prix_unitaire: prix ? Number(prix) : 0,
      devise,
      taux_tva: Number(tva) || 0,
      inclure_comptabilite: true,
      partner_type: partnerType,
      partner_id: partnerType ? (partnerId || null) : null,
    })
    if (error) { setError(error.message); return }
    setNom(''); setPrix(''); setPartnerId('')
    onChanged()
  }

  async function supprimer(id: string) {
    await supabase.from('excursion_cost_lines').delete().eq('id', id)
    onChanged()
  }

  return (
    <div className="mt-4 rounded-lg bg-white p-4 shadow">
      <h3 className="mb-3 font-semibold">Ajouter / gérer les charges de cette excursion</h3>
      {error && <div className="mb-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        <Lbl t="Jour"><input type="number" min={1} value={jour} onChange={(e) => setJour(Number(e.target.value) || 1)} className={ipt} /></Lbl>
        <Lbl t="Catégorie">
          <select value={categorie} onChange={(e) => { setCategorie(e.target.value); setPartnerId('') }} className={ipt}>
            {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Lbl>
        {partnerType && (
          <Lbl t="Prestataire">
            <select
              value={partnerId}
              onChange={(e) => {
                const id = e.target.value
                setPartnerId(id)
                const p = partenaires.find((x) => x.id === id)
                if (!p) return
                setNom(p.nom)
                if (categorie === 'EXTRA') {
                  const ex = extras.find((x) => x.id === id)
                  if (ex) { setPrix(String(ex.prix_achat ?? '')); setDevise(ex.devise_achat ?? 'TND') }
                } else if (categorie === 'RESTAURANT') {
                  setPrix(String(restoPrix.get(id) ?? '')); setDevise('TND'); setTypeDep('PAR_PERSONNE')
                } else if (categorie === 'HEBERGEMENT') {
                  setPrix(String(hebergPrix.get(id) ?? '')); setDevise('TND'); setTypeDep('PAR_PERSONNE')
                }
              }}
              className={ipt}
            >
              <option value="">— choisir / manuel —</option>
              {partenaires.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
            </select>
          </Lbl>
        )}
        <Lbl t="Type">
          <select value={typeDep} onChange={(e) => setTypeDep(e.target.value)} className={ipt}>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Lbl>
        <Lbl t="Nom dépense"><input value={nom} onChange={(e) => setNom(e.target.value)} className={ipt} /></Lbl>
        <Lbl t="Prix unitaire"><input type="number" min={0} step="0.01" value={prix} onChange={(e) => setPrix(e.target.value)} className={ipt} /></Lbl>
        <Lbl t="Devise"><input value={devise} onChange={(e) => setDevise(e.target.value)} className={ipt} /></Lbl>
        <Lbl t="TVA (TTC)">
          <select value={tva} onChange={(e) => setTva(e.target.value)} className={ipt}>
            <option value="19">19 %</option><option value="7">7 %</option><option value="0">0 %</option>
          </select>
        </Lbl>
      </div>
      <button onClick={ajouter} className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
        + Ajouter la charge
      </button>

      {lignes.length > 0 && (
        <table className="mt-4 w-full text-sm">
          <tbody>
            {lignes.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="py-1 text-slate-500">J{l.jour} · {l.categorie}</td>
                <td className="py-1">{l.nom_depense}</td>
                <td className="py-1 text-slate-500">{l.type_depense}</td>
                <td className="py-1 text-right">{l.prix_unitaire} {l.devise}</td>
                <td className="py-1 text-right">
                  <button onClick={() => supprimer(l.id)} className="text-xs text-red-600 hover:underline">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function PrixField({
  label, value, onChange, onSave, disabled,
}: { label: string; value: number; onChange: (n: number) => void; onSave: (n: number) => void; disabled?: boolean }) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-slate-500">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number" min={0} step="0.01" value={value} disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          onBlur={(e) => !disabled && onSave(Number(e.target.value) || 0)}
          className="w-24 rounded border border-slate-300 px-2 py-1 disabled:bg-slate-50"
        />
        <span className="text-slate-400">€</span>
      </div>
    </label>
  )
}

const ipt = 'w-full rounded border border-slate-300 px-2 py-1'
function Lbl({ t, children }: { t: string; children: React.ReactNode }) {
  return <label className="text-sm"><span className="mb-1 block text-slate-500">{t}</span>{children}</label>
}

function NumField({
  label, value, onChange, min = 0,
}: { label: string; value: number; onChange: (n: number) => void; min?: number }) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-slate-500">{label}</span>
      <input
        type="number"
        min={min}
        value={value}
        onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
        className="w-24 rounded border border-slate-300 px-2 py-1"
      />
    </label>
  )
}

function Stat({
  label, value, sub, tone = 'neutral',
}: { label: string; value: string; sub?: string; tone?: 'good' | 'bad' | 'neutral' }) {
  const color =
    tone === 'good' ? 'text-green-700' : tone === 'bad' ? 'text-red-700' : 'text-slate-900'
  return (
    <div className="rounded-lg bg-white p-3 shadow">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  )
}
