import { useState } from 'react'
import type { MaintenanceLogInput } from '../lib/types'

interface Props {
  vehicleId: string
  defaultKm?: number | null
  onSave: (input: MaintenanceLogInput) => Promise<void>
}

const TYPES = ['Vidange', 'Distribution', 'Pneus', 'Freins', 'Filtres', 'Batterie', 'Autre']

export function MaintenanceForm({ vehicleId, defaultKm, onSave }: Props) {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [type, setType] = useState('Vidange')
  const [km, setKm] = useState('')
  const [cout, setCout] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!type.trim()) {
      setError('Le type est obligatoire.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave({
        vehicle_id: vehicleId,
        date,
        type: type.trim(),
        km: km ? Number(km) : null,
        cout: cout ? Number(cout) : null,
        note: note || null,
      })
      setKm('')
      setCout('')
      setNote('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  const input = 'w-full rounded border border-slate-300 px-2 py-1.5 text-sm'
  const label = 'block text-xs font-medium text-slate-600 mb-1'

  return (
    <form onSubmit={submit} className="space-y-3">
      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className={label}>Date</label>
          <input type="date" className={input} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className={label}>Type</label>
          <select className={input} value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>km{defaultKm != null ? ` (≈${defaultKm.toLocaleString('fr-FR')})` : ''}</label>
          <input type="number" className={input} value={km} onChange={(e) => setKm(e.target.value)} />
        </div>
        <div>
          <label className={label}>Coût (DH)</label>
          <input type="number" step="0.01" className={input} value={cout} onChange={(e) => setCout(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={label}>Note</label>
        <input className={input} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <button
        type="submit"
        disabled={saving}
        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? 'Ajout…' : 'Ajouter l\'entretien'}
      </button>
    </form>
  )
}
