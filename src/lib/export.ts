import type { FuelLog, Vehicle } from './types'
import { consumptionSummary, currentKm } from './fleet'

function escapeCsv(value: unknown): string {
  const s = value == null ? '' : String(value)
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function toCsv(rows: (string | number | null)[][]): string {
  // Séparateur ';' pour une ouverture directe dans Excel FR.
  return rows.map((r) => r.map(escapeCsv).join(';')).join('\n')
}

function download(filename: string, content: string) {
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportFleetCsv(
  vehicles: Vehicle[],
  logsByVehicle: Record<string, FuelLog[]>,
) {
  const header = [
    'Matricule', 'Marque', 'Modèle', 'Chauffeur', 'km actuel',
    'Conso normale (L/100)', 'Conso réelle', 'Vidange', 'Distribution',
    'Assurance', 'Visite technique', 'Vignette',
  ]
  const rows = vehicles.map((v) => {
    const logs = logsByVehicle[v.id] ?? []
    return [
      v.matricule, v.marque, v.modele, v.chauffeur, currentKm(logs),
      v.conso_normale, consumptionSummary(v, logs).detail,
      v.date_vidange, v.date_distribution, v.date_assurance,
      v.date_visite_technique, v.date_vignette,
    ]
  })
  const date = new Date().toISOString().slice(0, 10)
  download(`flotte_${date}.csv`, toCsv([header, ...rows]))
}

export function exportFuelLogsCsv(vehicle: Vehicle, logs: FuelLog[]) {
  const header = ['Date', 'km', 'Litres', 'Prix/L', 'Montant', 'Plein complet', 'Note']
  const rows = [...logs]
    .sort((a, b) => a.km - b.km)
    .map((l) => [
      l.date, l.km, l.litres, l.prix_litre, l.montant,
      l.plein_complet ? 'oui' : 'non', l.note,
    ])
  download(`pleins_${vehicle.matricule}.csv`, toCsv([header, ...rows]))
}
