import { useMemo, useState } from 'react'
import type { FuelLog, Vehicle } from '../lib/types'
import { currentKm, vehicleStatuses, worstSeverity } from '../lib/fleet'
import { exportFleetCsv } from '../lib/export'
import { printFleetReport } from '../lib/pdf'
import { StatusBadge } from './StatusBadge'
import { RemindersPanel } from './RemindersPanel'

interface Props {
  vehicles: Vehicle[]
  logsByVehicle: Record<string, FuelLog[]>
  isAdmin: boolean
  onSelect: (v: Vehicle) => void
  onAdd: () => void
}

export function Dashboard({ vehicles, logsByVehicle, isAdmin, onSelect, onAdd }: Props) {
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return vehicles.filter((v) => {
      if (!showArchived && !v.actif) return false
      if (!q) return true
      return [v.matricule, v.marque, v.modele, v.chauffeur]
        .filter(Boolean)
        .some((s) => s!.toLowerCase().includes(q))
    })
  }, [vehicles, search, showArchived])

  const activeCount = vehicles.filter((v) => v.actif).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-2xl font-bold">Tableau de bord</h2>
          <p className="text-slate-500">
            {activeCount} véhicule{activeCount > 1 ? 's' : ''} actif{activeCount > 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          {vehicles.length > 0 && (
            <>
              <button
                onClick={() => exportFleetCsv(vehicles, logsByVehicle)}
                className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
              >
                CSV
              </button>
              <button
                onClick={() => printFleetReport(vehicles, logsByVehicle)}
                className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
              >
                PDF
              </button>
            </>
          )}
          {isAdmin && (
            <button
              onClick={onAdd}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              + Ajouter un véhicule
            </button>
          )}
        </div>
      </div>

      <RemindersPanel vehicles={vehicles.filter((v) => v.actif)} logsByVehicle={logsByVehicle} onSelect={onSelect} />

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher (matricule, marque, chauffeur…)"
          className="w-full max-w-sm rounded border border-slate-300 px-3 py-2 text-sm"
        />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Afficher les archivés
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          {vehicles.length === 0
            ? 'Aucun véhicule pour le moment. Clique sur « Ajouter un véhicule » pour commencer.'
            : 'Aucun véhicule ne correspond à la recherche.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((v) => {
            const logs = logsByVehicle[v.id] ?? []
            const km = currentKm(logs)
            const statuses = vehicleStatuses(v, logs)
            const worst = worstSeverity(statuses)
            const ring =
              worst === 'danger'
                ? 'ring-2 ring-red-300'
                : worst === 'warn'
                  ? 'ring-1 ring-amber-300'
                  : ''
            return (
              <button
                key={v.id}
                onClick={() => onSelect(v)}
                className={`rounded-lg bg-white p-4 text-left shadow transition hover:shadow-md ${ring} ${
                  !v.actif ? 'opacity-60' : ''
                }`}
              >
                <div className="mb-3 flex items-baseline justify-between">
                  <span className="text-lg font-bold">{v.matricule}</span>
                  <span className="text-xs text-slate-400">
                    {[v.marque, v.modele].filter(Boolean).join(' ')}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {statuses.map((s) => (
                    <StatusBadge key={s.label} status={s} />
                  ))}
                </div>
                <p className="mt-3 text-xs text-slate-400">
                  {v.chauffeur && `👤 ${v.chauffeur}`}
                  {v.chauffeur && km != null && ' · '}
                  {km != null && `${km.toLocaleString('fr-FR')} km`}
                </p>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
