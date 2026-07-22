import type { FuelLog, Vehicle } from './types'
import { consumptionSummary, currentKm } from './fleet'
import type { FuelStat, TripComputed } from './gasoil'

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

// ----------------------------------------------------------------
//  Contrôle Gasoil — carnet de bord + rapport mensuel
// ----------------------------------------------------------------

const num = (n: number | null | undefined, d = 1) =>
  n == null ? '' : n.toFixed(d)

/** Carnet de bord détaillé (une ligne par sortie). */
export function exportCarnetCsv(
  computed: TripComputed[],
  matriculeById: Map<string, string>,
) {
  const header = [
    'Date', 'Véhicule', 'Chauffeur', 'Excursion', 'Km départ', 'Km arrivée',
    'Distance', 'Carburant', 'Litres', 'Conso (L/100)', 'Coût (DT)',
    'Coût/km (DT)', 'Écart %', 'Anomalies', 'Lieux prise en charge', 'Note',
  ]
  const rows = computed.map((c) => [
    c.trip.date,
    matriculeById.get(c.trip.vehicle_id) ?? '',
    c.trip.chauffeur, c.trip.excursion,
    c.trip.km_depart, c.trip.km_arrivee, c.distance, c.trip.carburant,
    c.trip.litres, num(c.conso), num(c.cost, 2), num(c.costPerKm, 3),
    c.ecartPct != null ? num(c.ecartPct, 0) : '',
    c.anomalies.join(' | '), c.trip.lieux_prise_en_charge, c.trip.note,
  ])
  const date = new Date().toISOString().slice(0, 10)
  download(`carnet_gasoil_${date}.csv`, toCsv([header, ...rows]))
}

/** Rapport agrégé (par chauffeur, véhicule ou période) — colonne 1 nommée. */
export function exportStatsCsv(
  filename: string,
  colonne: string,
  stats: FuelStat[],
) {
  const header = [colonne, 'Sorties', 'Km', 'Litres', 'Conso (L/100)', 'Coût (DT)', 'Coût/km (DT)', 'Anomalies']
  const rows = stats.map((s) => [
    s.key, s.sorties, s.km, num(s.litres, 1), num(s.conso),
    num(s.cost, 2), num(s.costPerKm, 3), s.anomalies,
  ])
  const date = new Date().toISOString().slice(0, 10)
  download(`${filename}_${date}.csv`, toCsv([header, ...rows]))
}
