import type { FuelLog, Vehicle } from '../lib/types'
import { buildReminders } from '../lib/fleet'

interface Props {
  vehicles: Vehicle[]
  logsByVehicle: Record<string, FuelLog[]>
  onSelect: (v: Vehicle) => void
}

export function RemindersPanel({ vehicles, logsByVehicle, onSelect }: Props) {
  const reminders = buildReminders(vehicles, logsByVehicle)
  if (reminders.length === 0) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        ✅ Aucune échéance urgente. Tout est à jour.
      </div>
    )
  }
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow">
      <h3 className="mb-3 font-semibold text-slate-700">
        🔔 Échéances à surveiller ({reminders.length})
      </h3>
      <ul className="divide-y divide-slate-100">
        {reminders.map((r, i) => (
          <li key={i}>
            <button
              onClick={() => onSelect(r.vehicle)}
              className="flex w-full items-center justify-between gap-3 py-2 text-left text-sm hover:bg-slate-50"
            >
              <span className="flex items-center gap-2">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    r.status.severity === 'danger' ? 'bg-red-500' : 'bg-amber-500'
                  }`}
                />
                <span className="font-medium">{r.vehicle.matricule}</span>
                <span className="text-slate-500">— {r.status.label}</span>
              </span>
              <span
                className={
                  r.status.severity === 'danger'
                    ? 'text-red-600'
                    : 'text-amber-600'
                }
              >
                {r.status.detail}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
