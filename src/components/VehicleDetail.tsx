import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type {
  FuelLog,
  FuelLogInput,
  MaintenanceLog,
  MaintenanceLogInput,
  Vehicle,
  VehicleInput,
} from '../lib/types'
import {
  assuranceStatus,
  computeConsumption,
  currentKm,
  distributionStatus,
  vidangeStatus,
  vignetteStatus,
  visiteTechniqueStatus,
  type Severity,
} from '../lib/fleet'
import { exportFuelLogsCsv } from '../lib/export'
import { printVehicleSheet } from '../lib/pdf'
import { StatusBadge } from './StatusBadge'
import { FuelLogForm } from './FuelLogForm'
import { MaintenanceForm } from './MaintenanceForm'
import { VehicleForm } from './VehicleForm'

interface Props {
  vehicle: Vehicle
  isAdmin: boolean
  onBack: () => void
  onChanged: () => void
}

const rowColor: Record<Severity, string> = {
  ok: '',
  warn: 'bg-amber-50',
  danger: 'bg-red-50',
  unknown: '',
}

function modePossessionLabel(mode: Vehicle['mode_possession']): string {
  switch (mode) {
    case 'PROPRIETE':
      return 'Propriété'
    case 'LOCATION_LONGUE_DUREE':
      return 'Location longue durée'
    case 'LOCATION_EXCURSION':
      return 'Location par excursion'
    default:
      return '—'
  }
}

function fmtTnd(value: number): string {
  return `${value.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} TND`
}

function coutInfo(vehicle: Vehicle): { label: string; value: string } {
  switch (vehicle.mode_possession) {
    case 'PROPRIETE':
      return {
        label: 'Mensualité leasing / crédit',
        value: vehicle.leasing_mensuel != null ? `${fmtTnd(vehicle.leasing_mensuel)} / mois` : '—',
      }
    case 'LOCATION_LONGUE_DUREE':
      return {
        label: 'Loyer mensuel',
        value: vehicle.loyer_mensuel != null ? `${fmtTnd(vehicle.loyer_mensuel)} / mois` : '—',
      }
    case 'LOCATION_EXCURSION':
      return {
        label: 'Tarif par excursion',
        value: vehicle.tarif_excursion != null ? `${fmtTnd(vehicle.tarif_excursion)} / sortie` : '—',
      }
    default:
      return { label: 'Coût', value: '—' }
  }
}

export function VehicleDetail({ vehicle, isAdmin, onBack, onChanged }: Props) {
  const [logs, setLogs] = useState<FuelLog[]>([])
  const [maint, setMaint] = useState<MaintenanceLog[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)

  async function load() {
    setLoading(true)
    const [fuel, maintenance] = await Promise.all([
      supabase.from('fuel_logs').select('*').eq('vehicle_id', vehicle.id).order('km', { ascending: false }),
      supabase.from('maintenance_logs').select('*').eq('vehicle_id', vehicle.id).order('date', { ascending: false }),
    ])
    setLogs((fuel.data as FuelLog[]) ?? [])
    setMaint((maintenance.data as MaintenanceLog[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle.id])

  const km = currentKm(logs)
  const rows = computeConsumption(vehicle, logs)

  async function addLog(input: FuelLogInput) {
    const { error } = await supabase.from('fuel_logs').insert(input)
    if (error) throw new Error(error.message)
    await load()
  }
  async function deleteLog(id: string) {
    if (!confirm('Supprimer ce plein ?')) return
    await supabase.from('fuel_logs').delete().eq('id', id)
    await load()
  }
  async function addMaint(input: MaintenanceLogInput) {
    const { error } = await supabase.from('maintenance_logs').insert(input)
    if (error) throw new Error(error.message)
    await load()
  }
  async function deleteMaint(id: string) {
    if (!confirm('Supprimer cet entretien ?')) return
    await supabase.from('maintenance_logs').delete().eq('id', id)
    await load()
  }
  async function saveVehicle(input: VehicleInput) {
    const { error } = await supabase.from('vehicles').update(input).eq('id', vehicle.id)
    if (error) throw new Error(error.message)
    setEditing(false)
    onChanged()
  }
  async function deleteVehicle() {
    if (!confirm(`Supprimer le véhicule ${vehicle.matricule} et tout son historique ?`)) return
    await supabase.from('vehicles').delete().eq('id', vehicle.id)
    onBack()
    onChanged()
  }

  if (editing) {
    return (
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold">Modifier {vehicle.matricule}</h2>
        <VehicleForm initial={vehicle} onSave={saveVehicle} onCancel={() => setEditing(false)} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <button onClick={onBack} className="text-sm text-blue-600 hover:underline">
            ← Retour
          </button>
          <h2 className="text-2xl font-bold">
            {vehicle.matricule}
            {!vehicle.actif && (
              <span className="ml-2 rounded bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                Archivé
              </span>
            )}
          </h2>
          <p className="text-slate-500">
            {[vehicle.marque, vehicle.modele].filter(Boolean).join(' ')}
            {vehicle.chauffeur && ` · 👤 ${vehicle.chauffeur}`}
            {km != null && ` · ${km.toLocaleString('fr-FR')} km`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => printVehicleSheet(vehicle, logs, maint)}
            className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
          >
            PDF
          </button>
          {isAdmin && (
            <>
              <button onClick={() => setEditing(true)} className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">
                Modifier
              </button>
              <button onClick={deleteVehicle} className="rounded border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                Supprimer
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatusBadge status={vidangeStatus(vehicle, km)} />
        <StatusBadge status={distributionStatus(vehicle, km)} />
        <StatusBadge status={assuranceStatus(vehicle)} />
        <StatusBadge status={visiteTechniqueStatus(vehicle)} />
        <StatusBadge status={vignetteStatus(vehicle)} />
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="mb-3 font-semibold">Caractéristiques</h3>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase text-slate-500">Places</dt>
            <dd className="font-medium">{vehicle.places != null ? vehicle.places : '—'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Mode de possession</dt>
            <dd className="font-medium">{modePossessionLabel(vehicle.mode_possession)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">{coutInfo(vehicle).label}</dt>
            <dd className="font-medium">{coutInfo(vehicle).value}</dd>
          </div>
        </dl>
      </div>

      {isAdmin && (
        <div className="rounded-lg bg-white p-6 shadow">
          <h3 className="mb-3 font-semibold">Ajouter un plein</h3>
          <FuelLogForm vehicleId={vehicle.id} defaultKm={km} onSave={addLog} />
        </div>
      )}

      <div className="rounded-lg bg-white p-6 shadow">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">
            Historique des pleins — conso normale : {vehicle.conso_normale} L/100 km
          </h3>
          {logs.length > 0 && (
            <button
              onClick={() => exportFuelLogsCsv(vehicle, logs)}
              className="text-sm text-blue-600 hover:underline"
            >
              Exporter CSV
            </button>
          )}
        </div>
        {loading ? (
          <p className="text-slate-500">Chargement…</p>
        ) : rows.length === 0 ? (
          <p className="text-slate-500">Aucun plein enregistré.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-slate-500">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">km</th>
                  <th className="py-2 pr-3">Distance</th>
                  <th className="py-2 pr-3">Litres</th>
                  <th className="py-2 pr-3">Montant</th>
                  <th className="py-2 pr-3">Conso réelle</th>
                  <th className="py-2 pr-3">Écart</th>
                  {isAdmin && <th className="py-2"></th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.log.id} className={`border-b ${rowColor[r.severity]}`}>
                    <td className="py-2 pr-3">{new Date(r.log.date).toLocaleDateString('fr-FR')}</td>
                    <td className="py-2 pr-3">{r.log.km.toLocaleString('fr-FR')}</td>
                    <td className="py-2 pr-3">{r.distance != null ? `${r.distance} km` : '—'}</td>
                    <td className="py-2 pr-3">
                      {r.log.litres} L{!r.log.plein_complet && <span className="ml-1 text-xs text-slate-400">(partiel)</span>}
                    </td>
                    <td className="py-2 pr-3">{r.log.montant != null ? `${r.log.montant} DH` : '—'}</td>
                    <td className="py-2 pr-3 font-medium">
                      {r.consoReelle != null ? `${r.consoReelle.toFixed(1)} L/100` : '—'}
                    </td>
                    <td className="py-2 pr-3">
                      {r.ecartPct != null ? (
                        <span
                          className={
                            r.severity === 'danger'
                              ? 'font-semibold text-red-600'
                              : r.severity === 'warn'
                                ? 'font-semibold text-amber-600'
                                : 'text-green-600'
                          }
                        >
                          {r.ecartPct >= 0 ? '+' : ''}
                          {r.ecartPct.toFixed(0)}%{r.severity === 'danger' && ' ⚠️'}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    {isAdmin && (
                      <td className="py-2 text-right">
                        <button onClick={() => deleteLog(r.log.id)} className="text-xs text-slate-400 hover:text-red-600">
                          Suppr.
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-slate-400">
              Conso « plein à plein » : litres ÷ distance depuis le plein complet précédent. Les
              segments suivant un plein partiel sont ignorés. Lignes rouges = au-dessus du seuil (
              {vehicle.seuil_alerte_pct}%).
            </p>
          </div>
        )}
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="mb-3 font-semibold">Entretien</h3>
        {isAdmin && <MaintenanceForm vehicleId={vehicle.id} defaultKm={km} onSave={addMaint} />}
        {maint.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-slate-500">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">km</th>
                  <th className="py-2 pr-3">Coût</th>
                  <th className="py-2 pr-3">Note</th>
                  {isAdmin && <th className="py-2"></th>}
                </tr>
              </thead>
              <tbody>
                {maint.map((m) => (
                  <tr key={m.id} className="border-b">
                    <td className="py-2 pr-3">{new Date(m.date).toLocaleDateString('fr-FR')}</td>
                    <td className="py-2 pr-3">{m.type}</td>
                    <td className="py-2 pr-3">{m.km != null ? m.km.toLocaleString('fr-FR') : '—'}</td>
                    <td className="py-2 pr-3">{m.cout != null ? `${m.cout} DH` : '—'}</td>
                    <td className="py-2 pr-3">{m.note ?? '—'}</td>
                    {isAdmin && (
                      <td className="py-2 text-right">
                        <button onClick={() => deleteMaint(m.id)} className="text-xs text-slate-400 hover:text-red-600">
                          Suppr.
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          !isAdmin && <p className="mt-2 text-sm text-slate-500">Aucun entretien enregistré.</p>
        )}
      </div>
    </div>
  )
}
