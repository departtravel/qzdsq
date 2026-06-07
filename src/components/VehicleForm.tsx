import { useState } from 'react'
import type { Vehicle, VehicleInput } from '../lib/types'

interface Props {
  initial?: Vehicle
  onSave: (input: VehicleInput) => Promise<void>
  onCancel: () => void
}

function emptyInput(): VehicleInput {
  return {
    matricule: '',
    marque: '',
    modele: '',
    chauffeur: '',
    actif: true,
    conso_normale: 8,
    seuil_alerte_pct: 15,
    date_vidange: null,
    km_vidange: null,
    vidange_interval_km: 10000,
    vidange_interval_mois: 12,
    date_distribution: null,
    km_distribution: null,
    distribution_interval_km: 150000,
    date_assurance: null,
    date_visite_technique: null,
    date_vignette: null,
  }
}

function fromVehicle(v: Vehicle): VehicleInput {
  const { id: _id, created_at: _c, ...rest } = v
  return rest
}

export function VehicleForm({ initial, onSave, onCancel }: Props) {
  const [form, setForm] = useState<VehicleInput>(initial ? fromVehicle(initial) : emptyInput())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof VehicleInput>(key: K, value: VehicleInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }
  function num(value: string): number | null {
    return value === '' ? null : Number(value)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.matricule.trim()) {
      setError('Le matricule est obligatoire.')
      return
    }
    if (form.conso_normale <= 0) {
      setError('La consommation normale doit être supérieure à 0.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave({ ...form, matricule: form.matricule.trim() })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const input = 'w-full rounded border border-slate-300 px-3 py-2 text-sm'
  const label = 'block text-xs font-medium text-slate-600 mb-1'

  return (
    <form onSubmit={submit} className="space-y-6">
      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <section>
        <h3 className="mb-2 font-semibold text-slate-700">Identité</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={label}>Matricule *</label>
            <input className={input} value={form.matricule} onChange={(e) => set('matricule', e.target.value)} placeholder="1234-A-56" />
          </div>
          <div>
            <label className={label}>Chauffeur</label>
            <input className={input} value={form.chauffeur ?? ''} onChange={(e) => set('chauffeur', e.target.value)} />
          </div>
          <div>
            <label className={label}>Marque</label>
            <input className={input} value={form.marque ?? ''} onChange={(e) => set('marque', e.target.value)} />
          </div>
          <div>
            <label className={label}>Modèle</label>
            <input className={input} value={form.modele ?? ''} onChange={(e) => set('modele', e.target.value)} />
          </div>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={form.actif} onChange={(e) => set('actif', e.target.checked)} />
          Véhicule actif (décocher pour archiver)
        </label>
      </section>

      <section>
        <h3 className="mb-2 font-semibold text-slate-700">Consommation</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={label}>Conso normale (L/100 km)</label>
            <input type="number" step="0.1" className={input} value={form.conso_normale} onChange={(e) => set('conso_normale', Number(e.target.value))} />
          </div>
          <div>
            <label className={label}>Seuil d'alerte (% au-dessus du normal)</label>
            <input type="number" step="1" className={input} value={form.seuil_alerte_pct} onChange={(e) => set('seuil_alerte_pct', Number(e.target.value))} />
          </div>
        </div>
      </section>

      <section>
        <h3 className="mb-2 font-semibold text-slate-700">Vidange</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className={label}>Dernière date</label>
            <input type="date" className={input} value={form.date_vidange ?? ''} onChange={(e) => set('date_vidange', e.target.value || null)} />
          </div>
          <div>
            <label className={label}>km à la vidange</label>
            <input type="number" className={input} value={form.km_vidange ?? ''} onChange={(e) => set('km_vidange', num(e.target.value))} />
          </div>
          <div>
            <label className={label}>Intervalle (km)</label>
            <input type="number" className={input} value={form.vidange_interval_km ?? ''} onChange={(e) => set('vidange_interval_km', num(e.target.value))} />
          </div>
          <div>
            <label className={label}>Intervalle (mois)</label>
            <input type="number" className={input} value={form.vidange_interval_mois ?? ''} onChange={(e) => set('vidange_interval_mois', num(e.target.value))} />
          </div>
        </div>
      </section>

      <section>
        <h3 className="mb-2 font-semibold text-slate-700">Chaîne de distribution</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <label className={label}>Dernière date</label>
            <input type="date" className={input} value={form.date_distribution ?? ''} onChange={(e) => set('date_distribution', e.target.value || null)} />
          </div>
          <div>
            <label className={label}>km au changement</label>
            <input type="number" className={input} value={form.km_distribution ?? ''} onChange={(e) => set('km_distribution', num(e.target.value))} />
          </div>
          <div>
            <label className={label}>Intervalle (km)</label>
            <input type="number" className={input} value={form.distribution_interval_km ?? ''} onChange={(e) => set('distribution_interval_km', num(e.target.value))} />
          </div>
        </div>
      </section>

      <section>
        <h3 className="mb-2 font-semibold text-slate-700">Échéances administratives</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className={label}>Assurance</label>
            <input type="date" className={input} value={form.date_assurance ?? ''} onChange={(e) => set('date_assurance', e.target.value || null)} />
          </div>
          <div>
            <label className={label}>Visite technique</label>
            <input type="date" className={input} value={form.date_visite_technique ?? ''} onChange={(e) => set('date_visite_technique', e.target.value || null)} />
          </div>
          <div>
            <label className={label}>Vignette</label>
            <input type="date" className={input} value={form.date_vignette ?? ''} onChange={(e) => set('date_vignette', e.target.value || null)} />
          </div>
        </div>
      </section>

      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button type="button" onClick={onCancel} className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Annuler
        </button>
      </div>
    </form>
  )
}
