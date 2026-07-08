import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'

// ============================================================
//  MODULE RÉSERVATIONS — bookings + workflow métier
//  Workflow : Hiba (réservation) → Farah (confirmation) →
//  Hersi (opérations) → Karima (logistique) → Amine/Aymen (contrôle)
// ============================================================

type BookingStatut =
  | 'NOUVELLE'
  | 'CONFIRMEE'
  | 'EN_OPERATION'
  | 'TERMINEE'
  | 'ANNULEE'

interface Booking {
  id: string
  date_excursion: string | null
  excursion_id: string | null
  ota_channel_id: string | null
  client_nom: string | null
  client_email: string | null
  client_telephone: string | null
  nombre_adultes: number
  nombre_enfants: number
  nombre_bebes: number
  langue: string | null
  statut: BookingStatut
  guide_id: string | null
  vehicle_id: string | null
  driver_id: string | null
  notes: string | null
  created_at: string | null
}

interface ExcursionOption {
  id: string
  code_interne: string | null
  nom: string
}

interface OtaOption {
  id: string
  nom: string
}

const STATUTS: BookingStatut[] = [
  'NOUVELLE',
  'CONFIRMEE',
  'EN_OPERATION',
  'TERMINEE',
  'ANNULEE',
]

// Étape suivante du workflow (null = pas d'avancement possible).
const NEXT_STATUT: Partial<Record<BookingStatut, BookingStatut>> = {
  NOUVELLE: 'CONFIRMEE',
  CONFIRMEE: 'EN_OPERATION',
  EN_OPERATION: 'TERMINEE',
}

const NEXT_LABEL: Partial<Record<BookingStatut, string>> = {
  NOUVELLE: 'Confirmer',
  CONFIRMEE: 'Mettre en opération',
  EN_OPERATION: 'Terminer',
}

// Responsable / étape courante du workflow métier.
const RESPONSABLE: Record<BookingStatut, string> = {
  NOUVELLE: 'Hiba — réservation',
  CONFIRMEE: 'Farah — confirmation',
  EN_OPERATION: 'Hersi — opérations · Karima — logistique',
  TERMINEE: 'Amine / Aymen — contrôle',
  ANNULEE: 'Annulée',
}

const STATUT_STYLE: Record<BookingStatut, string> = {
  NOUVELLE: 'bg-blue-100 text-blue-700',
  CONFIRMEE: 'bg-indigo-100 text-indigo-700',
  EN_OPERATION: 'bg-amber-100 text-amber-700',
  TERMINEE: 'bg-green-100 text-green-700',
  ANNULEE: 'bg-red-100 text-red-700',
}

const LANGUES = ['FR', 'EN', 'DE', 'IT', 'ES', 'AR']

export function Reservations() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [excursions, setExcursions] = useState<ExcursionOption[]>([])
  const [otas, setOtas] = useState<OtaOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtre, setFiltre] = useState<BookingStatut | 'TOUS'>('TOUS')
  const [showForm, setShowForm] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [b, e, o] = await Promise.all([
      supabase.from('bookings').select('*').order('date_excursion', { ascending: true }),
      supabase.from('excursions').select('id, code_interne, nom').order('code_interne'),
      supabase.from('ota_channels').select('id, nom').order('nom'),
    ])
    if (b.error) setError(b.error.message)
    else setBookings((b.data as Booking[]) ?? [])
    setExcursions((e.data as ExcursionOption[]) ?? [])
    setOtas((o.data as OtaOption[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const excursionsById = useMemo(() => {
    const m = new Map<string, ExcursionOption>()
    for (const ex of excursions) m.set(ex.id, ex)
    return m
  }, [excursions])

  const otasById = useMemo(() => {
    const m = new Map<string, OtaOption>()
    for (const o of otas) m.set(o.id, o)
    return m
  }, [otas])

  const filtered = useMemo(() => {
    const list = filtre === 'TOUS' ? bookings : bookings.filter((b) => b.statut === filtre)
    return [...list].sort((a, b) =>
      (a.date_excursion ?? '').localeCompare(b.date_excursion ?? ''),
    )
  }, [bookings, filtre])

  const compteurs = useMemo(() => {
    const c: Record<string, number> = { TOUS: bookings.length }
    for (const s of STATUTS) c[s] = 0
    for (const b of bookings) c[b.statut] = (c[b.statut] ?? 0) + 1
    return c
  }, [bookings])

  const changerStatut = useCallback(
    async (booking: Booking, statut: BookingStatut) => {
      setBusyId(booking.id)
      const { error } = await supabase
        .from('bookings')
        .update({ statut })
        .eq('id', booking.id)
      if (error) {
        setError(error.message)
      } else {
        setBookings((prev) =>
          prev.map((b) => (b.id === booking.id ? { ...b, statut } : b)),
        )
      }
      setBusyId(null)
    },
    [],
  )

  if (loading) return <p className="text-slate-500">Chargement des réservations…</p>
  if (error)
    return (
      <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error} — as-tu exécuté <code>supabase/erp.sql</code> puis <code>supabase/seed.sql</code> ?
      </div>
    )

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Réservations ({bookings.length})</h2>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          {showForm ? 'Fermer' : '+ Nouvelle réservation'}
        </button>
      </div>

      {showForm && (
        <BookingForm
          excursions={excursions}
          otas={otas}
          onCreated={() => {
            setShowForm(false)
            load()
          }}
          onError={setError}
        />
      )}

      {/* Filtres par statut */}
      <div className="mb-4 flex flex-wrap gap-2">
        <FiltreChip
          label={`Tous (${compteurs.TOUS})`}
          active={filtre === 'TOUS'}
          onClick={() => setFiltre('TOUS')}
        />
        {STATUTS.map((s) => (
          <FiltreChip
            key={s}
            label={`${s} (${compteurs[s] ?? 0})`}
            active={filtre === s}
            onClick={() => setFiltre(s)}
          />
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Excursion</th>
              <th className="px-3 py-2">Client</th>
              <th className="px-3 py-2">Canal</th>
              <th className="px-3 py-2 text-right">Pax</th>
              <th className="px-3 py-2">Langue</th>
              <th className="px-3 py-2">Statut</th>
              <th className="px-3 py-2">Étape / Responsable</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => {
              const ex = b.excursion_id ? excursionsById.get(b.excursion_id) : undefined
              const ota = b.ota_channel_id ? otasById.get(b.ota_channel_id) : undefined
              const pax =
                (b.nombre_adultes ?? 0) + (b.nombre_enfants ?? 0) + (b.nombre_bebes ?? 0)
              const next = NEXT_STATUT[b.statut]
              const busy = busyId === b.id
              return (
                <tr key={b.id} className="border-b last:border-0 align-top hover:bg-blue-50/40">
                  <td className="whitespace-nowrap px-3 py-2">{b.date_excursion ?? '—'}</td>
                  <td className="px-3 py-2">
                    {ex ? (
                      <>
                        <span className="font-mono text-xs text-slate-400">
                          {ex.code_interne}
                        </span>{' '}
                        {ex.nom}
                      </>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div>{b.client_nom ?? '—'}</div>
                    {b.client_email && (
                      <div className="text-xs text-slate-400">{b.client_email}</div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-500">
                    {ota?.nom ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {pax}
                    <div className="text-xs text-slate-400">
                      {b.nombre_adultes}A/{b.nombre_enfants}E/{b.nombre_bebes}B
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-500">
                    {b.langue ?? '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium ${STATUT_STYLE[b.statut]}`}
                    >
                      {b.statut}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">{RESPONSABLE[b.statut]}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {next && (
                      <button
                        disabled={busy}
                        onClick={() => changerStatut(b, next)}
                        className="mr-1 rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {NEXT_LABEL[b.statut]} →
                      </button>
                    )}
                    {b.statut !== 'ANNULEE' && b.statut !== 'TERMINEE' && (
                      <button
                        disabled={busy}
                        onClick={() => changerStatut(b, 'ANNULEE')}
                        className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        Annuler
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <p className="mt-4 text-sm text-slate-500">
          {bookings.length === 0
            ? 'Aucune réservation enregistrée. Crée une nouvelle réservation ou exécute supabase/seed.sql.'
            : 'Aucune réservation pour ce filtre.'}
        </p>
      )}
    </div>
  )
}

function FiltreChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        active
          ? 'bg-blue-600 text-white'
          : 'bg-white text-slate-600 shadow hover:bg-blue-50'
      }`}
    >
      {label}
    </button>
  )
}

interface FormState {
  excursion_id: string
  ota_channel_id: string
  date_excursion: string
  client_nom: string
  client_email: string
  client_telephone: string
  nombre_adultes: number
  nombre_enfants: number
  nombre_bebes: number
  langue: string
  notes: string
}

const EMPTY_FORM: FormState = {
  excursion_id: '',
  ota_channel_id: '',
  date_excursion: '',
  client_nom: '',
  client_email: '',
  client_telephone: '',
  nombre_adultes: 1,
  nombre_enfants: 0,
  nombre_bebes: 0,
  langue: 'FR',
  notes: '',
}

function BookingForm({
  excursions,
  otas,
  onCreated,
  onError,
}: {
  excursions: ExcursionOption[]
  otas: OtaOption[]
  onCreated: () => void
  onError: (msg: string) => void
}) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const submit = async () => {
    if (!form.excursion_id) {
      onError('Sélectionne une excursion.')
      return
    }
    if (!form.date_excursion) {
      onError('Renseigne la date de l’excursion.')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('bookings').insert({
      excursion_id: form.excursion_id,
      ota_channel_id: form.ota_channel_id || null,
      date_excursion: form.date_excursion,
      client_nom: form.client_nom || null,
      client_email: form.client_email || null,
      client_telephone: form.client_telephone || null,
      nombre_adultes: form.nombre_adultes,
      nombre_enfants: form.nombre_enfants,
      nombre_bebes: form.nombre_bebes,
      langue: form.langue || null,
      notes: form.notes || null,
      statut: 'NOUVELLE',
    })
    setSaving(false)
    if (error) {
      onError(error.message)
    } else {
      setForm(EMPTY_FORM)
      onCreated()
    }
  }

  return (
    <div className="mb-4 rounded-lg bg-white p-4 shadow">
      <h3 className="mb-3 font-semibold">Nouvelle réservation</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Excursion *">
          <select
            value={form.excursion_id}
            onChange={(e) => set('excursion_id', e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1"
          >
            <option value="">— choisir —</option>
            {excursions.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.code_interne ? `${ex.code_interne} · ` : ''}
                {ex.nom}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Canal OTA">
          <select
            value={form.ota_channel_id}
            onChange={(e) => set('ota_channel_id', e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1"
          >
            <option value="">— aucun —</option>
            {otas.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nom}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Date excursion *">
          <input
            type="date"
            value={form.date_excursion}
            onChange={(e) => set('date_excursion', e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1"
          />
        </Field>

        <Field label="Nom client">
          <input
            type="text"
            value={form.client_nom}
            onChange={(e) => set('client_nom', e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1"
          />
        </Field>

        <Field label="Email client">
          <input
            type="email"
            value={form.client_email}
            onChange={(e) => set('client_email', e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1"
          />
        </Field>

        <Field label="Téléphone client">
          <input
            type="tel"
            value={form.client_telephone}
            onChange={(e) => set('client_telephone', e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1"
          />
        </Field>

        <Field label="Adultes">
          <NumInput value={form.nombre_adultes} onChange={(n) => set('nombre_adultes', n)} min={0} />
        </Field>

        <Field label="Enfants">
          <NumInput value={form.nombre_enfants} onChange={(n) => set('nombre_enfants', n)} min={0} />
        </Field>

        <Field label="Bébés">
          <NumInput value={form.nombre_bebes} onChange={(n) => set('nombre_bebes', n)} min={0} />
        </Field>

        <Field label="Langue">
          <select
            value={form.langue}
            onChange={(e) => set('langue', e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1"
          >
            {LANGUES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Notes" full>
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={2}
            className="w-full rounded border border-slate-300 px-2 py-1"
          />
        </Field>
      </div>

      <div className="mt-3 flex justify-end">
        <button
          disabled={saving}
          onClick={submit}
          className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Enregistrement…' : 'Créer la réservation'}
        </button>
      </div>
    </div>
  )
}

function Field({
  label,
  children,
  full,
}: {
  label: string
  children: ReactNode
  full?: boolean
}) {
  return (
    <label className={`text-sm ${full ? 'sm:col-span-2 lg:col-span-3' : ''}`}>
      <span className="mb-1 block text-slate-500">{label}</span>
      {children}
    </label>
  )
}

function NumInput({
  value,
  onChange,
  min = 0,
}: {
  value: number
  onChange: (n: number) => void
  min?: number
}) {
  return (
    <input
      type="number"
      min={min}
      value={value}
      onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
      className="w-full rounded border border-slate-300 px-2 py-1"
    />
  )
}
