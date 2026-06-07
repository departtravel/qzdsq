import { useState } from 'react'
import type { FuelLogInput } from '../lib/types'

interface Props {
  vehicleId: string
  defaultKm?: number | null
  onSave: (input: FuelLogInput) => Promise<void>
}

export function FuelLogForm({ vehicleId, defaultKm, onSave }: Props) {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [km, setKm] = useState('')
  const [litres, setLitres] = useState('')
  const [prix, setPrix] = useState('')
  const [montant, setMontant] = useState('')
  const [note, setNote] = useState('')
  const [pleinComplet, setPleinComplet] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Calcul croisé montant <-> litres via le prix au litre
  function onLitres(v: string) {
    setLitres(v)
    if (prix && v) setMontant((Number(v) * Number(prix)).toFixed(2))
  }
  function onPrix(v: string) {
    setPrix(v)
    if (v && litres) setMontant((Number(litres) * Number(v)).toFixed(2))
    else if (v && montant) setLitres((Number(montant) / Number(v)).toFixed(2))
  }
  function onMontant(v: string) {
    setMontant(v)
    if (prix && v) setLitres((Number(v) / Number(prix)).toFixed(2))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!km || !litres) {
      setError('Le kilométrage et les litres sont obligatoires.')
      return
    }
    if (defaultKm != null && Number(km) < defaultKm) {
      setError(`Le km (${km}) est inférieur au dernier relevé (${defaultKm}). Vérifie la saisie.`)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave({
        vehicle_id: vehicleId,
        date,
        km: Number(km),
        litres: Number(litres),
        prix_litre: prix ? Number(prix) : null,
        montant: montant ? Number(montant) : null,
        plein_complet: pleinComplet,
        note: note || null,
      })
      setKm('')
      setLitres('')
      setMontant('')
      setNote('')
      setPleinComplet(true)
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
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <label className={label}>Date</label>
          <input type="date" className={input} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className={label}>
            km compteur{defaultKm != null ? ` (dernier : ${defaultKm.toLocaleString('fr-FR')})` : ''}
          </label>
          <input
            type="number"
            className={input}
            value={km}
            onChange={(e) => setKm(e.target.value)}
            placeholder={defaultKm != null ? String(defaultKm) : ''}
          />
        </div>
        <div>
          <label className={label}>Litres</label>
          <input type="number" step="0.01" className={input} value={litres} onChange={(e) => onLitres(e.target.value)} />
        </div>
        <div>
          <label className={label}>Prix / litre (DH)</label>
          <input type="number" step="0.01" className={input} value={prix} onChange={(e) => onPrix(e.target.value)} />
        </div>
        <div>
          <label className={label}>Montant (DH)</label>
          <input type="number" step="0.01" className={input} value={montant} onChange={(e) => onMontant(e.target.value)} />
        </div>
        <div>
          <label className={label}>Note</label>
          <input className={input} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={pleinComplet}
          onChange={(e) => setPleinComplet(e.target.checked)}
        />
        Plein complet (réservoir rempli à fond — nécessaire au calcul de conso)
      </label>
      <button
        type="submit"
        disabled={saving}
        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? 'Ajout…' : 'Ajouter le plein'}
      </button>
    </form>
  )
}
