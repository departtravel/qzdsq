import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { calculerRentabilite, type CostLine } from '../../lib/erp'

// ----- Types locaux (lecture seule) -----
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
  guide_id: string | null
  vehicle_id: string | null
  driver_id: string | null
  transport_id: string | null
  transport_mode: string | null
  transport_cout: number | null
  gasoil: number | null
  parking: number | null
  peage: number | null
  statut: string
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

const MOIS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

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
function paxOf(b: BookingRow): number {
  return b.nombre_adultes + b.nombre_enfants + b.nombre_bebes
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

  const promouvoirReservations = useCallback(async (depId: string) => {
    const { error: promoErr } = await supabase
      .from('bookings')
      .update({ statut: 'EN_OPERATION' })
      .eq('departure_id', depId)
      .eq('statut', 'CONFIRMEE')
    if (promoErr) setError(promoErr.message)
  }, [])

  const from = useMemo(() => firstDayISO(year, month), [year, month])
  const to = useMemo(() => lastDayISO(year, month), [year, month])

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
      supabase.from('guide_prices').select('guide_id,demi_journee,journee,deux_jours,date_application').order('date_application', { ascending: false }),
    ])
    const firstErr = ex.error || cl.error || gu.error || ch.error || ve.error || tr.error
    if (firstErr) setError(firstErr.message)
    setExcursions((ex.data as ExcursionRow[]) ?? [])
    // Tarif guide extra le plus récent (par guide, sinon barème par défaut guide_id null).
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
          'id,date_excursion,excursion_id,departure_id,nombre_adultes,nombre_enfants,nombre_bebes,statut,client_nom',
        )
        .gte('date_excursion', from)
        .lte('date_excursion', to)
        .order('date_excursion'),
      supabase
        .from('departures')
        .select('id,date,excursion_id,guide_id,vehicle_id,driver_id,transport_id,transport_mode,transport_cout,gasoil,parking,peage,statut')
        .gte('date', from)
        .lte('date', to)
        .order('date'),
    ])
    if (bk.error) setError(bk.error.message)
    else if (dep.error) setError(dep.error.message)
    setBookings((bk.data as BookingRow[]) ?? [])
    setDepartures((dep.data as DepartureRow[]) ?? [])
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

  // ----- Réservations non affectées -----
  const nonAffectees = useMemo(
    () =>
      bookings
        .filter(
          (b) => !b.departure_id && b.statut !== 'ANNULEE' && b.statut !== 'TERMINEE',
        )
        .sort((a, b) => {
          const d = (a.date_excursion ?? '').localeCompare(b.date_excursion ?? '')
          if (d !== 0) return d
          return (a.excursion_id ?? '').localeCompare(b.excursion_id ?? '')
        }),
    [bookings],
  )

  const toggle = useCallback((id: string) => {
    setSelectError(null)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const creerSortie = useCallback(async () => {
    setSelectError(null)
    const rows = nonAffectees.filter((b) => selected.has(b.id))
    if (rows.length === 0) return
    const firstExc = rows[0].excursion_id
    const firstDate = rows[0].date_excursion
    const homogene = rows.every(
      (r) => r.excursion_id === firstExc && r.date_excursion === firstDate,
    )
    if (!homogene || !firstExc || !firstDate) {
      setSelectError('Sélectionne des réservations du même produit et de la même date.')
      return
    }
    setBusy(true)
    const { data, error: insErr } = await supabase
      .from('departures')
      .insert({ date: firstDate, excursion_id: firstExc, statut: 'PLANIFIEE' })
      .select()
      .single()
    if (insErr || !data) {
      setError(insErr?.message ?? 'Erreur création sortie.')
      setBusy(false)
      return
    }
    const depId = (data as DepartureRow).id
    const { error: updErr } = await supabase
      .from('bookings')
      .update({ departure_id: depId })
      .in(
        'id',
        rows.map((r) => r.id),
      )
    if (updErr) setError(updErr.message)
    await promouvoirReservations(depId)
    setBusy(false)
    await loadMonth()
  }, [nonAffectees, selected, loadMonth, promouvoirReservations])

  // ----- Mise à jour affectation d'une sortie -----
  const majDeparture = useCallback(
    async (
      depId: string,
      field: 'guide_id' | 'vehicle_id' | 'driver_id' | 'transport_id' | 'transport_mode' | 'transport_cout' | 'gasoil' | 'parking' | 'peage',
      value: string | number | null,
    ) => {
      setDepartures((prev) =>
        prev.map((d) => (d.id === depId ? { ...d, [field]: value } : d)),
      )
      const { error: updErr } = await supabase
        .from('departures')
        .update({ [field]: value })
        .eq('id', depId)
      if (updErr) setError(updErr.message)
      await promouvoirReservations(depId)
      await loadMonth()
    },
    [promouvoirReservations, loadMonth],
  )

  const majStatutSortie = useCallback(
    async (depId: string, statut: string) => {
      setDepartures((prev) => prev.map((d) => (d.id === depId ? { ...d, statut } : d)))
      const { error: e } = await supabase.from('departures').update({ statut }).eq('id', depId)
      if (e) setError(e.message)
      await loadMonth()
    },
    [loadMonth],
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

  if (error)
    return (
      <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error} — as-tu exécuté <code>supabase/sorties.sql</code> ?
      </div>
    )

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Planning mensuel &amp; sorties</h2>
        <p className="text-sm text-slate-500">
          Feuille du mois — regroupe les réservations en sorties
        </p>
      </div>

      {/* En-tête: année + mois */}
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

      {/* Réservations non affectées */}
      <div className="mb-4 rounded-lg bg-white p-4 shadow">
        <h3 className="mb-3 font-semibold">
          Réservations non affectées{' '}
          <span className="text-sm font-normal text-slate-400">({nonAffectees.length})</span>
        </h3>

        {selected.size > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-3 rounded border border-blue-200 bg-blue-50 px-3 py-2">
            <span className="text-sm text-blue-700">{selected.size} sélectionnée(s)</span>
            <button
              onClick={creerSortie}
              disabled={busy}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              ➕ Créer une sortie avec la sélection
            </button>
            {selectError && <span className="text-sm text-red-600">{selectError}</span>}
          </div>
        )}

        {!loading && nonAffectees.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune réservation non affectée ce mois-ci.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-3 py-2"></th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Excursion</th>
                  <th className="px-3 py-2">Client</th>
                  <th className="px-3 py-2 text-right">Pax</th>
                  <th className="px-3 py-2">Statut</th>
                </tr>
              </thead>
              <tbody>
                {nonAffectees.map((b) => (
                  <tr key={b.id} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(b.id)}
                        onChange={() => toggle(b.id)}
                      />
                    </td>
                    <td className="px-3 py-2">{b.date_excursion ?? '—'}</td>
                    <td className="px-3 py-2">{excNom(b.excursion_id)}</td>
                    <td className="px-3 py-2 text-slate-500">{b.client_nom ?? '—'}</td>
                    <td className="px-3 py-2 text-right">{paxOf(b)}</td>
                    <td className="px-3 py-2">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                        {b.statut}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sorties du mois */}
      <div className="rounded-lg bg-white p-4 shadow">
        <h3 className="mb-3 font-semibold">
          Sorties du mois{' '}
          <span className="text-sm font-normal text-slate-400">({departures.length})</span>
        </h3>

        {!loading && departures.length === 0 ? (
          <p className="text-sm text-slate-500">
            Aucune sortie créée ce mois-ci. Sélectionne des réservations ci-dessus pour en créer une.
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
              const veh = vehicles.find((v) => v.id === dep.vehicle_id)
              // Frais PARTAGÉS de la sortie (divisés sur le nb de personnes) :
              // guide + chauffeur + transport + gasoil + parking + autoroute.
              const jours = exc?.nombre_jours ?? 1
              const guide = guides.find((g) => g.id === dep.guide_id)
              const chauf = chauffeurs.find((c) => c.id === dep.driver_id)
              let guideAmt = 0
              if (guide && guide.type_guide === 'EXTRA') {
                const b = guidePrix.get(dep.guide_id!) ?? guidePrix.get('DEFAUT')
                if (b) guideAmt = jours >= 2 ? b.deux : (exc?.duree ?? '').toLowerCase().startsWith('demi') ? b.demi : b.jour
              }
              const chaufAmt = chauf && chauf.type_chauffeur === 'EXTRA' ? (chauf.tarif_jour ?? 0) * jours : 0
              const transportAmt = dep.transport_cout ?? (dep.transport_id ? transportTarif.get(dep.transport_id) ?? 0 : 0)
              const fraisPartages = guideAmt + chaufAmt + transportAmt + (dep.gasoil ?? 0) + (dep.parking ?? 0) + (dep.peage ?? 0)

              let rentab: ReturnType<typeof calculerRentabilite> | null = null
              if (exc) {
                // On ne garde que les charges par personne du produit (repas, hébergement,
                // extras) ; guide/transport/gasoil/parking/péage sont au niveau de la sortie.
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
                  capaciteVehicule: veh?.capacite ?? 1,
                })
              }
              // Coût & marge RÉELS de la sortie = par-personne + frais partagés.
              const coutReel = rentab ? rentab.coutTotalTnd + fraisPartages : 0
              const margeReelle = rentab ? rentab.caNetTnd - coutReel : 0
              const coutParPers = paxTotal > 0 ? coutReel / paxTotal : 0
              return (
                <div key={dep.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-medium">{fmtDate(dep.date)}</span>{' '}
                      <span className="text-slate-500">· {excNom(dep.excursion_id)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {dep.statut}
                      </span>
                      {dep.statut === 'PLANIFIEE' && (
                        <button
                          onClick={() => majStatutSortie(dep.id, 'CONFIRMEE')}
                          className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700"
                          title="Émet les factures fournisseurs de la sortie"
                        >
                          ✓ Confirmer la sortie
                        </button>
                      )}
                      {dep.statut === 'CONFIRMEE' && (
                        <button
                          onClick={() => majStatutSortie(dep.id, 'TERMINEE')}
                          className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                        >
                          Terminer
                        </button>
                      )}
                      {dep.statut !== 'ANNULEE' && dep.statut !== 'TERMINEE' && (
                        <button
                          onClick={() => majStatutSortie(dep.id, 'ANNULEE')}
                          className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                        >
                          Annuler
                        </button>
                      )}
                    </div>
                  </div>
                  {dep.statut === 'PLANIFIEE' && (
                    <p className="mb-2 text-xs text-amber-600">
                      ⚠️ Confirme la sortie pour émettre les factures fournisseurs (guide, transport, prestataires).
                    </p>
                  )}

                  {/* Réservations de la sortie */}
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
                                {paxOf(r)} pax
                              </td>
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

                  <div className="mb-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                    <div className="rounded bg-slate-50 px-2 py-1">
                      <span className="text-slate-500">Pax total</span>
                      <div className="font-semibold">{paxTotal}</div>
                    </div>
                    {rentab && (
                      <>
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
                          <div className="text-xs text-slate-400">guide+transport+route</div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Affectations */}
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <AffectSelect
                      label="Guide"
                      value={dep.guide_id}
                      onChange={(v) => majDeparture(dep.id, 'guide_id', v)}
                      options={guides.map((g) => ({ id: g.id, label: guideLabel(g) }))}
                    />
                    <AffectSelect
                      label="Véhicule"
                      value={dep.vehicle_id}
                      onChange={(v) => majDeparture(dep.id, 'vehicle_id', v)}
                      options={vehicles.map((v) => ({ id: v.id, label: vehicleLabel(v) }))}
                    />
                    <AffectSelect
                      label="Chauffeur"
                      value={dep.driver_id}
                      onChange={(v) => majDeparture(dep.id, 'driver_id', v)}
                      options={chauffeurs.map((c) => ({ id: c.id, label: chauffeurLabel(c) }))}
                    />
                    <AffectSelect
                      label="Transport"
                      value={dep.transport_id}
                      onChange={(v) => majDeparture(dep.id, 'transport_id', v)}
                      options={transports.map((t) => ({ id: t.id, label: transportLabel(t) }))}
                    />
                    <label className="text-sm">
                      <span className="mb-1 block text-slate-500">Mode transport</span>
                      <select
                        value={dep.transport_mode ?? ''}
                        onChange={(e) => majDeparture(dep.id, 'transport_mode', e.target.value || null)}
                        className="w-full rounded border border-slate-300 px-2 py-1"
                      >
                        <option value="">—</option>
                        <option value="PARC">Parc roulant (interne)</option>
                        <option value="LONGUE_DUREE">Location longue durée</option>
                        <option value="JOURNALIERE">Location journalière</option>
                      </select>
                    </label>
                    <label className="text-sm">
                      <span className="mb-1 block text-slate-500">Coût transport (DT)</span>
                      <input
                        type="number"
                        min={0}
                        defaultValue={dep.transport_cout ?? ''}
                        placeholder="location journalière"
                        onBlur={(e) =>
                          majDeparture(
                            dep.id,
                            'transport_cout',
                            e.target.value === '' ? null : Number(e.target.value),
                          )
                        }
                        className="w-full rounded border border-slate-300 px-2 py-1"
                      />
                    </label>
                    <FraisInput label="Gasoil (DT)" value={dep.gasoil} onSave={(v) => majDeparture(dep.id, 'gasoil', v)} />
                    <FraisInput label="Parking (DT)" value={dep.parking} onSave={(v) => majDeparture(dep.id, 'parking', v)} />
                    <FraisInput label="Autoroute (DT)" value={dep.peage} onSave={(v) => majDeparture(dep.id, 'peage', v)} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
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

function AffectSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string | null
  options: { id: string; label: string }[]
  onChange: (v: string | null) => void
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-slate-500">{label}</span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm"
      >
        <option value="">— Non affecté —</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
