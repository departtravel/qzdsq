import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { calculerRentabilite, type CostLine } from '../../lib/erp'
import { OrdreMission } from './OrdreMission'
import { FicheReservation } from './FicheReservation'

// ============================================================
//  PLANNING MENSUEL — vision cliente
//  1) En-tête : année + 12 mois -> feuille du mois
//  2) Grille jour par jour, réservations groupées/colorées par
//     excursion, glisser-déposer pour réordonner (bookings.ordre)
//  3) Création de départ à partir de réservations non affectées
//  4) Cartes des départs du mois : multi-guides, multi-transports,
//     frais partagés, coût/marge, statut, impression, dissociation
// ============================================================

// ----- Types locaux -----
interface BookingRow {
  id: string
  date_excursion: string | null
  excursion_id: string | null
  departure_id: string | null
  nombre_adultes: number
  nombre_enfants: number
  nombre_bebes: number
  statut: string
  client_nom: string | null
  ordre: number
}

interface ExcursionRow {
  id: string
  code_interne: string | null
  nom: string
  prix_adulte: number
  prix_enfant: number
  prix_bebe: number
  commission_ota: number
  taux_conversion: number
  duree: string | null
  nombre_jours: number
}

interface DepartureRow {
  id: string
  date: string
  excursion_id: string | null
  gasoil: number | null
  parking: number | null
  peage: number | null
  statut: string
}

interface DepGuide {
  id: string
  departure_id: string
  guide_id: string
}
interface DepTransport {
  id: string
  departure_id: string
  transport_id: string | null
  vehicle_id: string | null
  chauffeur_id: string | null
  cout: number | null
  mode: string | null
}

interface GuideRef {
  id: string
  nom: string
  prenom: string | null
  type_guide: string | null
}
interface ChauffeurRef {
  id: string
  nom: string
  prenom: string | null
  type_chauffeur: string | null
  tarif_jour: number | null
}
interface VehicleRef {
  id: string
  immatriculation: string | null
  type: string | null
  capacite: number | null
}
interface TransportRef {
  id: string
  nom: string
  type_transport: string | null
}

type PrintState = { type: 'ORDRE' | 'FICHE'; excursionId: string | null; date: string } | null

const MOIS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

const MODE_LABEL: Record<string, string> = {
  PARC: 'Parc roulant',
  LONGUE_DUREE: 'Loc. longue durée',
  JOURNALIERE: 'Loc. journalière',
}

// Palette pastel : chaque excursion garde toujours la même couleur.
const PALETTE = [
  'bg-blue-50', 'bg-green-50', 'bg-amber-50', 'bg-purple-50',
  'bg-pink-50', 'bg-teal-50', 'bg-orange-50', 'bg-cyan-50',
]
function excColor(id: string | null): string {
  if (!id) return 'bg-white'
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}
function firstDayISO(year: number, month0: number): string {
  return `${year}-${pad2(month0 + 1)}-01`
}
function lastDayISO(year: number, month0: number): string {
  const d = new Date(year, month0 + 1, 0).getDate()
  return `${year}-${pad2(month0 + 1)}-${pad2(d)}`
}
function dayISO(year: number, month0: number, day: number): string {
  return `${year}-${pad2(month0 + 1)}-${pad2(day)}`
}
function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate()
}
function paxOf(b: BookingRow): number {
  return b.nombre_adultes + b.nombre_enfants + b.nombre_bebes
}
function fmtDateLong(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })
}
function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  })
}

export function Planning(_props: { today?: string } = {}) {
  const now = new Date()
  const [year, setYear] = useState<number>(now.getFullYear())
  const [month, setMonth] = useState<number>(now.getMonth())

  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [departures, setDepartures] = useState<DepartureRow[]>([])
  const [depGuides, setDepGuides] = useState<DepGuide[]>([])
  const [depTransports, setDepTransports] = useState<DepTransport[]>([])
  const [excursions, setExcursions] = useState<ExcursionRow[]>([])
  const [costLines, setCostLines] = useState<Map<string, CostLine[]>>(new Map())
  const [guidePrix, setGuidePrix] = useState<Map<string, { demi: number; jour: number; deux: number }>>(new Map())
  const [transportTarif, setTransportTarif] = useState<Map<string, number>>(new Map())
  const [guides, setGuides] = useState<GuideRef[]>([])
  const [chauffeurs, setChauffeurs] = useState<ChauffeurRef[]>([])
  const [vehicles, setVehicles] = useState<VehicleRef[]>([])
  const [transports, setTransports] = useState<TransportRef[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [selectError, setSelectError] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [print, setPrint] = useState<PrintState>(null)

  const from = useMemo(() => firstDayISO(year, month), [year, month])
  const to = useMemo(() => lastDayISO(year, month), [year, month])

  const promouvoirReservations = useCallback(async (depId: string) => {
    const { error: promoErr } = await supabase
      .from('bookings')
      .update({ statut: 'EN_OPERATION' })
      .eq('departure_id', depId)
      .neq('statut', 'ANNULEE')
    if (promoErr) setError(promoErr.message)
  }, [])

  const loadReferentiels = useCallback(async () => {
    const [ex, cl, gu, ch, ve, tr, gp] = await Promise.all([
      supabase
        .from('excursions')
        .select(
          'id,code_interne,nom,prix_adulte,prix_enfant,prix_bebe,commission_ota,taux_conversion,duree,nombre_jours',
        )
        .order('code_interne'),
      supabase.from('excursion_cost_lines').select('*'),
      supabase.from('guides').select('id,nom,prenom,type_guide').order('nom'),
      supabase.from('chauffeurs').select('id,nom,prenom,type_chauffeur,tarif_jour').order('nom'),
      supabase.from('erp_vehicles').select('id,immatriculation,type,capacite').order('immatriculation'),
      supabase.from('transports').select('id,nom,type_transport,tarif_sortie').order('nom'),
      supabase
        .from('guide_prices')
        .select('guide_id,demi_journee,journee,deux_jours,date_application')
        .order('date_application', { ascending: false }),
    ])
    const firstErr = ex.error || cl.error || gu.error || ch.error || ve.error || tr.error || gp.error
    if (firstErr) setError(firstErr.message)
    setExcursions((ex.data as ExcursionRow[]) ?? [])
    const gpMap = new Map<string, { demi: number; jour: number; deux: number }>()
    for (const p of (gp.data as { guide_id: string | null; demi_journee: number; journee: number; deux_jours: number }[]) ?? []) {
      const key = p.guide_id ?? 'DEFAUT'
      if (!gpMap.has(key)) gpMap.set(key, { demi: p.demi_journee, jour: p.journee, deux: p.deux_jours })
    }
    setGuidePrix(gpMap)
    const trMap = new Map<string, number>()
    for (const t of (tr.data as { id: string; tarif_sortie: number | null }[]) ?? [])
      trMap.set(t.id, t.tarif_sortie ?? 0)
    setTransportTarif(trMap)
    const clMap = new Map<string, CostLine[]>()
    for (const line of (cl.data as CostLine[]) ?? []) {
      const arr = clMap.get(line.excursion_id) ?? []
      arr.push(line)
      clMap.set(line.excursion_id, arr)
    }
    setCostLines(clMap)
    setGuides((gu.data as GuideRef[]) ?? [])
    setChauffeurs((ch.data as ChauffeurRef[]) ?? [])
    setVehicles((ve.data as VehicleRef[]) ?? [])
    setTransports((tr.data as TransportRef[]) ?? [])
  }, [])

  const loadMonth = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSelected(new Set())
    const [bk, dep] = await Promise.all([
      supabase
        .from('bookings')
        .select(
          'id,date_excursion,excursion_id,departure_id,nombre_adultes,nombre_enfants,nombre_bebes,statut,client_nom,ordre',
        )
        .gte('date_excursion', from)
        .lte('date_excursion', to)
        .order('ordre'),
      supabase
        .from('departures')
        .select('id,date,excursion_id,gasoil,parking,peage,statut')
        .gte('date', from)
        .lte('date', to)
        .order('date'),
    ])
    if (bk.error) setError(bk.error.message)
    else if (dep.error) setError(dep.error.message)
    const deps = (dep.data as DepartureRow[]) ?? []
    setBookings((bk.data as BookingRow[]) ?? [])
    setDepartures(deps)

    const depIds = deps.map((d) => d.id)
    if (depIds.length > 0) {
      const [dg, dt] = await Promise.all([
        supabase.from('departure_guides').select('id,departure_id,guide_id').in('departure_id', depIds),
        supabase
          .from('departure_transports')
          .select('id,departure_id,transport_id,vehicle_id,chauffeur_id,cout,mode')
          .in('departure_id', depIds),
      ])
      if (dg.error) setError(dg.error.message)
      if (dt.error) setError(dt.error.message)
      setDepGuides((dg.data as DepGuide[]) ?? [])
      setDepTransports((dt.data as DepTransport[]) ?? [])
    } else {
      setDepGuides([])
      setDepTransports([])
    }
    setLoading(false)
  }, [from, to])

  useEffect(() => {
    loadReferentiels()
  }, [loadReferentiels])
  useEffect(() => {
    loadMonth()
  }, [loadMonth])

  const excById = useCallback(
    (id: string | null) => excursions.find((e) => e.id === id) ?? null,
    [excursions],
  )
  const excNom = useCallback(
    (id: string | null) => {
      const e = excById(id)
      return e ? `${e.code_interne ? e.code_interne + ' · ' : ''}${e.nom}` : '—'
    },
    [excById],
  )

  const guideLabel = (g: GuideRef) => `${g.nom}${g.prenom ? ' ' + g.prenom : ''}`
  const chauffeurLabel = (c: ChauffeurRef) => `${c.nom}${c.prenom ? ' ' + c.prenom : ''}`
  const vehicleLabel = (v: VehicleRef) =>
    `${v.immatriculation ?? 'Sans immat.'}${v.type ? ' (' + v.type + ')' : ''}`
  const transportLabel = (t: TransportRef) =>
    `${t.nom}${t.type_transport ? ' (' + t.type_transport + ')' : ''}`

  // ----- Regroupement des réservations par jour (triées ordre puis excursion) -----
  const bookingsByDay = useMemo(() => {
    const m = new Map<string, BookingRow[]>()
    for (const b of bookings) {
      if (!b.date_excursion) continue
      const arr = m.get(b.date_excursion) ?? []
      arr.push(b)
      m.set(b.date_excursion, arr)
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => {
        if (a.ordre !== b.ordre) return a.ordre - b.ordre
        const e = (a.excursion_id ?? '').localeCompare(b.excursion_id ?? '')
        if (e !== 0) return e
        return a.id.localeCompare(b.id)
      })
    }
    return m
  }, [bookings])

  const bookingsByDeparture = useMemo(() => {
    const m = new Map<string, BookingRow[]>()
    for (const b of bookings) {
      if (!b.departure_id) continue
      const arr = m.get(b.departure_id) ?? []
      arr.push(b)
      m.set(b.departure_id, arr)
    }
    return m
  }, [bookings])

  const guidesByDep = useMemo(() => {
    const m = new Map<string, DepGuide[]>()
    for (const g of depGuides) {
      const arr = m.get(g.departure_id) ?? []
      arr.push(g)
      m.set(g.departure_id, arr)
    }
    return m
  }, [depGuides])

  const transportsByDep = useMemo(() => {
    const m = new Map<string, DepTransport[]>()
    for (const t of depTransports) {
      const arr = m.get(t.departure_id) ?? []
      arr.push(t)
      m.set(t.departure_id, arr)
    }
    return m
  }, [depTransports])

  const days = useMemo(() => {
    const n = daysInMonth(year, month)
    const out: { iso: string; rows: BookingRow[] }[] = []
    for (let d = 1; d <= n; d++) {
      const iso = dayISO(year, month, d)
      const rows = bookingsByDay.get(iso)
      if (rows && rows.length > 0) out.push({ iso, rows })
    }
    return out
  }, [year, month, bookingsByDay])

  // ----- Sélection (uniquement réservations non affectées) -----
  const toggle = useCallback((id: string) => {
    setSelectError(null)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectedRows = useMemo(
    () => bookings.filter((b) => selected.has(b.id) && !b.departure_id),
    [bookings, selected],
  )

  const creerDepart = useCallback(async () => {
    setSelectError(null)
    const rows = selectedRows
    if (rows.length === 0) return
    const firstExc = rows[0].excursion_id
    const firstDate = rows[0].date_excursion
    const homogene = rows.every(
      (r) => r.excursion_id === firstExc && r.date_excursion === firstDate,
    )
    if (!homogene || !firstExc || !firstDate) {
      setSelectError('Sélectionne des réservations non affectées du même produit et de la même date.')
      return
    }
    setBusy(true)
    const { data, error: insErr } = await supabase
      .from('departures')
      .insert({ date: firstDate, excursion_id: firstExc, statut: 'PLANIFIEE' })
      .select()
      .single()
    if (insErr || !data) {
      setError(insErr?.message ?? 'Erreur création du départ.')
      setBusy(false)
      return
    }
    const depId = (data as DepartureRow).id
    const { error: updErr } = await supabase
      .from('bookings')
      .update({ departure_id: depId })
      .in('id', rows.map((r) => r.id))
    if (updErr) setError(updErr.message)
    setBusy(false)
    await loadMonth()
  }, [selectedRows, loadMonth])

  // ----- Ordre (glisser-déposer + monter/descendre) -----
  const persistOrder = useCallback(async (ordered: BookingRow[]) => {
    setBusy(true)
    const results = await Promise.all(
      ordered.map((b, i) => supabase.from('bookings').update({ ordre: i }).eq('id', b.id)),
    )
    const err = results.find((r) => r.error)
    if (err?.error) setError(err.error.message)
    setBusy(false)
    await loadMonth()
  }, [loadMonth])

  const reorderWithin = useCallback(
    (iso: string, draggedId: string, targetId: string) => {
      if (draggedId === targetId) return
      const arr = [...(bookingsByDay.get(iso) ?? [])]
      const fromIdx = arr.findIndex((b) => b.id === draggedId)
      const toIdx = arr.findIndex((b) => b.id === targetId)
      if (fromIdx < 0 || toIdx < 0) return
      const [moved] = arr.splice(fromIdx, 1)
      arr.splice(toIdx, 0, moved)
      persistOrder(arr)
    },
    [bookingsByDay, persistOrder],
  )

  const moveBy = useCallback(
    (iso: string, id: string, delta: number) => {
      const arr = [...(bookingsByDay.get(iso) ?? [])]
      const i = arr.findIndex((b) => b.id === id)
      const j = i + delta
      if (i < 0 || j < 0 || j >= arr.length) return
      const tmp = arr[i]
      arr[i] = arr[j]
      arr[j] = tmp
      persistOrder(arr)
    },
    [bookingsByDay, persistOrder],
  )

  const supprimerReservation = useCallback(
    async (id: string) => {
      const { error: delErr } = await supabase.from('bookings').delete().eq('id', id)
      if (delErr) setError(delErr.message)
      await loadMonth()
    },
    [loadMonth],
  )

  // ----- Départs : frais partagés, statut, dissociation -----
  const majFrais = useCallback(
    async (depId: string, field: 'gasoil' | 'parking' | 'peage', value: number) => {
      setDepartures((prev) => prev.map((d) => (d.id === depId ? { ...d, [field]: value } : d)))
      const { error: updErr } = await supabase
        .from('departures')
        .update({ [field]: value })
        .eq('id', depId)
      if (updErr) setError(updErr.message)
    },
    [],
  )

  const majStatut = useCallback(
    async (depId: string, statut: string) => {
      setDepartures((prev) => prev.map((d) => (d.id === depId ? { ...d, statut } : d)))
      const { error: e } = await supabase.from('departures').update({ statut }).eq('id', depId)
      if (e) setError(e.message)
      if (statut === 'CONFIRMEE') await promouvoirReservations(depId)
      await loadMonth()
    },
    [loadMonth, promouvoirReservations],
  )

  const dissocier = useCallback(
    async (bookingId: string) => {
      const { error: updErr } = await supabase
        .from('bookings')
        .update({ departure_id: null })
        .eq('id', bookingId)
      if (updErr) setError(updErr.message)
      await loadMonth()
    },
    [loadMonth],
  )

  const ajouterGuide = useCallback(
    async (depId: string, guideId: string) => {
      if (!guideId) return
      const { error: e } = await supabase
        .from('departure_guides')
        .insert({ departure_id: depId, guide_id: guideId })
      if (e) setError(e.message)
      await loadMonth()
    },
    [loadMonth],
  )
  const retirerGuide = useCallback(
    async (id: string) => {
      const { error: e } = await supabase.from('departure_guides').delete().eq('id', id)
      if (e) setError(e.message)
      await loadMonth()
    },
    [loadMonth],
  )

  const ajouterTransport = useCallback(
    async (depId: string, payload: Omit<DepTransport, 'id' | 'departure_id'>) => {
      const { error: e } = await supabase
        .from('departure_transports')
        .insert({ departure_id: depId, ...payload })
      if (e) setError(e.message)
      await loadMonth()
    },
    [loadMonth],
  )
  const retirerTransport = useCallback(
    async (id: string) => {
      const { error: e } = await supabase.from('departure_transports').delete().eq('id', id)
      if (e) setError(e.message)
      await loadMonth()
    },
    [loadMonth],
  )

  if (error)
    return (
      <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error} — as-tu exécuté <code>supabase/planning_refonte.sql</code> ?
      </div>
    )

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Planning mensuel &amp; départs</h2>
        <p className="text-sm text-slate-500">
          Feuille du mois — réservations jour par jour et départs
        </p>
      </div>

      {/* En-tête : année + mois */}
      <div className="mb-4 rounded-lg bg-white p-4 shadow">
        <div className="mb-3 flex items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-slate-500">Année</span>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value) || now.getFullYear())}
              className="w-28 rounded border border-slate-300 px-2 py-1"
            />
          </label>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-12">
          {MOIS.map((m, i) => (
            <button
              key={m}
              onClick={() => setMonth(i)}
              className={`rounded border px-2 py-1.5 text-sm transition ${
                i === month
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              {m.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="px-1 py-2 text-sm text-slate-500">Chargement…</p>}

      {/* Barre de création de départ */}
      {selectedRows.length > 0 && (
        <div className="sticky top-2 z-10 mb-4 flex flex-wrap items-center gap-3 rounded border border-blue-200 bg-blue-50 px-3 py-2 shadow">
          <span className="text-sm text-blue-700">{selectedRows.length} réservation(s) sélectionnée(s)</span>
          <button
            onClick={creerDepart}
            disabled={busy}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            ➕ Créer un départ
          </button>
          <button
            onClick={() => { setSelected(new Set()); setSelectError(null) }}
            className="rounded border border-slate-300 px-2 py-1 text-sm hover:bg-white"
          >
            Annuler
          </button>
          {selectError && <span className="text-sm text-red-600">{selectError}</span>}
        </div>
      )}

      {/* Grille jour par jour */}
      <div className="mb-4 rounded-lg bg-white p-4 shadow">
        <h3 className="mb-3 font-semibold">
          Réservations du mois{' '}
          <span className="text-sm font-normal text-slate-400">
            ({MOIS[month]} {year})
          </span>
        </h3>
        {!loading && days.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune réservation ce mois-ci.</p>
        ) : (
          <div className="space-y-5">
            {days.map(({ iso, rows }) => (
              <div key={iso}>
                <div className="mb-1.5 border-b border-slate-200 pb-1 text-sm font-semibold capitalize text-slate-700">
                  {fmtDateLong(iso)}
                </div>
                <div className="space-y-1">
                  {rows.map((b, idx) => {
                    const affectee = !!b.departure_id
                    return (
                      <div
                        key={b.id}
                        draggable
                        onDragStart={() => setDragId(b.id)}
                        onDragEnd={() => setDragId(null)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault()
                          if (dragId) reorderWithin(iso, dragId, b.id)
                          setDragId(null)
                        }}
                        className={`flex flex-wrap items-center gap-2 rounded border border-slate-200 px-2 py-1.5 text-sm ${excColor(
                          b.excursion_id,
                        )} ${dragId === b.id ? 'opacity-50' : ''}`}
                      >
                        <span className="cursor-grab select-none text-slate-400" title="Glisser pour réordonner">
                          ⠿
                        </span>
                        <input
                          type="checkbox"
                          checked={selected.has(b.id)}
                          disabled={affectee}
                          onChange={() => toggle(b.id)}
                          title={affectee ? 'Déjà affectée à un départ' : 'Sélectionner'}
                        />
                        <span className="font-medium">{b.client_nom ?? '—'}</span>
                        <span className="text-slate-500">· {excNom(b.excursion_id)}</span>
                        <span className="text-slate-500">
                          · {b.nombre_adultes}A/{b.nombre_enfants}E/{b.nombre_bebes}B ({paxOf(b)} pax)
                        </span>
                        <span className="rounded bg-white/70 px-1.5 py-0.5 text-xs text-slate-600">
                          {b.statut}
                        </span>
                        {affectee && (
                          <span className="rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-600">
                            départ
                          </span>
                        )}
                        <span className="ml-auto flex items-center gap-1">
                          <button
                            onClick={() => moveBy(iso, b.id, -1)}
                            disabled={idx === 0 || busy}
                            className="rounded border border-slate-300 bg-white px-1.5 text-xs hover:bg-slate-50 disabled:opacity-30"
                            title="Monter"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => moveBy(iso, b.id, 1)}
                            disabled={idx === rows.length - 1 || busy}
                            className="rounded border border-slate-300 bg-white px-1.5 text-xs hover:bg-slate-50 disabled:opacity-30"
                            title="Descendre"
                          >
                            ↓
                          </button>
                          <button
                            onClick={() => supprimerReservation(b.id)}
                            className="rounded border border-red-300 bg-white px-1.5 text-xs text-red-600 hover:bg-red-50"
                            title="Supprimer la réservation"
                          >
                            ✕
                          </button>
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Départs du mois */}
      <div className="rounded-lg bg-white p-4 shadow">
        <h3 className="mb-3 font-semibold">
          Départs du mois{' '}
          <span className="text-sm font-normal text-slate-400">({departures.length})</span>
        </h3>

        {!loading && departures.length === 0 ? (
          <p className="text-sm text-slate-500">
            Aucun départ ce mois-ci. Sélectionne des réservations ci-dessus pour en créer un.
          </p>
        ) : (
          <div className="space-y-4">
            {departures.map((dep) => {
              const rows = bookingsByDeparture.get(dep.id) ?? []
              const adultes = rows.reduce((s, r) => s + r.nombre_adultes, 0)
              const enfants = rows.reduce((s, r) => s + r.nombre_enfants, 0)
              const bebes = rows.reduce((s, r) => s + r.nombre_bebes, 0)
              const paxTotal = adultes + enfants + bebes
              const exc = excById(dep.excursion_id)
              const jours = exc?.nombre_jours ?? 1
              const depG = guidesByDep.get(dep.id) ?? []
              const depT = transportsByDep.get(dep.id) ?? []

              // Capacité cumulée des véhicules du départ (pour les lignes PAR_VEHICULE).
              const capacite = Math.max(
                1,
                depT.reduce((s, t) => s + (vehicles.find((v) => v.id === t.vehicle_id)?.capacite ?? 0), 0),
              )

              // Frais partagés (au niveau du départ).
              let guideAmt = 0
              for (const dg of depG) {
                const g = guides.find((x) => x.id === dg.guide_id)
                if (g && g.type_guide === 'EXTRA') {
                  const b = guidePrix.get(dg.guide_id) ?? guidePrix.get('DEFAUT')
                  if (b)
                    guideAmt += jours >= 2 ? b.deux : (exc?.duree ?? '').toLowerCase().startsWith('demi') ? b.demi : b.jour
                }
              }
              let transportAmt = 0
              let chaufAmt = 0
              for (const t of depT) {
                transportAmt += t.cout ?? (t.transport_id ? transportTarif.get(t.transport_id) ?? 0 : 0)
                const c = chauffeurs.find((x) => x.id === t.chauffeur_id)
                if (c && c.type_chauffeur === 'EXTRA') chaufAmt += (c.tarif_jour ?? 0) * jours
              }
              const fraisPartages =
                guideAmt + chaufAmt + transportAmt + (dep.gasoil ?? 0) + (dep.parking ?? 0) + (dep.peage ?? 0)

              let rentab: ReturnType<typeof calculerRentabilite> | null = null
              if (exc) {
                const lignesPax = (costLines.get(exc.id) ?? []).filter(
                  (l) => !['GUIDE', 'CHAUFFEUR', 'TRANSPORT', 'GASOIL', 'PEAGE', 'PARKING'].includes(l.categorie),
                )
                rentab = calculerRentabilite({
                  excursion: {
                    prix_adulte: exc.prix_adulte,
                    prix_enfant: exc.prix_enfant,
                    prix_bebe: exc.prix_bebe,
                    commission_ota: exc.commission_ota,
                    taux_conversion: exc.taux_conversion,
                  },
                  lignes: lignesPax,
                  adultes,
                  enfants,
                  bebes,
                  capaciteVehicule: capacite,
                })
              }
              const coutReel = rentab ? rentab.coutTotalTnd + fraisPartages : fraisPartages
              const margeReelle = rentab ? rentab.caNetTnd - coutReel : -coutReel
              const coutParPers = paxTotal > 0 ? coutReel / paxTotal : 0

              return (
                <div key={dep.id} className="rounded-lg border border-slate-200 p-3">
                  {/* En-tête de la carte */}
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-medium">{fmtDate(dep.date)}</span>{' '}
                      <span className="text-slate-500">· {excNom(dep.excursion_id)}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {dep.statut}
                      </span>
                      {dep.statut === 'PLANIFIEE' && (
                        <button
                          onClick={() => majStatut(dep.id, 'CONFIRMEE')}
                          className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700"
                        >
                          ✓ Confirmer la sortie
                        </button>
                      )}
                      {dep.statut === 'CONFIRMEE' && (
                        <button
                          onClick={() => majStatut(dep.id, 'TERMINEE')}
                          className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                        >
                          Terminer
                        </button>
                      )}
                      {dep.statut !== 'ANNULEE' && dep.statut !== 'TERMINEE' && (
                        <button
                          onClick={() => majStatut(dep.id, 'ANNULEE')}
                          className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                        >
                          Annuler
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Impressions */}
                  <div className="mb-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => setPrint({ type: 'ORDRE', excursionId: dep.excursion_id, date: dep.date })}
                      className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                    >
                      🖨️ Ordre de mission
                    </button>
                    <button
                      onClick={() => setPrint({ type: 'FICHE', excursionId: dep.excursion_id, date: dep.date })}
                      className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                    >
                      🖨️ Réservations à effectuer
                    </button>
                  </div>

                  {/* Réservations du départ */}
                  <div className="mb-3 overflow-x-auto">
                    <table className="w-full text-sm">
                      <tbody>
                        {rows.length === 0 ? (
                          <tr>
                            <td className="px-2 py-1 text-slate-400">Aucune réservation</td>
                          </tr>
                        ) : (
                          rows.map((r) => (
                            <tr key={r.id} className="border-b last:border-0">
                              <td className="px-2 py-1">{r.client_nom ?? '—'}</td>
                              <td className="px-2 py-1 text-right text-slate-500">
                                {r.nombre_adultes}A/{r.nombre_enfants}E/{r.nombre_bebes}B
                              </td>
                              <td className="px-2 py-1 text-right text-slate-500">{paxOf(r)} pax</td>
                              <td className="px-2 py-1 text-right">
                                <button
                                  onClick={() => dissocier(r.id)}
                                  className="text-xs text-red-600 hover:underline"
                                >
                                  Dissocier
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Coût / marge */}
                  <div className="mb-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                    <div className="rounded bg-slate-50 px-2 py-1">
                      <span className="text-slate-500">Pax total</span>
                      <div className="font-semibold">{paxTotal}</div>
                    </div>
                    <div className="rounded bg-slate-50 px-2 py-1">
                      <span className="text-slate-500">Coût total</span>
                      <div className="font-semibold">{coutReel.toFixed(0)} TND</div>
                      <div className="text-xs text-slate-400">{coutParPers.toFixed(1)}/pers</div>
                    </div>
                    <div className="rounded bg-slate-50 px-2 py-1">
                      <span className="text-slate-500">Marge</span>
                      <div className={`font-semibold ${margeReelle >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {margeReelle.toFixed(0)} TND
                      </div>
                    </div>
                    <div className="rounded bg-slate-50 px-2 py-1">
                      <span className="text-slate-500">dont frais partagés</span>
                      <div className="font-semibold">{fraisPartages.toFixed(0)} TND</div>
                      <div className="text-xs text-slate-400">guides+transports+route</div>
                    </div>
                  </div>

                  {/* Multi-guides */}
                  <div className="mb-3 rounded border border-slate-100 p-2">
                    <div className="mb-1 text-xs font-semibold text-slate-500">Guides</div>
                    <div className="mb-2 flex flex-wrap gap-2">
                      {depG.length === 0 && <span className="text-xs text-slate-400">Aucun guide</span>}
                      {depG.map((dg) => {
                        const g = guides.find((x) => x.id === dg.guide_id)
                        return (
                          <span
                            key={dg.id}
                            className="flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs"
                          >
                            {g ? guideLabel(g) : '—'}
                            {g?.type_guide === 'EXTRA' && (
                              <span className="text-slate-400">(extra)</span>
                            )}
                            <button
                              onClick={() => retirerGuide(dg.id)}
                              className="text-red-500 hover:text-red-700"
                              title="Retirer"
                            >
                              ✕
                            </button>
                          </span>
                        )
                      })}
                    </div>
                    <select
                      value=""
                      onChange={(e) => e.target.value && ajouterGuide(dep.id, e.target.value)}
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-sm"
                    >
                      <option value="">+ Ajouter un guide…</option>
                      {guides
                        .filter((g) => !depG.some((dg) => dg.guide_id === g.id))
                        .map((g) => (
                          <option key={g.id} value={g.id}>
                            {guideLabel(g)}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Multi-transports */}
                  <div className="mb-3 rounded border border-slate-100 p-2">
                    <div className="mb-1 text-xs font-semibold text-slate-500">Transports</div>
                    <div className="mb-2 space-y-1">
                      {depT.length === 0 && <span className="text-xs text-slate-400">Aucun transport</span>}
                      {depT.map((t) => {
                        const tr = transports.find((x) => x.id === t.transport_id)
                        const veh = vehicles.find((x) => x.id === t.vehicle_id)
                        const ch = chauffeurs.find((x) => x.id === t.chauffeur_id)
                        const cout = t.cout ?? (t.transport_id ? transportTarif.get(t.transport_id) ?? 0 : 0)
                        return (
                          <div
                            key={t.id}
                            className="flex flex-wrap items-center gap-2 rounded bg-slate-50 px-2 py-1 text-xs"
                          >
                            <span className="font-medium">{tr ? transportLabel(tr) : 'Transport'}</span>
                            {veh && <span className="text-slate-500">· {vehicleLabel(veh)}</span>}
                            {ch && <span className="text-slate-500">· {chauffeurLabel(ch)}</span>}
                            {t.mode && (
                              <span className="rounded bg-white px-1.5 py-0.5 text-slate-600">
                                {MODE_LABEL[t.mode] ?? t.mode}
                              </span>
                            )}
                            <span className="text-slate-600">{cout.toFixed(0)} DT</span>
                            <button
                              onClick={() => retirerTransport(t.id)}
                              className="ml-auto text-red-500 hover:text-red-700"
                              title="Retirer"
                            >
                              ✕
                            </button>
                          </div>
                        )
                      })}
                    </div>
                    <AddTransportForm
                      transports={transports}
                      vehicles={vehicles}
                      chauffeurs={chauffeurs}
                      transportLabel={transportLabel}
                      vehicleLabel={vehicleLabel}
                      chauffeurLabel={chauffeurLabel}
                      onAdd={(payload) => ajouterTransport(dep.id, payload)}
                    />
                  </div>

                  {/* Frais partagés route */}
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <FraisInput label="Gasoil (DT)" value={dep.gasoil} onSave={(v) => majFrais(dep.id, 'gasoil', v)} />
                    <FraisInput label="Parking (DT)" value={dep.parking} onSave={(v) => majFrais(dep.id, 'parking', v)} />
                    <FraisInput label="Autoroute (DT)" value={dep.peage} onSave={(v) => majFrais(dep.id, 'peage', v)} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Overlay d'impression */}
      {print && (
        <div className="fixed inset-0 z-50 overflow-auto bg-white">
          <div className="sticky top-0 flex items-center justify-end gap-2 border-b border-slate-200 bg-white px-4 py-2 print:hidden">
            <button
              onClick={() => window.print()}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              🖨️ Imprimer
            </button>
            <button
              onClick={() => setPrint(null)}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              Fermer
            </button>
          </div>
          <div className="p-4">
            {print.type === 'ORDRE' ? (
              <OrdreMission initialExcursionId={print.excursionId ?? undefined} initialDate={print.date} />
            ) : (
              <FicheReservation initialExcursionId={print.excursionId ?? undefined} initialDate={print.date} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function FraisInput({
  label, value, onSave,
}: { label: string; value: number | null; onSave: (v: number) => void }) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-slate-500">{label}</span>
      <input
        type="number"
        min={0}
        defaultValue={value ?? ''}
        onBlur={(e) => onSave(e.target.value === '' ? 0 : Number(e.target.value))}
        className="w-full rounded border border-slate-300 px-2 py-1"
      />
    </label>
  )
}

function AddTransportForm({
  transports,
  vehicles,
  chauffeurs,
  transportLabel,
  vehicleLabel,
  chauffeurLabel,
  onAdd,
}: {
  transports: TransportRef[]
  vehicles: VehicleRef[]
  chauffeurs: ChauffeurRef[]
  transportLabel: (t: TransportRef) => string
  vehicleLabel: (v: VehicleRef) => string
  chauffeurLabel: (c: ChauffeurRef) => string
  onAdd: (payload: Omit<DepTransport, 'id' | 'departure_id'>) => void
}) {
  const [transportId, setTransportId] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [chauffeurId, setChauffeurId] = useState('')
  const [cout, setCout] = useState('')
  const [mode, setMode] = useState('')

  const submit = () => {
    if (!transportId && !vehicleId && !chauffeurId) return
    onAdd({
      transport_id: transportId || null,
      vehicle_id: vehicleId || null,
      chauffeur_id: chauffeurId || null,
      cout: cout === '' ? null : Number(cout),
      mode: mode || null,
    })
    setTransportId('')
    setVehicleId('')
    setChauffeurId('')
    setCout('')
    setMode('')
  }

  return (
    <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-2 text-sm sm:grid-cols-6">
      <select
        value={transportId}
        onChange={(e) => setTransportId(e.target.value)}
        className="rounded border border-slate-300 bg-white px-2 py-1"
      >
        <option value="">Transport…</option>
        {transports.map((t) => (
          <option key={t.id} value={t.id}>
            {transportLabel(t)}
          </option>
        ))}
      </select>
      <select
        value={vehicleId}
        onChange={(e) => setVehicleId(e.target.value)}
        className="rounded border border-slate-300 bg-white px-2 py-1"
      >
        <option value="">Véhicule…</option>
        {vehicles.map((v) => (
          <option key={v.id} value={v.id}>
            {vehicleLabel(v)}
          </option>
        ))}
      </select>
      <select
        value={chauffeurId}
        onChange={(e) => setChauffeurId(e.target.value)}
        className="rounded border border-slate-300 bg-white px-2 py-1"
      >
        <option value="">Chauffeur…</option>
        {chauffeurs.map((c) => (
          <option key={c.id} value={c.id}>
            {chauffeurLabel(c)}
          </option>
        ))}
      </select>
      <input
        type="number"
        min={0}
        value={cout}
        onChange={(e) => setCout(e.target.value)}
        placeholder="Coût (DT)"
        className="rounded border border-slate-300 px-2 py-1"
      />
      <select
        value={mode}
        onChange={(e) => setMode(e.target.value)}
        className="rounded border border-slate-300 bg-white px-2 py-1"
      >
        <option value="">Mode…</option>
        <option value="PARC">Parc roulant</option>
        <option value="LONGUE_DUREE">Loc. longue durée</option>
        <option value="JOURNALIERE">Loc. journalière</option>
      </select>
      <button
        onClick={submit}
        className="rounded bg-slate-700 px-2 py-1 text-xs font-medium text-white hover:bg-slate-800"
      >
        + Ajouter
      </button>
    </div>
  )
}
