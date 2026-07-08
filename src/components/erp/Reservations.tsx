import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import {
  calculerRentabilite,
  type CostLine,
  type Excursion,
} from '../../lib/erp'
import {
  useErpRole,
  peutCreerReservation,
  peutTransition,
  ROLE_LABEL,
  type BookingStatut as RoleStatut,
} from '../../lib/roles'

// Sous-ensemble tarifaire d'une excursion nécessaire au calcul de rentabilité.
type ExcursionPricing = Pick<
  Excursion,
  'prix_adulte' | 'prix_enfant' | 'prix_bebe' | 'commission_ota' | 'taux_conversion'
>

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

interface ExtraOption {
  id: string
  nom: string
  prix_achat: number | null
  devise_achat: string | null
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
  const { role } = useErpRole()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [excursions, setExcursions] = useState<ExcursionOption[]>([])
  const [otas, setOtas] = useState<OtaOption[]>([])
  const [extras, setExtras] = useState<ExtraOption[]>([])
  const [extrasByBooking, setExtrasByBooking] = useState<Map<string, ExtraOption[]>>(new Map())
  const [pricingById, setPricingById] = useState<Map<string, ExcursionPricing>>(new Map())
  const [costLinesByExc, setCostLinesByExc] = useState<Map<string, CostLine[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtre, setFiltre] = useState<BookingStatut | 'TOUS'>('TOUS')
  const [showForm, setShowForm] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [b, e, o, x] = await Promise.all([
      supabase.from('bookings').select('*').order('date_excursion', { ascending: true }),
      supabase
        .from('excursions')
        .select(
          'id, code_interne, nom, prix_adulte, prix_enfant, prix_bebe, commission_ota, taux_conversion',
        )
        .order('code_interne'),
      supabase.from('ota_channels').select('id, nom').order('nom'),
      supabase.from('extras').select('id, nom, prix_achat, devise_achat').order('nom'),
    ])
    if (b.error) setError(b.error.message)
    else setBookings((b.data as Booking[]) ?? [])

    type ExcursionRow = ExcursionOption & ExcursionPricing & { id: string }
    const excRows = (e.data as ExcursionRow[]) ?? []
    setExcursions(excRows.map((x) => ({ id: x.id, code_interne: x.code_interne, nom: x.nom })))
    const pMap = new Map<string, ExcursionPricing>()
    for (const x of excRows) {
      pMap.set(x.id, {
        prix_adulte: x.prix_adulte,
        prix_enfant: x.prix_enfant,
        prix_bebe: x.prix_bebe,
        commission_ota: x.commission_ota,
        taux_conversion: x.taux_conversion,
      })
    }
    setPricingById(pMap)
    setOtas((o.data as OtaOption[]) ?? [])
    const extraRows = (x.data as ExtraOption[]) ?? []
    setExtras(extraRows)
    const extraById = new Map<string, ExtraOption>()
    for (const ex of extraRows) extraById.set(ex.id, ex)

    // Charge les lignes de coût de toutes les excursions utilisées par des bookings.
    const excIds = Array.from(
      new Set(
        ((b.data as Booking[]) ?? [])
          .map((bk) => bk.excursion_id)
          .filter((id): id is string => !!id),
      ),
    )
    const clMap = new Map<string, CostLine[]>()
    if (excIds.length > 0) {
      const { data: cl } = await supabase
        .from('excursion_cost_lines')
        .select('*')
        .in('excursion_id', excIds)
      for (const line of (cl as CostLine[]) ?? []) {
        const arr = clMap.get(line.excursion_id) ?? []
        arr.push(line)
        clMap.set(line.excursion_id, arr)
      }
    }
    setCostLinesByExc(clMap)

    // Charge les extras choisis pour chaque réservation.
    const bookingIds = ((b.data as Booking[]) ?? []).map((bk) => bk.id)
    const beMap = new Map<string, ExtraOption[]>()
    if (bookingIds.length > 0) {
      const { data: be } = await supabase
        .from('booking_extras')
        .select('booking_id, extra_id')
        .in('booking_id', bookingIds)
      for (const link of (be as { booking_id: string; extra_id: string }[]) ?? []) {
        const extra = extraById.get(link.extra_id)
        if (!extra) continue
        const arr = beMap.get(link.booking_id) ?? []
        arr.push(extra)
        beMap.set(link.booking_id, arr)
      }
    }
    setExtrasByBooking(beMap)
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
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Réservations ({bookings.length})</h2>
        {peutCreerReservation(role) && (
          <button
            onClick={() => setShowForm((s) => !s)}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            {showForm ? 'Fermer' : '+ Nouvelle réservation'}
          </button>
        )}
      </div>

      {/* Bandeau du rôle courant */}
      <div className="mb-4 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        Connecté en tant que <strong>{ROLE_LABEL[role]}</strong>. Vous ne pouvez agir que sur les
        étapes autorisées à votre rôle — les autres actions sont masquées (et refusées par la base).
      </div>

      {showForm && (
        <BookingForm
          excursions={excursions}
          otas={otas}
          extrasCatalog={extras}
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
              <th className="px-3 py-2 text-right">Coût / Marge (TND)</th>
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
                    {(() => {
                      const chosen = extrasByBooking.get(b.id) ?? []
                      if (chosen.length === 0) return null
                      return (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {chosen.map((ex) => (
                            <span
                              key={ex.id}
                              className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700"
                            >
                              {ex.nom}
                            </span>
                          ))}
                        </div>
                      )
                    })()}
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
                  <td className="px-3 py-2 text-right">
                    <RentabiliteCell
                      pricing={b.excursion_id ? pricingById.get(b.excursion_id) : undefined}
                      lignes={b.excursion_id ? costLinesByExc.get(b.excursion_id) : undefined}
                      adultes={b.nombre_adultes ?? 0}
                      enfants={b.nombre_enfants ?? 0}
                      bebes={b.nombre_bebes ?? 0}
                    />
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
                    {next && peutTransition(role, b.statut as RoleStatut, next as RoleStatut) && (
                      <button
                        disabled={busy}
                        onClick={() => changerStatut(b, next)}
                        className="mr-1 rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {NEXT_LABEL[b.statut]} →
                      </button>
                    )}
                    {next && !peutTransition(role, b.statut as RoleStatut, next as RoleStatut) && (
                      <span className="mr-1 text-xs italic text-slate-400">
                        en attente de {RESPONSABLE[next].split('—')[0].trim()}
                      </span>
                    )}
                    {b.statut !== 'ANNULEE' &&
                      b.statut !== 'TERMINEE' &&
                      peutTransition(role, b.statut as RoleStatut, 'ANNULEE') && (
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

function RentabiliteCell({
  pricing,
  lignes,
  adultes,
  enfants,
  bebes,
}: {
  pricing: ExcursionPricing | undefined
  lignes: CostLine[] | undefined
  adultes: number
  enfants: number
  bebes: number
}) {
  if (!pricing) return <span className="text-slate-400">—</span>
  // Sans aucune ligne de coût, la marge serait trompeuse (= CA net).
  if (!lignes || lignes.length === 0) {
    return <span className="text-xs italic text-slate-400">coûts non configurés</span>
  }
  const r = calculerRentabilite({ excursion: pricing, lignes, adultes, enfants, bebes })
  const positif = r.margeTnd >= 0
  return (
    <div className="whitespace-nowrap">
      <div className="text-slate-700">{r.coutTotalTnd.toFixed(2)}</div>
      <div className={`font-semibold ${positif ? 'text-green-700' : 'text-red-600'}`}>
        {positif ? '+' : ''}
        {r.margeTnd.toFixed(2)}
      </div>
      {r.seuilRentabilite !== null && (
        <div className="text-xs text-slate-400">seuil {r.seuilRentabilite} pax</div>
      )}
    </div>
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
  hotel: string
  heure_prise_en_charge: string
  regime: string
  extras: string
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
  hotel: '',
  heure_prise_en_charge: '',
  regime: '',
  extras: '',
  notes: '',
}

function BookingForm({
  excursions,
  otas,
  extrasCatalog,
  onCreated,
  onError,
}: {
  excursions: ExcursionOption[]
  otas: OtaOption[]
  extrasCatalog: ExtraOption[]
  onCreated: () => void
  onError: (msg: string) => void
}) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [selectedExtras, setSelectedExtras] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  const toggleExtra = (id: string) =>
    setSelectedExtras((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

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
    const { data: inserted, error } = await supabase.from('bookings').insert({
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
      hotel: form.hotel || null,
      heure_prise_en_charge: form.heure_prise_en_charge || null,
      regime: form.regime || null,
      extras: form.extras || null,
      notes: form.notes || null,
      statut: 'NOUVELLE',
    })
      .select()
      .single()
    if (error) {
      setSaving(false)
      onError(error.message)
      return
    }
    // Insère les extras choisis pour cette réservation.
    const bookingId = (inserted as { id: string } | null)?.id
    if (bookingId && selectedExtras.size > 0) {
      const rows = Array.from(selectedExtras).map((extra_id) => ({
        booking_id: bookingId,
        extra_id,
      }))
      const { error: exErr } = await supabase.from('booking_extras').insert(rows)
      if (exErr) {
        setSaving(false)
        onError(exErr.message)
        return
      }
    }
    setSaving(false)
    setForm(EMPTY_FORM)
    setSelectedExtras(new Set())
    onCreated()
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

        <Field label="Hôtel / lieu de prise en charge">
          <input
            type="text"
            value={form.hotel}
            onChange={(e) => set('hotel', e.target.value)}
            placeholder="Hôtel Télémaque Djerba"
            className="w-full rounded border border-slate-300 px-2 py-1"
          />
        </Field>

        <Field label="Heure de prise en charge">
          <input
            type="text"
            value={form.heure_prise_en_charge}
            onChange={(e) => set('heure_prise_en_charge', e.target.value)}
            placeholder="8h15"
            className="w-full rounded border border-slate-300 px-2 py-1"
          />
        </Field>

        <Field label="Régime / remarques repas">
          <input
            type="text"
            value={form.regime}
            onChange={(e) => set('regime', e.target.value)}
            placeholder="végétarien, vegan, allergie…"
            className="w-full rounded border border-slate-300 px-2 py-1"
          />
        </Field>

        <Field label="Extras" full>
          <input
            type="text"
            value={form.extras}
            onChange={(e) => set('extras', e.target.value)}
            placeholder="Camel ride / Quad double"
            className="w-full rounded border border-slate-300 px-2 py-1"
          />
        </Field>

        <Field label="Extras (options)" full>
          {extrasCatalog.length === 0 ? (
            <span className="text-xs italic text-slate-400">Aucun extra disponible.</span>
          ) : (
            <div className="flex flex-wrap gap-2">
              {extrasCatalog.map((ex) => (
                <label
                  key={ex.id}
                  className="flex cursor-pointer items-center gap-1.5 rounded border border-slate-200 px-2 py-1 text-sm hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedExtras.has(ex.id)}
                    onChange={() => toggleExtra(ex.id)}
                  />
                  <span>{ex.nom}</span>
                  {ex.prix_achat != null && (
                    <span className="text-xs text-slate-400">
                      {ex.prix_achat} {ex.devise_achat ?? ''}
                    </span>
                  )}
                </label>
              ))}
            </div>
          )}
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
