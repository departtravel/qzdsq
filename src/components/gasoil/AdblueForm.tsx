import { useEffect, useState } from 'react'
import type { AdblueLogInput, Vehicle } from '../../lib/types'

interface Props {
  vehicles: Vehicle[]
  defaultKmByVehicle: Record<string, number | null>
  onSave: (input: AdblueLogInput) => Promise<void>
}

export function AdblueForm({ vehicles, defaultKmByVehicle, onSave }: Props) {
  const today = new Date().toISOString().slice(0, 10)
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? '')
  const [date, setDate] = useState(today)
  const [litres, setLitres] = useState('')
  const [km, setKm] = useState('')
  const [autonomie, setAutonomie] = useState('6000')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dernierKm = vehicleId ? defaultKmByVehicle[vehicleId] : null
  useEffect(() => {
    if (dernierKm != null) setKm(String(dernierKm))
  }, [dernierKm])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!vehicleId) return setError('Choisis un véhicule.')
    if (!litres || !km || !autonomie) return setError('Litres, km et autonomie obligatoires.')
    setSaving(true)
    setError(null)
    try {
      await onSave({
        vehicle_id: vehicleId,
        date,
        litres: Number(litres),
        km_compteur: Number(km),
        autonomie_km: Number(autonomie),
        note: note || null,
      })
      setLitres('')
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div>
          <label className={label}>Véhicule</label>
          <select className={input} value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>{v.matricule}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Date du plein</label>
          <input type="date" className={input} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className={label}>Litres AdBlue</label>
          <input type="number" step="0.1" className={input} value={litres} onChange={(e) => setLitres(e.target.value)} />
        </div>
        <div>
          <label className={label}>
            Km compteur{dernierKm != null ? ` (${dernierKm.toLocaleString('fr-FR')})` : ''}
          </label>
          <input type="number" className={input} value={km} onChange={(e) => setKm(e.target.value)} />
        </div>
        <div>
          <label className={label}>Autonomie habituelle (km)</label>
          <input type="number" className={input} value={autonomie} onChange={(e) => setAutonomie(e.target.value)} />
        </div>
        <div>
          <label className={label}>Note</label>
          <input className={input} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
      <button
        type="submit"
        disabled={saving}
        className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {saving ? 'Ajout…' : 'Enregistrer le plein AdBlue'}
      </button>
    </form>
  )
}
