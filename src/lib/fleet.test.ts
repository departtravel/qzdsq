import { describe, expect, it } from 'vitest'
import {
  assuranceStatus,
  buildReminders,
  computeConsumption,
  consumptionSummary,
  currentKm,
  dateStatus,
  vidangeStatus,
  worstSeverity,
} from './fleet'
import type { FuelLog, Vehicle } from './types'

function makeVehicle(over: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'v1',
    matricule: '1234-A-56',
    marque: 'Renault',
    modele: 'Kangoo',
    annee: 2019,
    chauffeur: null,
    actif: true,
    conso_normale: 8,
    seuil_alerte_pct: 15,
    preavis_km: 1000,
    preavis_jours: 30,
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
    created_at: '2024-01-01',
    ...over,
  }
}

let fuelId = 0
function makeFuel(km: number, litres: number, over: Partial<FuelLog> = {}): FuelLog {
  return {
    id: `f${fuelId++}`,
    vehicle_id: 'v1',
    date: '2024-01-01',
    km,
    litres,
    prix_litre: null,
    montant: null,
    plein_complet: true,
    note: null,
    created_at: '2024-01-01',
    ...over,
  }
}

function isoInDays(days: number): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

describe('dateStatus', () => {
  it('inconnu si pas de date', () => {
    expect(dateStatus('X', null).severity).toBe('unknown')
  })
  it('danger si dépassé', () => {
    expect(dateStatus('X', isoInDays(-5)).severity).toBe('danger')
  })
  it('warn si proche', () => {
    expect(dateStatus('X', isoInDays(10)).severity).toBe('warn')
  })
  it('ok si lointain', () => {
    expect(dateStatus('X', isoInDays(200)).severity).toBe('ok')
  })
})

describe('currentKm', () => {
  it('null sans pleins', () => {
    expect(currentKm([])).toBeNull()
  })
  it('retourne le km max', () => {
    expect(currentKm([makeFuel(100, 10), makeFuel(500, 10), makeFuel(300, 10)])).toBe(500)
  })
})

describe('vidangeStatus (km)', () => {
  it('danger si intervalle km dépassé', () => {
    const v = makeVehicle({ km_vidange: 10000, vidange_interval_km: 10000 })
    expect(vidangeStatus(v, 21000).severity).toBe('danger') // prochaine à 20000
  })
  it('warn si bientôt en km', () => {
    const v = makeVehicle({ km_vidange: 10000, vidange_interval_km: 10000 })
    expect(vidangeStatus(v, 19500).severity).toBe('warn') // reste 500 km
  })
  it('ok si large marge', () => {
    const v = makeVehicle({ km_vidange: 10000, vidange_interval_km: 10000 })
    expect(vidangeStatus(v, 12000).severity).toBe('ok')
  })
  it('prend la dimension la plus critique entre date et km', () => {
    const v = makeVehicle({
      km_vidange: 10000,
      vidange_interval_km: 10000,
      date_vidange: isoInDays(-400), // > 12 mois => danger sur la date
      vidange_interval_mois: 12,
    })
    expect(vidangeStatus(v, 11000).severity).toBe('danger')
  })
})

describe('assuranceStatus', () => {
  it('danger si expirée', () => {
    expect(assuranceStatus(makeVehicle({ date_assurance: isoInDays(-1) })).severity).toBe('danger')
  })
})

describe('computeConsumption', () => {
  it('conso normale => ok', () => {
    const v = makeVehicle({ conso_normale: 8 })
    // 100 km, 8 L => 8 L/100
    const rows = computeConsumption(v, [makeFuel(1000, 50), makeFuel(1100, 8)])
    expect(rows[0].consoReelle).toBeCloseTo(8)
    expect(rows[0].severity).toBe('ok')
  })

  it('surconsommation => danger', () => {
    const v = makeVehicle({ conso_normale: 8, seuil_alerte_pct: 15 })
    // 100 km, 12 L => 12 L/100 (+50%)
    const rows = computeConsumption(v, [makeFuel(1000, 50), makeFuel(1100, 12)])
    expect(rows[0].consoReelle).toBeCloseTo(12)
    expect(rows[0].ecartPct).toBeCloseTo(50)
    expect(rows[0].severity).toBe('danger')
  })

  it('ignore le segment si le plein précédent était partiel', () => {
    const v = makeVehicle()
    const rows = computeConsumption(v, [
      makeFuel(1000, 20, { plein_complet: false }),
      makeFuel(1100, 8),
    ])
    expect(rows[0].consoReelle).toBeNull()
    expect(rows[0].severity).toBe('unknown')
  })

  it('gère les km incohérents (distance <= 0)', () => {
    const v = makeVehicle()
    const rows = computeConsumption(v, [makeFuel(1100, 50), makeFuel(1000, 8)])
    expect(rows.some((r) => r.consoReelle === null)).toBe(true)
  })
})

describe('consumptionSummary', () => {
  it('moyenne globale sur la période', () => {
    const v = makeVehicle({ conso_normale: 8 })
    // départ 1000, fin 1300 => 300 km ; litres hors 1er = 12+12 = 24 => 8 L/100
    const status = consumptionSummary(v, [
      makeFuel(1000, 40),
      makeFuel(1150, 12),
      makeFuel(1300, 12),
    ])
    expect(status.severity).toBe('ok')
    expect(status.detail).toContain('8.0')
  })
  it('inconnu si un seul plein', () => {
    expect(consumptionSummary(makeVehicle(), [makeFuel(1000, 40)]).severity).toBe('unknown')
  })
})

describe('worstSeverity', () => {
  it('danger prime sur warn et ok', () => {
    expect(
      worstSeverity([{ severity: 'ok' }, { severity: 'danger' }, { severity: 'warn' }]),
    ).toBe('danger')
  })
})

describe('buildReminders', () => {
  it('remonte les alertes danger en premier', () => {
    const v = makeVehicle({ date_assurance: isoInDays(-2), date_vignette: isoInDays(10) })
    const reminders = buildReminders([v], { v1: [] })
    expect(reminders.length).toBeGreaterThanOrEqual(2)
    expect(reminders[0].status.severity).toBe('danger')
  })
})
