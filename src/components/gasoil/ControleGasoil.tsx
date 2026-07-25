import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type {
  AdblueLog,
  AdblueLogInput,
  Chauffeur,
  GasoilExcursion,
  Trip,
  TripInput,
  Vehicle,
} from '../../lib/types'
import type { Severity } from '../../lib/fleet'
import {
  adblueDosage,
  adblueStatus,
  aggregate,
  comparerExcursions,
  computeTrips,
  coutMoyenParSortie,
  filtrerPeriode,
  kmMoyenParSortie,
  latestKm,
  parChauffeur,
  parExcursion,
  parPeriode,
  type Periode,
} from '../../lib/gasoil'
import { exportCarnetCsv, exportStatsCsv } from '../../lib/export'
import { printGasoilReport } from '../../lib/pdf'
import { StatusBadge } from '../StatusBadge'
import { TripForm } from './TripForm'
import { AdblueForm } from './AdblueForm'

type Onglet = 'sorties' | 'adblue' | 'chauffeurs' | 'excursions' | 'rapport'

const ONGLETS: { key: Onglet; label: string }[] = [
  { key: 'sorties', label: '📖 Carnet de bord' },
  { key: 'adblue', label: '💧 AdBlue' },
  { key: 'chauffeurs', label: '🏁 Chauffeurs' },
  { key: 'excursions', label: '🧭 Excursions' },
  { key: 'rapport', label: '📄 Rapport' },
]

const rowColor: Record<Severity, string> = {
  ok: '', warn: 'bg-amber-50', danger: 'bg-red-50', unknown: '',
}
const nomComplet = (c: Chauffeur) => [c.nom, c.prenom].filter(Boolean).join(' ')
const dt = (n: number | null, d = 2) => (n == null ? '—' : `${n.toFixed(d)} DT`)

export function ControleGasoil() {
  const [onglet, setOnglet] = useState<Onglet>('sorties')
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [trips, setTrips] = useState<Trip[]>([])
  const [adblue, setAdblue] = useState<AdblueLog[]>([])
  const [chauffeurs, setChauffeurs] = useState<Chauffeur[]>([])
  const [excursions, setExcursions] = useState<GasoilExcursion[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtres
  const [vehiculeFiltre, setVehiculeFiltre] = useState('')
  const [du, setDu] = useState('')
  const [au, setAu] = useState('')
  const [periode, setPeriode] = useState<Periode>('mois')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id
      if (!uid) return
      supabase.from('profiles').select('role').eq('id', uid).single().then(({ data }) => {
        setIsAdmin((data as { role?: string } | null)?.role === 'admin')
      })
    })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [v, t, a, c, e] = await Promise.all([
      supabase.from('vehicles').select('*').order('matricule'),
      supabase.from('trips').select('*'),
      supabase.from('adblue_logs').select('*'),
      supabase.from('chauffeurs').select('*').order('nom'),
      supabase.from('gasoil_excursions').select('*').order('nom'),
    ])
    const firstErr = [v, t, a, c, e].find((r) => r.error)?.error
    if (firstErr) setError(firstErr.message)
    setVehicles((v.data as Vehicle[]) ?? [])
    setTrips((t.data as Trip[]) ?? [])
    setAdblue((a.data as AdblueLog[]) ?? [])
    setChauffeurs((c.data as Chauffeur[]) ?? [])
    setExcursions((e.data as GasoilExcursion[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // -------- maps & données dérivées --------
  const vehicleById = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles])
  const matriculeById = useMemo(
    () => new Map(vehicles.map((v) => [v.id, v.matricule])),
    [vehicles],
  )
  const excursionNom = useMemo(() => new Map(excursions.map((e) => [e.id, e.nom])), [excursions])
  const excursionKmRef = useMemo(
    () => new Map(excursions.map((e) => [e.id, e.km_reference])),
    [excursions],
  )

  // Km courant par véhicule (toutes sorties + pleins AdBlue confondus)
  const kmByVehicle = useMemo(() => {
    const m: Record<string, number | null> = {}
    for (const v of vehicles) {
      m[v.id] = latestKm(
        trips.filter((t) => t.vehicle_id === v.id),
        adblue.filter((a) => a.vehicle_id === v.id),
      )
    }
    return m
  }, [vehicles, trips, adblue])

  const tripsFiltres = useMemo(() => {
    let list = filtrerPeriode(trips, du, au)
    if (vehiculeFiltre) list = list.filter((t) => t.vehicle_id === vehiculeFiltre)
    return list
  }, [trips, du, au, vehiculeFiltre])

  const computed = useMemo(() => computeTrips(tripsFiltres, vehicleById), [tripsFiltres, vehicleById])
  const statsChauffeurs = useMemo(() => parChauffeur(computed), [computed])
  const statsVehicules = useMemo(
    () => aggregate(computed, (c) => matriculeById.get(c.trip.vehicle_id) ?? '—'),
    [computed, matriculeById],
  )
  const statsPeriode = useMemo(() => parPeriode(computed, periode), [computed, periode])
  const compExcursions = useMemo(
    () => comparerExcursions(computed, { excursionNom, excursionKmRef, matricule: matriculeById }),
    [computed, excursionNom, excursionKmRef, matriculeById],
  )
  const coutExcursions = useMemo(() => parExcursion(computed, excursionNom), [computed, excursionNom])

  const adblueParVehicule = useMemo(
    () =>
      vehicles.map((v) => {
        const logs = adblue.filter((a) => a.vehicle_id === v.id)
        return {
          vehicle: v,
          status: adblueStatus(logs, kmByVehicle[v.id]),
          dosage: adblueDosage(logs),
          logs,
        }
      }),
    [vehicles, adblue, kmByVehicle],
  )

  // -------- CRUD --------
  async function addTrip(input: TripInput) {
    const { error } = await supabase.from('trips').insert(input)
    if (error) throw new Error(error.message)
    await load()
  }
  async function deleteTrip(id: string) {
    if (!confirm('Supprimer cette sortie ?')) return
    await supabase.from('trips').delete().eq('id', id)
    await load()
  }
  async function addAdblue(input: AdblueLogInput) {
    const { error } = await supabase.from('adblue_logs').insert(input)
    if (error) throw new Error(error.message)
    await load()
  }
  async function deleteAdblue(id: string) {
    if (!confirm('Supprimer ce plein AdBlue ?')) return
    await supabase.from('adblue_logs').delete().eq('id', id)
    await load()
  }
  async function addChauffeur(nom: string, prenom: string, tel: string) {
    const { error } = await supabase
      .from('chauffeurs')
      .insert({ nom, prenom: prenom || null, telephone: tel || null })
    if (error) throw new Error(error.message)
    await load()
  }
  async function deleteChauffeur(id: string) {
    if (!confirm('Supprimer ce chauffeur ?')) return
    await supabase.from('chauffeurs').delete().eq('id', id)
    await load()
  }
  async function addExcursion(nom: string, kmRef: string) {
    const { error } = await supabase
      .from('gasoil_excursions')
      .insert({ nom, km_reference: kmRef ? Number(kmRef) : null })
    if (error) throw new Error(error.message)
    await load()
  }
  async function deleteExcursion(id: string) {
    if (!confirm('Supprimer cette excursion ?')) return
    await supabase.from('gasoil_excursions').delete().eq('id', id)
    await load()
  }

  function genererPdf() {
    printGasoilReport({
      titre: 'Contrôle Gasoil',
      periode: periodeLabel(du, au),
      parChauffeur: statsChauffeurs,
      parVehicule: statsVehicules,
      adblue: adblueParVehicule.map((a) => ({ matricule: a.vehicle.matricule, status: a.status })),
      excursions: compExcursions,
    })
  }

  if (loading) return <p className="text-slate-500">Chargement…</p>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">⛽ Contrôle Gasoil</h2>
        {!isAdmin && (
          <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
            Lecture seule
          </span>
        )}
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error} — exécute <code>supabase/gasoil.sql</code> dans Supabase.
        </div>
      )}

      {/* Filtres communs */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg bg-white p-3 shadow">
        <Field label="Véhicule">
          <select
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
            value={vehiculeFiltre}
            onChange={(e) => setVehiculeFiltre(e.target.value)}
          >
            <option value="">Tous</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>{v.matricule}</option>
            ))}
          </select>
        </Field>
        <Field label="Du">
          <input type="date" className="rounded border border-slate-300 px-2 py-1.5 text-sm" value={du} onChange={(e) => setDu(e.target.value)} />
        </Field>
        <Field label="Au">
          <input type="date" className="rounded border border-slate-300 px-2 py-1.5 text-sm" value={au} onChange={(e) => setAu(e.target.value)} />
        </Field>
        {(du || au || vehiculeFiltre) && (
          <button onClick={() => { setDu(''); setAu(''); setVehiculeFiltre('') }} className="text-sm text-blue-600 hover:underline">
            Réinitialiser
          </button>
        )}
        <span className="ml-auto text-sm text-slate-500">
          {computed.length} sortie(s) · {computed.reduce((s, c) => s + c.distance, 0).toLocaleString('fr-FR')} km
        </span>
      </div>

      {/* Sous-onglets */}
      <nav className="flex flex-wrap gap-1 text-sm">
        {ONGLETS.map((o) => (
          <button
            key={o.key}
            onClick={() => setOnglet(o.key)}
            className={`rounded px-3 py-1.5 ${onglet === o.key ? 'bg-blue-100 font-medium text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {o.label}
          </button>
        ))}
      </nav>

      {onglet === 'sorties' && (
        <SortiesTab
          isAdmin={isAdmin}
          vehicles={vehicles}
          chauffeurs={chauffeurs}
          excursions={excursions}
          computed={computed}
          matriculeById={matriculeById}
          kmByVehicle={kmByVehicle}
          onAdd={addTrip}
          onDelete={deleteTrip}
        />
      )}

      {onglet === 'adblue' && (
        <AdblueTab
          isAdmin={isAdmin}
          vehicles={vehicles}
          kmByVehicle={kmByVehicle}
          data={adblueParVehicule}
          onAdd={addAdblue}
          onDelete={deleteAdblue}
        />
      )}

      {onglet === 'chauffeurs' && (
        <ChauffeursTab
          isAdmin={isAdmin}
          stats={statsChauffeurs}
          chauffeurs={chauffeurs}
          onAdd={addChauffeur}
          onDelete={deleteChauffeur}
        />
      )}

      {onglet === 'excursions' && (
        <ExcursionsTab
          isAdmin={isAdmin}
          excursions={excursions}
          comparaisons={compExcursions}
          couts={coutExcursions}
          onAdd={addExcursion}
          onDelete={deleteExcursion}
        />
      )}

      {onglet === 'rapport' && (
        <RapportTab
          periode={periode}
          setPeriode={setPeriode}
          statsPeriode={statsPeriode}
          statsChauffeurs={statsChauffeurs}
          statsVehicules={statsVehicules}
          onPdf={genererPdf}
        />
      )}
    </div>
  )
}

// ================================================================
//  Sous-composants
// ================================================================

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  )
}

function SortiesTab(props: {
  isAdmin: boolean
  vehicles: Vehicle[]
  chauffeurs: Chauffeur[]
  excursions: GasoilExcursion[]
  computed: ReturnType<typeof computeTrips>
  matriculeById: Map<string, string>
  kmByVehicle: Record<string, number | null>
  onAdd: (i: TripInput) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const { computed, matriculeById } = props
  return (
    <div className="space-y-4">
      {props.isAdmin && (
        <div className="rounded-lg bg-white p-4 shadow">
          <h3 className="mb-3 font-semibold">Nouvelle sortie</h3>
          {props.vehicles.length === 0 ? (
            <p className="text-sm text-slate-500">Ajoute d'abord un véhicule dans l'onglet 🚚 Flotte.</p>
          ) : (
            <TripForm
              vehicles={props.vehicles}
              chauffeurs={props.chauffeurs}
              excursions={props.excursions}
              defaultKmByVehicle={props.kmByVehicle}
              onSave={props.onAdd}
            />
          )}
        </div>
      )}

      <div className="rounded-lg bg-white p-4 shadow">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Carnet de bord</h3>
          {computed.length > 0 && (
            <button onClick={() => exportCarnetCsv(computed, matriculeById)} className="text-sm text-blue-600 hover:underline">
              Exporter CSV
            </button>
          )}
        </div>
        {computed.length === 0 ? (
          <p className="text-slate-500">Aucune sortie enregistrée.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-slate-500">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Véhicule</th>
                  <th className="py-2 pr-3">Chauffeur</th>
                  <th className="py-2 pr-3">Excursion</th>
                  <th className="py-2 pr-3">Distance</th>
                  <th className="py-2 pr-3">Litres</th>
                  <th className="py-2 pr-3">Conso</th>
                  <th className="py-2 pr-3">Écart</th>
                  <th className="py-2 pr-3">Coût/km</th>
                  {props.isAdmin && <th className="py-2"></th>}
                </tr>
              </thead>
              <tbody>
                {computed.map((c) => (
                  <tr key={c.trip.id} className={`border-b align-top ${rowColor[c.severity]}`}>
                    <td className="py-2 pr-3 whitespace-nowrap">{new Date(c.trip.date).toLocaleDateString('fr-FR')}</td>
                    <td className="py-2 pr-3">{matriculeById.get(c.trip.vehicle_id) ?? '—'}</td>
                    <td className="py-2 pr-3">{c.trip.chauffeur ?? '—'}</td>
                    <td className="py-2 pr-3">
                      {c.trip.excursion ?? '—'}
                      {c.trip.lieux_prise_en_charge && (
                        <span className="block text-xs text-slate-400" title={c.trip.lieux_prise_en_charge}>
                          📍 {c.trip.lieux_prise_en_charge}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3">{c.distance.toLocaleString('fr-FR')} km</td>
                    <td className="py-2 pr-3">{c.trip.litres} L</td>
                    <td className="py-2 pr-3 font-medium">{c.conso != null ? `${c.conso.toFixed(1)}` : '—'}</td>
                    <td className="py-2 pr-3">
                      {c.ecartPct != null ? (
                        <span className={c.severity === 'danger' ? 'font-semibold text-red-600' : c.severity === 'warn' ? 'font-semibold text-amber-600' : 'text-green-600'}>
                          {c.ecartPct >= 0 ? '+' : ''}{c.ecartPct.toFixed(0)}%{c.severity === 'danger' && ' ⚠️'}
                        </span>
                      ) : '—'}
                      {c.anomalies.length > 0 && (
                        <span className="block text-xs text-red-500">{c.anomalies.join(' · ')}</span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {c.costPerKm != null ? c.costPerKm.toFixed(3) : '—'}
                      {c.trip.ticket_url && (
                        <a href={c.trip.ticket_url} target="_blank" rel="noreferrer" className="ml-2 text-blue-600 hover:underline" title="Voir le ticket">📎</a>
                      )}
                    </td>
                    {props.isAdmin && (
                      <td className="py-2 text-right">
                        <button onClick={() => props.onDelete(c.trip.id)} className="text-xs text-slate-400 hover:text-red-600">Suppr.</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function AdblueTab(props: {
  isAdmin: boolean
  vehicles: Vehicle[]
  kmByVehicle: Record<string, number | null>
  data: { vehicle: Vehicle; status: ReturnType<typeof adblueStatus>; dosage: number | null; logs: AdblueLog[] }[]
  onAdd: (i: AdblueLogInput) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  return (
    <div className="space-y-4">
      {props.isAdmin && props.vehicles.length > 0 && (
        <div className="rounded-lg bg-white p-4 shadow">
          <h3 className="mb-3 font-semibold">Nouveau plein AdBlue</h3>
          <AdblueForm vehicles={props.vehicles} defaultKmByVehicle={props.kmByVehicle} onSave={props.onAdd} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {props.data.map((d) => (
          <div key={d.vehicle.id} className="rounded-lg bg-white p-4 shadow">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-semibold">{d.vehicle.matricule}</span>
              <StatusBadge status={d.status} />
            </div>
            <p className="text-xs text-slate-500">
              {d.dosage != null ? `Dosage réel : ${d.dosage.toFixed(1)} L/1000 km` : 'Dosage : —'}
              {' · '}
              {d.logs.length} plein(s)
            </p>
            {d.logs.length > 0 && props.isAdmin && (
              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                {[...d.logs].sort((a, b) => b.km_compteur - a.km_compteur).slice(0, 4).map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-2">
                    <span>{new Date(l.date).toLocaleDateString('fr-FR')} · {l.litres} L · {l.km_compteur.toLocaleString('fr-FR')} km · auto. {l.autonomie_km.toLocaleString('fr-FR')} km</span>
                    <button onClick={() => props.onDelete(l.id)} className="text-slate-400 hover:text-red-600">✕</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function ChauffeursTab(props: {
  isAdmin: boolean
  stats: ReturnType<typeof parChauffeur>
  chauffeurs: Chauffeur[]
  onAdd: (nom: string, prenom: string, tel: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [nom, setNom] = useState('')
  const [prenom, setPrenom] = useState('')
  const [tel, setTel] = useState('')
  const [busy, setBusy] = useState(false)
  const inp = 'rounded border border-slate-300 px-2 py-1.5 text-sm'

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!nom) return
    setBusy(true)
    try {
      await props.onAdd(nom, prenom, tel)
      setNom(''); setPrenom(''); setTel('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      {props.isAdmin && (
        <div className="rounded-lg bg-white p-4 shadow">
          <h3 className="mb-3 font-semibold">Base chauffeurs</h3>
          <form onSubmit={add} className="flex flex-wrap items-end gap-2">
            <input className={inp} placeholder="Nom *" value={nom} onChange={(e) => setNom(e.target.value)} />
            <input className={inp} placeholder="Prénom" value={prenom} onChange={(e) => setPrenom(e.target.value)} />
            <input className={inp} placeholder="Téléphone" value={tel} onChange={(e) => setTel(e.target.value)} />
            <button disabled={busy} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              Ajouter
            </button>
          </form>
          {props.chauffeurs.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {props.chauffeurs.map((c) => (
                <li key={c.id} className="flex items-center gap-2 rounded bg-slate-100 px-2 py-1 text-xs">
                  {nomComplet(c)}
                  <button onClick={() => props.onDelete(c.id)} className="text-slate-400 hover:text-red-600" title="Supprimer">✕</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="rounded-lg bg-white p-4 shadow">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Classement par consommation</h3>
          {props.stats.length > 0 && (
            <button onClick={() => exportStatsCsv('gasoil_chauffeurs', 'Chauffeur', props.stats)} className="text-sm text-blue-600 hover:underline">
              Exporter CSV
            </button>
          )}
        </div>
        {props.stats.length === 0 ? (
          <p className="text-slate-500">Aucune donnée sur la période.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-slate-500">
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Chauffeur</th>
                  <th className="py-2 pr-3">Sorties</th>
                  <th className="py-2 pr-3">Km</th>
                  <th className="py-2 pr-3">Litres</th>
                  <th className="py-2 pr-3">Conso moy.</th>
                  <th className="py-2 pr-3">Coût</th>
                  <th className="py-2 pr-3">Coût/km</th>
                  <th className="py-2 pr-3">Anomalies</th>
                </tr>
              </thead>
              <tbody>
                {props.stats.map((s, i) => (
                  <tr key={s.key} className={`border-b ${rowColor[s.worst]}`}>
                    <td className="py-2 pr-3 text-slate-400">{i + 1}</td>
                    <td className="py-2 pr-3 font-medium">{s.key}</td>
                    <td className="py-2 pr-3">{s.sorties}</td>
                    <td className="py-2 pr-3">{s.km.toLocaleString('fr-FR')}</td>
                    <td className="py-2 pr-3">{s.litres.toFixed(1)}</td>
                    <td className="py-2 pr-3 font-semibold">{s.conso != null ? `${s.conso.toFixed(1)} L/100` : '—'}</td>
                    <td className="py-2 pr-3">{dt(s.cost)}</td>
                    <td className="py-2 pr-3">{s.costPerKm != null ? `${s.costPerKm.toFixed(3)} DT` : '—'}</td>
                    <td className="py-2 pr-3">
                      {s.anomalies > 0 ? <span className="font-semibold text-red-600">{s.anomalies} ⚠️</span> : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-slate-400">
              Trié du plus gros consommateur au plus sobre. La colonne « Anomalies » compte les sorties en
              surconsommation ou incohérentes (carburant sans distance, saisie douteuse).
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function ExcursionsTab(props: {
  isAdmin: boolean
  excursions: GasoilExcursion[]
  comparaisons: ReturnType<typeof comparerExcursions>
  couts: ReturnType<typeof parExcursion>
  onAdd: (nom: string, kmRef: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [nom, setNom] = useState('')
  const [kmRef, setKmRef] = useState('')
  const [busy, setBusy] = useState(false)
  const inp = 'rounded border border-slate-300 px-2 py-1.5 text-sm'

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!nom) return
    setBusy(true)
    try {
      await props.onAdd(nom, kmRef)
      setNom(''); setKmRef('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      {props.isAdmin && (
        <div className="rounded-lg bg-white p-4 shadow">
          <h3 className="mb-3 font-semibold">Liste des excursions</h3>
          <form onSubmit={add} className="flex flex-wrap items-end gap-2">
            <input className={inp} placeholder="Nom de l'excursion *" value={nom} onChange={(e) => setNom(e.target.value)} />
            <input className={inp} type="number" placeholder="Km de référence" value={kmRef} onChange={(e) => setKmRef(e.target.value)} />
            <button disabled={busy} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              Ajouter
            </button>
          </form>
          {props.excursions.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {props.excursions.map((e) => (
                <li key={e.id} className="flex items-center gap-2 rounded bg-slate-100 px-2 py-1 text-xs">
                  {e.nom}{e.km_reference != null && <span className="text-slate-500">· {e.km_reference.toLocaleString('fr-FR')} km</span>}
                  <button onClick={() => props.onDelete(e.id)} className="text-slate-400 hover:text-red-600">✕</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="rounded-lg bg-white p-4 shadow">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Coût gasoil par excursion (rentabilité)</h3>
          {props.couts.length > 0 && (
            <button onClick={() => exportStatsCsv('gasoil_par_excursion', 'Excursion', props.couts)} className="text-sm text-blue-600 hover:underline">
              Exporter CSV
            </button>
          )}
        </div>
        {props.couts.length === 0 ? (
          <p className="text-slate-500">Associe des sorties à des excursions pour voir leur coût carburant.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-slate-500">
                  <th className="py-2 pr-3">Excursion</th>
                  <th className="py-2 pr-3">Sorties</th>
                  <th className="py-2 pr-3">Km moy.</th>
                  <th className="py-2 pr-3">Conso moy.</th>
                  <th className="py-2 pr-3">Coût gasoil moy./sortie</th>
                  <th className="py-2 pr-3">Coût/km</th>
                  <th className="py-2 pr-3">Total gasoil</th>
                </tr>
              </thead>
              <tbody>
                {props.couts.map((s) => (
                  <tr key={s.key} className="border-b">
                    <td className="py-2 pr-3 font-medium">{s.key}</td>
                    <td className="py-2 pr-3">{s.sorties}</td>
                    <td className="py-2 pr-3">{kmMoyenParSortie(s) != null ? `${Math.round(kmMoyenParSortie(s)!).toLocaleString('fr-FR')} km` : '—'}</td>
                    <td className="py-2 pr-3">{s.conso != null ? `${s.conso.toFixed(1)}` : '—'}</td>
                    <td className="py-2 pr-3 font-semibold">{dt(coutMoyenParSortie(s))}</td>
                    <td className="py-2 pr-3">{s.costPerKm != null ? `${s.costPerKm.toFixed(3)} DT` : '—'}</td>
                    <td className="py-2 pr-3">{dt(s.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-slate-400">
              Coût carburant réel constaté par excursion — à rapprocher du prix de vente pour affiner
              la marge. Se met à jour avec les filtres véhicule / période ci-dessus.
            </p>
          </div>
        )}
      </div>

      <div className="rounded-lg bg-white p-4 shadow">
        <h3 className="mb-3 font-semibold">Comparaison des km sur une même excursion</h3>
        {props.comparaisons.length === 0 ? (
          <p className="text-slate-500">
            Il faut au moins deux sorties sur la même excursion pour comparer.
          </p>
        ) : (
          <div className="space-y-4">
            {props.comparaisons.map((e) => (
              <div key={e.key} className={`rounded border p-3 ${e.anomalie ? 'border-red-200 bg-red-50' : 'border-slate-200'}`}>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{e.nom}</span>
                  <span className="text-xs text-slate-500">
                    {e.minKm.toLocaleString('fr-FR')}–{e.maxKm.toLocaleString('fr-FR')} km
                    {e.kmReference != null && ` · réf. ${e.kmReference.toLocaleString('fr-FR')} km`}
                  </span>
                  {e.anomalie && (
                    <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                      Écart +{e.ecartMaxPct.toFixed(0)}% ⚠️
                    </span>
                  )}
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-slate-500">
                      <th className="py-1 pr-3">Chauffeur</th>
                      <th className="py-1 pr-3">Véhicule</th>
                      <th className="py-1 pr-3">Date</th>
                      <th className="py-1 pr-3">Distance</th>
                      <th className="py-1 pr-3">Écart</th>
                      <th className="py-1 pr-3">Conso</th>
                      <th className="py-1 pr-3">Justification</th>
                    </tr>
                  </thead>
                  <tbody>
                    {e.rows.map((r) => (
                      <tr key={r.trip.id} className="border-b">
                        <td className="py-1 pr-3 font-medium">{r.chauffeur}</td>
                        <td className="py-1 pr-3">{r.matricule}</td>
                        <td className="py-1 pr-3 whitespace-nowrap">{new Date(r.trip.date).toLocaleDateString('fr-FR')}</td>
                        <td className="py-1 pr-3">{r.distance.toLocaleString('fr-FR')} km</td>
                        <td className="py-1 pr-3">
                          {r.ecartKmPct != null ? (
                            <span className={r.flag ? 'font-semibold text-red-600' : 'text-slate-500'}>
                              {r.ecartKmPct >= 0 ? '+' : ''}{r.ecartKmPct.toFixed(0)}%
                            </span>
                          ) : '—'}
                        </td>
                        <td className="py-1 pr-3">{r.conso != null ? `${r.conso.toFixed(1)}` : '—'}</td>
                        <td className="py-1 pr-3 text-slate-500">{r.justification ?? (r.flag ? '⚠️ non justifié' : '—')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function RapportTab(props: {
  periode: Periode
  setPeriode: (p: Periode) => void
  statsPeriode: ReturnType<typeof parPeriode>
  statsChauffeurs: ReturnType<typeof parChauffeur>
  statsVehicules: ReturnType<typeof parChauffeur>
  onPdf: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-white p-3 shadow">
        <span className="text-sm font-medium text-slate-600">Regroupement :</span>
        {(['semaine', 'mois'] as Periode[]).map((p) => (
          <button
            key={p}
            onClick={() => props.setPeriode(p)}
            className={`rounded px-3 py-1.5 text-sm ${props.periode === p ? 'bg-blue-100 font-medium text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {p === 'semaine' ? 'Par semaine' : 'Par mois'}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          <button onClick={() => exportStatsCsv(`gasoil_${props.periode}`, props.periode === 'mois' ? 'Mois' : 'Semaine', props.statsPeriode)} className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
            Export CSV
          </button>
          <button onClick={props.onPdf} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
            Rapport PDF
          </button>
        </div>
      </div>

      <StatsCard titre={props.periode === 'mois' ? 'Par mois' : 'Par semaine'} colonne={props.periode === 'mois' ? 'Mois' : 'Semaine'} stats={props.statsPeriode} />
      <StatsCard titre="Par véhicule" colonne="Véhicule" stats={props.statsVehicules} />
      <StatsCard titre="Par chauffeur" colonne="Chauffeur" stats={props.statsChauffeurs} />
    </div>
  )
}

function StatsCard({ titre, colonne, stats }: { titre: string; colonne: string; stats: ReturnType<typeof parChauffeur> }) {
  return (
    <div className="rounded-lg bg-white p-4 shadow">
      <h3 className="mb-3 font-semibold">{titre}</h3>
      {stats.length === 0 ? (
        <p className="text-slate-500">Aucune donnée.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-slate-500">
                <th className="py-2 pr-3">{colonne}</th>
                <th className="py-2 pr-3">Sorties</th>
                <th className="py-2 pr-3">Km</th>
                <th className="py-2 pr-3">Litres</th>
                <th className="py-2 pr-3">Conso</th>
                <th className="py-2 pr-3">Coût</th>
                <th className="py-2 pr-3">Coût/km</th>
                <th className="py-2 pr-3">Anomalies</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.key} className={`border-b ${rowColor[s.worst]}`}>
                  <td className="py-2 pr-3 font-medium">{s.key}</td>
                  <td className="py-2 pr-3">{s.sorties}</td>
                  <td className="py-2 pr-3">{s.km.toLocaleString('fr-FR')}</td>
                  <td className="py-2 pr-3">{s.litres.toFixed(1)}</td>
                  <td className="py-2 pr-3 font-semibold">{s.conso != null ? `${s.conso.toFixed(1)}` : '—'}</td>
                  <td className="py-2 pr-3">{dt(s.cost)}</td>
                  <td className="py-2 pr-3">{s.costPerKm != null ? `${s.costPerKm.toFixed(3)}` : '—'}</td>
                  <td className="py-2 pr-3">{s.anomalies > 0 ? <span className="font-semibold text-red-600">{s.anomalies}</span> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ---- helpers ----
function periodeLabel(du: string, au: string): string {
  if (du && au) return `Du ${new Date(du).toLocaleDateString('fr-FR')} au ${new Date(au).toLocaleDateString('fr-FR')}`
  if (du) return `Depuis le ${new Date(du).toLocaleDateString('fr-FR')}`
  if (au) return `Jusqu'au ${new Date(au).toLocaleDateString('fr-FR')}`
  return 'Toutes périodes'
}
