import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'

// ----- Types locaux (lecture seule, alignés sur supabase/erp.sql) -----
interface BookingRow {
  id: string
  date_excursion: string | null
  excursion_id: string | null
  nombre_adultes: number
  nombre_enfants: number
  nombre_bebes: number
  statut: string
  guide_id: string | null
  vehicle_id: string | null
  driver_id: string | null
  client_nom: string | null
}

interface ExcursionRef {
  id: string
  nom: string
}
interface GuideRef {
  id: string
  nom: string
  prenom: string | null
}
interface ChauffeurRef {
  id: string
  nom: string
  prenom: string | null
}
interface VehicleRef {
  id: string
  immatriculation: string | null
  type: string | null
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

// Vue planning opérationnel quotidien basée sur la table bookings.
export function Planning({ today }: { today?: string }) {
  const [date, setDate] = useState<string>(today ?? todayISO())
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [weekBookings, setWeekBookings] = useState<BookingRow[]>([])
  const [excursions, setExcursions] = useState<ExcursionRef[]>([])
  const [guides, setGuides] = useState<GuideRef[]>([])
  const [chauffeurs, setChauffeurs] = useState<ChauffeurRef[]>([])
  const [vehicles, setVehicles] = useState<VehicleRef[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [prochaines, setProchaines] = useState<{ date: string; count: number }[]>([])
  const autoSelected = useRef(false)

  // Fenêtre de 7 jours à partir de la date sélectionnée (pour la vue semaine).
  const weekDays = useMemo<string[]>(() => {
    const base = new Date(date + 'T00:00:00')
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base)
      d.setDate(base.getDate() + i)
      return d.toISOString().slice(0, 10)
    })
  }, [date])

  const loadReferentiels = useCallback(async () => {
    const [ex, gu, ch, ve] = await Promise.all([
      supabase.from('excursions').select('id,nom').order('nom'),
      supabase.from('guides').select('id,nom,prenom').eq('actif', true).order('nom'),
      supabase.from('chauffeurs').select('id,nom,prenom').eq('actif', true).order('nom'),
      supabase.from('erp_vehicles').select('id,immatriculation,type').order('immatriculation'),
    ])
    const firstErr = ex.error || gu.error || ch.error || ve.error
    if (firstErr) setError(firstErr.message)
    setExcursions((ex.data as ExcursionRef[]) ?? [])
    setGuides((gu.data as GuideRef[]) ?? [])
    setChauffeurs((ch.data as ChauffeurRef[]) ?? [])
    setVehicles((ve.data as VehicleRef[]) ?? [])
  }, [])

  const loadBookings = useCallback(async () => {
    setLoading(true)
    setError(null)
    const cols =
      'id,date_excursion,excursion_id,nombre_adultes,nombre_enfants,nombre_bebes,statut,guide_id,vehicle_id,driver_id,client_nom'
    const [day, week] = await Promise.all([
      supabase.from('bookings').select(cols).eq('date_excursion', date).order('created_at'),
      supabase
        .from('bookings')
        .select(cols)
        .gte('date_excursion', weekDays[0])
        .lte('date_excursion', weekDays[6]),
    ])
    if (day.error) setError(day.error.message)
    else if (week.error) setError(week.error.message)
    setBookings((day.data as BookingRow[]) ?? [])
    setWeekBookings((week.data as BookingRow[]) ?? [])
    setLoading(false)
  }, [date, weekDays])

  // Prochaines sorties à venir (>= aujourd'hui, hors annulées) + auto-sélection.
  const loadProchaines = useCallback(async () => {
    const from = todayISO()
    const { data, error: err } = await supabase
      .from('bookings')
      .select('date_excursion')
      .gte('date_excursion', from)
      .neq('statut', 'ANNULEE')
      .order('date_excursion', { ascending: true })
    if (err) return
    const counts = new Map<string, number>()
    for (const row of (data as { date_excursion: string | null }[]) ?? []) {
      const d = row.date_excursion
      if (d) counts.set(d, (counts.get(d) ?? 0) + 1)
    }
    const list = Array.from(counts.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
    setProchaines(list.slice(0, 5))

    // Si aujourd'hui n'a aucune sortie, sélectionne la prochaine date qui en a.
    if (!autoSelected.current && !today) {
      autoSelected.current = true
      const todayHas = counts.has(from)
      if (!todayHas && list.length > 0) {
        setDate(list[0].date)
      }
    }
  }, [today])

  useEffect(() => {
    loadReferentiels()
    loadProchaines()
  }, [loadReferentiels, loadProchaines])

  useEffect(() => {
    loadBookings()
  }, [loadBookings])

  const excursionNom = useCallback(
    (id: string | null) => excursions.find((e) => e.id === id)?.nom ?? '—',
    [excursions],
  )

  const guideLabel = useCallback(
    (g: GuideRef) => `${g.nom}${g.prenom ? ' ' + g.prenom : ''}`,
    [],
  )
  const chauffeurLabel = useCallback(
    (c: ChauffeurRef) => `${c.nom}${c.prenom ? ' ' + c.prenom : ''}`,
    [],
  )
  const vehicleLabel = useCallback(
    (v: VehicleRef) =>
      `${v.immatriculation ?? 'Sans immat.'}${v.type ? ' (' + v.type + ')' : ''}`,
    [],
  )

  // Affectation rapide: met à jour un champ d'une réservation.
  const affecter = useCallback(
    async (
      bookingId: string,
      field: 'guide_id' | 'vehicle_id' | 'driver_id',
      value: string | null,
    ) => {
      setSavingId(bookingId)
      const { error } = await supabase
        .from('bookings')
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq('id', bookingId)
      if (error) setError(error.message)
      else {
        setBookings((prev) =>
          prev.map((b) => (b.id === bookingId ? { ...b, [field]: value } : b)),
        )
      }
      setSavingId(null)
    },
    [],
  )

  const weekCounts = useMemo<Record<string, number>>(() => {
    const acc: Record<string, number> = {}
    for (const d of weekDays) acc[d] = 0
    for (const b of weekBookings) {
      if (b.date_excursion && acc[b.date_excursion] !== undefined) {
        acc[b.date_excursion] += 1
      }
    }
    return acc
  }, [weekBookings, weekDays])

  const totalParticipants = useMemo(
    () =>
      bookings.reduce(
        (s, b) => s + b.nombre_adultes + b.nombre_enfants + b.nombre_bebes,
        0,
      ),
    [bookings],
  )

  if (error)
    return (
      <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error} — as-tu exécuté <code>supabase/erp.sql</code> puis <code>supabase/seed.sql</code> ?
      </div>
    )

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Planning opérationnel</h2>
          <p className="text-sm text-slate-500">Sorties et affectations du jour</p>
        </div>
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value || todayISO())}
            className="rounded border border-slate-300 px-2 py-1"
          />
        </label>
      </div>

      {/* Cartes stat */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Sorties du jour" value={String(bookings.length)} />
        <Stat label="Participants" value={String(totalParticipants)} />
        <Stat
          label="Non affectées"
          value={String(bookings.filter((b) => !b.guide_id || !b.vehicle_id || !b.driver_id).length)}
          tone="bad"
        />
        <Stat
          label="Sur 7 jours"
          value={String(weekBookings.length)}
          sub={`${weekDays[0]} → ${weekDays[6]}`}
        />
      </div>

      {/* Prochaines sorties */}
      {prochaines.length > 0 && (
        <div className="mb-4 rounded-lg bg-white p-4 shadow">
          <h3 className="mb-2 font-semibold">Prochaines sorties</h3>
          <div className="flex flex-wrap gap-2">
            {prochaines.map((p) => {
              const isSelected = p.date === date
              return (
                <button
                  key={p.date}
                  onClick={() => setDate(p.date)}
                  className={`rounded border px-3 py-1.5 text-sm transition ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-medium">
                    {new Date(p.date + 'T00:00:00').toLocaleDateString('fr-FR', {
                      weekday: 'short',
                      day: '2-digit',
                      month: '2-digit',
                    })}
                  </span>{' '}
                  <span className="text-slate-400">
                    · {p.count} sortie{p.count > 1 ? 's' : ''}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Vue semaine */}
      <div className="mb-4 rounded-lg bg-white p-4 shadow">
        <h3 className="mb-2 font-semibold">Vue semaine</h3>
        <div className="grid grid-cols-7 gap-2 text-center text-xs">
          {weekDays.map((d) => {
            const isSelected = d === date
            return (
              <button
                key={d}
                onClick={() => setDate(d)}
                className={`rounded border px-1 py-2 transition ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="text-slate-500">
                  {new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', {
                    weekday: 'short',
                  })}
                </div>
                <div className="text-slate-400">{d.slice(8, 10)}/{d.slice(5, 7)}</div>
                <div className="mt-1 text-base font-bold text-slate-900">{weekCounts[d]}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Liste des sorties du jour */}
      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-3 py-2">Excursion</th>
              <th className="px-3 py-2">Client</th>
              <th className="px-3 py-2 text-right">Pax</th>
              <th className="px-3 py-2">Guide</th>
              <th className="px-3 py-2">Véhicule</th>
              <th className="px-3 py-2">Chauffeur</th>
              <th className="px-3 py-2">Statut</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => {
              const pax = b.nombre_adultes + b.nombre_enfants + b.nombre_bebes
              const busy = savingId === b.id
              return (
                <tr key={b.id} className="border-b last:border-0 align-top">
                  <td className="px-3 py-2">{excursionNom(b.excursion_id)}</td>
                  <td className="px-3 py-2 text-slate-500">{b.client_nom ?? '—'}</td>
                  <td className="px-3 py-2 text-right">
                    {pax}
                    <div className="text-xs text-slate-400">
                      {b.nombre_adultes}A/{b.nombre_enfants}E/{b.nombre_bebes}B
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <AssignSelect
                      value={b.guide_id}
                      disabled={busy}
                      onChange={(v) => affecter(b.id, 'guide_id', v)}
                      options={guides.map((g) => ({ id: g.id, label: guideLabel(g) }))}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <AssignSelect
                      value={b.vehicle_id}
                      disabled={busy}
                      onChange={(v) => affecter(b.id, 'vehicle_id', v)}
                      options={vehicles.map((v) => ({ id: v.id, label: vehicleLabel(v) }))}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <AssignSelect
                      value={b.driver_id}
                      disabled={busy}
                      onChange={(v) => affecter(b.id, 'driver_id', v)}
                      options={chauffeurs.map((c) => ({ id: c.id, label: chauffeurLabel(c) }))}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                      {b.statut}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {loading && <p className="px-3 py-4 text-sm text-slate-500">Chargement…</p>}
        {!loading && bookings.length === 0 && (
          <p className="px-3 py-4 text-sm text-slate-500">
            Aucune sortie prévue le {date}. Change de date ou charge des réservations via{' '}
            <code>supabase/seed.sql</code>.
          </p>
        )}
      </div>
    </div>
  )
}

function AssignSelect({
  value,
  options,
  onChange,
  disabled,
}: {
  value: string | null
  options: { id: string; label: string }[]
  onChange: (v: string | null) => void
  disabled?: boolean
}) {
  return (
    <select
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value || null)}
      className="w-full min-w-32 rounded border border-slate-300 bg-white px-2 py-1 text-sm disabled:opacity-50"
    >
      <option value="">— Non affecté —</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

function Stat({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string
  value: string
  sub?: string
  tone?: 'good' | 'bad' | 'neutral'
}) {
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
