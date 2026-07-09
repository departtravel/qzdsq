import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useErpRole, peutEcrire } from '../../lib/roles'
import { decomposerTtc } from '../../lib/erp'

// ============================================================
//  CHARGES FIXES — frais généraux de l'agence
//  Salaires, parc, leasings, loyer, taxes/assurances véhicules,
//  assurance FTAV, visites techniques, internet, abonnements,
//  site web, cartes autoroute, etc. Total mensuel équivalent.
// ============================================================

interface FixedCharge {
  id: string
  libelle: string
  categorie: string
  montant: number
  periodicite: string
  vehicle_id: string | null
  actif: boolean
  note: string | null
  taux_tva: number
}
interface VehicleRef { id: string; matricule: string }

const CATEGORIES = [
  'SALAIRE', 'PARC', 'LEASING', 'LOYER', 'TAXE_VEHICULE', 'ASSURANCE_VEHICULE',
  'ASSURANCE_FTAV', 'VISITE_TECHNIQUE', 'CARBURANT', 'INTERNET', 'ABONNEMENT',
  'SITE_WEB', 'CARTE_AUTOROUTE', 'AUTRE',
]
const CAT_LABEL: Record<string, string> = {
  SALAIRE: '👥 Salaires', PARC: '🚚 Parc roulant', LEASING: '🏦 Leasing', LOYER: '🏢 Loyer',
  TAXE_VEHICULE: '🧾 Taxe véhicule', ASSURANCE_VEHICULE: '🛡️ Assurance véhicule',
  ASSURANCE_FTAV: '🛡️ Assurance FTAV', VISITE_TECHNIQUE: '🔧 Visite technique',
  CARBURANT: '⛽ Carburant', INTERNET: '🌐 Internet', ABONNEMENT: '🔁 Abonnement',
  SITE_WEB: '💻 Site web', CARTE_AUTOROUTE: '🛣️ Carte autoroute', AUTRE: '• Autre',
}
const PERIODES = ['MENSUEL', 'TRIMESTRIEL', 'ANNUEL', 'PONCTUEL']

// Ramène un montant à son équivalent MENSUEL pour le total.
function mensuel(c: FixedCharge): number {
  switch (c.periodicite) {
    case 'ANNUEL': return c.montant / 12
    case 'TRIMESTRIEL': return c.montant / 3
    case 'PONCTUEL': return 0 // non récurrent : exclu du mensuel
    default: return c.montant
  }
}

const inputCls = 'w-full rounded border border-slate-300 px-2 py-1'

export function ChargesFixes() {
  const { role } = useErpRole()
  const canWrite = peutEcrire.comptabilite(role)
  const [rows, setRows] = useState<FixedCharge[]>([])
  const [vehicles, setVehicles] = useState<VehicleRef[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [libelle, setLibelle] = useState('')
  const [categorie, setCategorie] = useState('SALAIRE')
  const [montant, setMontant] = useState('')
  const [periodicite, setPeriodicite] = useState('MENSUEL')
  const [tauxTva, setTauxTva] = useState('19')
  const [vehicleId, setVehicleId] = useState('')
  const [note, setNote] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [c, v] = await Promise.all([
      supabase.from('fixed_charges').select('*').order('categorie'),
      supabase.from('vehicles').select('id, matricule').order('matricule'),
    ])
    if (c.error) setError(c.error.message)
    setRows((c.data as FixedCharge[]) ?? [])
    setVehicles((v.data as VehicleRef[]) ?? [])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  async function add(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!libelle.trim()) { setError('Le libellé est obligatoire.'); return }
    const { error } = await supabase.from('fixed_charges').insert({
      libelle: libelle.trim(),
      categorie,
      montant: montant ? Number(montant) : 0,
      periodicite,
      taux_tva: Number(tauxTva) || 0,
      vehicle_id: vehicleId || null,
      note: note.trim() || null,
    })
    if (error) { setError(error.message); return }
    setLibelle(''); setMontant(''); setNote(''); setVehicleId('')
    load()
  }

  async function supprimer(id: string) {
    if (!confirm('Supprimer cette charge fixe ?')) return
    const { error } = await supabase.from('fixed_charges').delete().eq('id', id)
    if (error) setError(error.message)
    else load()
  }

  // Édition du montant en place (pratique pour les lignes « à remplir »).
  async function majMontant(id: string, valeur: number) {
    setError(null)
    const { error } = await supabase.from('fixed_charges').update({ montant: valeur }).eq('id', id)
    if (error) setError(error.message)
    else setRows((prev) => prev.map((r) => (r.id === id ? { ...r, montant: valeur } : r)))
  }

  const totalMensuel = useMemo(
    () => rows.filter((r) => r.actif).reduce((s, r) => s + mensuel(r), 0),
    [rows],
  )
  const totalAnnuel = totalMensuel * 12

  const parCategorie = useMemo(() => {
    const m = new Map<string, { total: number; items: FixedCharge[] }>()
    for (const r of rows) {
      const g = m.get(r.categorie) ?? { total: 0, items: [] }
      g.total += mensuel(r)
      g.items.push(r)
      m.set(r.categorie, g)
    }
    return CATEGORIES.filter((c) => m.has(c)).map((c) => ({ cat: c, ...m.get(c)! }))
  }, [rows])

  const vehLabel = (id: string | null) =>
    id ? vehicles.find((v) => v.id === id)?.matricule ?? '—' : null

  if (loading) return <p className="text-slate-500">Chargement…</p>

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Charges fixes</h2>
        <div className="flex gap-3">
          <Stat label="Total mensuel" value={`${totalMensuel.toFixed(0)} DT`} />
          <Stat label="Total annuel" value={`${totalAnnuel.toFixed(0)} DT`} />
        </div>
      </div>

      {error && <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {canWrite && (
        <form onSubmit={add} className="mb-4 grid grid-cols-1 gap-3 rounded-lg bg-white p-4 shadow sm:grid-cols-3 lg:grid-cols-6">
          <label className="text-sm">
            <span className="mb-1 block text-slate-500">Libellé *</span>
            <input className={inputCls} value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder="Salaire Hiba, Loyer bureau…" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-500">Catégorie</span>
            <select className={inputCls} value={categorie} onChange={(e) => setCategorie(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-500">Montant (DT)</span>
            <input type="number" min={0} className={inputCls} value={montant} onChange={(e) => setMontant(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-500">Périodicité</span>
            <select className={inputCls} value={periodicite} onChange={(e) => setPeriodicite(e.target.value)}>
              {PERIODES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-500">TVA (prix TTC)</span>
            <select className={inputCls} value={tauxTva} onChange={(e) => setTauxTva(e.target.value)}>
              <option value="19">19 %</option>
              <option value="7">7 %</option>
              <option value="0">0 % (exonéré)</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-500">Véhicule (option)</span>
            <select className={inputCls} value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
              <option value="">— aucun —</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.matricule}</option>)}
            </select>
          </label>
          <div className="flex items-end">
            <button className="w-full rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
              Ajouter
            </button>
          </div>
          <label className="text-sm sm:col-span-3 lg:col-span-6">
            <span className="mb-1 block text-slate-500">Note</span>
            <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        </form>
      )}

      {parCategorie.length === 0 ? (
        <p className="text-sm text-slate-500">Aucune charge fixe. Ajoute salaires, loyer, leasings, assurances, internet…</p>
      ) : (
        <div className="space-y-4">
          {parCategorie.map(({ cat, total, items }) => (
            <div key={cat} className="rounded-lg border bg-white shadow">
              <div className="flex items-center justify-between border-b bg-slate-50 px-3 py-2">
                <span className="font-semibold">{CAT_LABEL[cat] ?? cat}</span>
                <span className="text-sm text-slate-500">{total.toFixed(0)} DT / mois</span>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {items.map((r) => (
                    <tr key={r.id} className="border-t first:border-0">
                      <td className="px-3 py-1.5">
                        {r.libelle}
                        {vehLabel(r.vehicle_id) && <span className="ml-2 rounded bg-slate-100 px-1.5 text-xs text-slate-500">🚚 {vehLabel(r.vehicle_id)}</span>}
                        {r.note && <span className="ml-2 text-xs text-slate-400">{r.note}</span>}
                      </td>
                      <td className="px-3 py-1.5 text-right text-slate-500">
                        {canWrite ? (
                          <span className="inline-flex items-center gap-1">
                            <input
                              type="number"
                              min={0}
                              defaultValue={r.montant}
                              onBlur={(e) => {
                                const v = Number(e.target.value) || 0
                                if (v !== r.montant) majMontant(r.id, v)
                              }}
                              className={`w-24 rounded border px-1 py-0.5 text-right ${r.montant === 0 ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}`}
                            />
                            DT / {r.periodicite.toLowerCase()}
                          </span>
                        ) : (
                          <>{r.montant} DT / {r.periodicite.toLowerCase()}</>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right text-xs text-slate-400">
                        HT {decomposerTtc(r.montant, r.taux_tva ?? 19).ht.toFixed(0)} · TVA{' '}
                        {decomposerTtc(r.montant, r.taux_tva ?? 19).tva.toFixed(0)} ({r.taux_tva ?? 19}%)
                      </td>
                      <td className="px-3 py-1.5 text-right">{mensuel(r).toFixed(0)} DT/mois</td>
                      <td className="w-10 px-3 py-1.5 text-right">
                        {canWrite && (
                          <button onClick={() => supprimer(r.id)} className="text-xs text-red-600 hover:underline">✕</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white px-3 py-2 shadow">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-bold text-slate-900">{value}</p>
    </div>
  )
}
