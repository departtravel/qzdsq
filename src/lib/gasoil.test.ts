import { describe, expect, it } from 'vitest'
import type { AdblueLog, Trip, Vehicle } from './types'
import {
  adblueDosage,
  adblueStatus,
  comparerExcursions,
  computeTrip,
  computeTrips,
  coutMoyenParSortie,
  filtrerPeriode,
  latestKm,
  parChauffeur,
  parExcursion,
  periodeKey,
  semaineIso,
  tripCost,
} from './gasoil'

const vehicle = (over: Partial<Vehicle> = {}): Vehicle => ({
  id: 'v1',
  matricule: 'TEST-1',
  marque: null,
  modele: null,
  annee: null,
  chauffeur: null,
  actif: true,
  conso_normale: 10,
  seuil_alerte_pct: 15,
  preavis_km: 4000,
  preavis_jours: 30,
  date_vidange: null,
  km_vidange: null,
  vidange_interval_km: null,
  vidange_interval_mois: null,
  date_distribution: null,
  km_distribution: null,
  distribution_interval_km: null,
  date_assurance: null,
  date_visite_technique: null,
  date_vignette: null,
  created_at: '',
  ...over,
})

const trip = (over: Partial<Trip> = {}): Trip => ({
  id: 't1',
  vehicle_id: 'v1',
  date: '2026-01-10',
  chauffeur: 'Ali',
  chauffeur_id: null,
  excursion: null,
  excursion_id: null,
  km_depart: 1000,
  km_arrivee: 1200,
  carburant: 'gasoil',
  litres: 20,
  prix_litre: null,
  montant: null,
  lieux_prise_en_charge: null,
  ticket_url: null,
  note: null,
  created_at: '',
  ...over,
})

describe('computeTrip', () => {
  it('calcule distance, conso et écart', () => {
    // 20 L sur 200 km = 10 L/100 = conso normale → écart 0
    const c = computeTrip(trip(), vehicle())
    expect(c.distance).toBe(200)
    expect(c.conso).toBeCloseTo(10)
    expect(c.ecartPct).toBeCloseTo(0)
    expect(c.severity).toBe('ok')
    expect(c.anomalies).toHaveLength(0)
  })

  it('alerte en surconsommation au-delà du seuil', () => {
    // 30 L sur 200 km = 15 L/100 → +50 % vs 10 → danger
    const c = computeTrip(trip({ litres: 30 }), vehicle())
    expect(c.conso).toBeCloseTo(15)
    expect(c.ecartPct).toBeCloseTo(50)
    expect(c.severity).toBe('danger')
    expect(c.anomalies[0]).toMatch(/Surconsommation/)
  })

  it('signale du carburant mis sans distance parcourue', () => {
    const c = computeTrip(trip({ km_arrivee: 1000, litres: 40 }), vehicle())
    expect(c.distance).toBe(0)
    expect(c.severity).toBe('danger')
    expect(c.anomalies).toContain('Carburant sans distance parcourue')
  })

  it('signale une conso anormalement basse', () => {
    // 5 L sur 200 km = 2.5 L/100 < 40 % de 10
    const c = computeTrip(trip({ litres: 5 }), vehicle())
    expect(c.anomalies.some((a) => /anormalement basse/.test(a))).toBe(true)
  })
})

describe('tripCost', () => {
  it('privilégie le montant saisi', () => {
    expect(tripCost(trip({ montant: 300 }))).toBe(300)
  })
  it('sinon calcule prix × litres', () => {
    expect(tripCost(trip({ prix_litre: 2.5, litres: 20, montant: null }))).toBe(50)
  })
  it('null si rien de calculable', () => {
    expect(tripCost(trip({ montant: null, prix_litre: null }))).toBeNull()
  })
})

describe('adblueStatus', () => {
  const logs: AdblueLog[] = [
    { id: 'a1', vehicle_id: 'v1', date: '2026-01-01', litres: 20, km_compteur: 100000, autonomie_km: 6000, note: null, created_at: '' },
  ]
  it('OK loin du plein', () => {
    expect(adblueStatus(logs, 102000).severity).toBe('ok') // reste 4000
  })
  it('alerte à moins de 500 km', () => {
    const s = adblueStatus(logs, 105600) // reste 400
    expect(s.severity).toBe('warn')
    expect(s.detail).toMatch(/reste/i)
  })
  it('danger quand dépassé', () => {
    const s = adblueStatus(logs, 107000) // dépassé de 1000
    expect(s.severity).toBe('danger')
    expect(s.detail).toMatch(/Plein requis/)
  })
  it('unknown sans plein', () => {
    expect(adblueStatus([], 100000).severity).toBe('unknown')
  })
  it('utilise le dernier plein (km le plus haut)', () => {
    const two = [
      logs[0],
      { ...logs[0], id: 'a2', km_compteur: 106000, autonomie_km: 6000 },
    ]
    // dernier plein à 106000, reste 6000 à 106000 → ok
    expect(adblueStatus(two, 106500).severity).toBe('ok')
  })
})

describe('adblueDosage', () => {
  it('calcule L/1000 km entre deux pleins', () => {
    const two: AdblueLog[] = [
      { id: 'a1', vehicle_id: 'v1', date: '2026-01-01', litres: 20, km_compteur: 100000, autonomie_km: 6000, note: null, created_at: '' },
      { id: 'a2', vehicle_id: 'v1', date: '2026-02-01', litres: 18, km_compteur: 106000, autonomie_km: 6000, note: null, created_at: '' },
    ]
    // 18 L sur 6000 km = 3 L/1000
    expect(adblueDosage(two)).toBeCloseTo(3)
  })
  it('null avec un seul plein', () => {
    expect(adblueDosage([])).toBeNull()
  })
})

describe('latestKm', () => {
  it('prend le max des sorties et pleins AdBlue', () => {
    const trips = [trip({ km_arrivee: 1200 }), trip({ id: 't2', km_arrivee: 1500 })]
    const ab: AdblueLog[] = [
      { id: 'a1', vehicle_id: 'v1', date: '2026-01-01', litres: 20, km_compteur: 1800, autonomie_km: 6000, note: null, created_at: '' },
    ]
    expect(latestKm(trips, ab)).toBe(1800)
  })
})

describe('agrégation par chauffeur', () => {
  it('somme km/litres et calcule la conso agrégée', () => {
    const trips = [
      trip({ chauffeur: 'Ali', km_depart: 0, km_arrivee: 100, litres: 12 }),
      trip({ id: 't2', chauffeur: 'Ali', km_depart: 100, km_arrivee: 200, litres: 8 }),
      trip({ id: 't3', chauffeur: 'Sami', km_depart: 0, km_arrivee: 100, litres: 20 }),
    ]
    const computed = computeTrips(trips, new Map([['v1', vehicle()]]))
    const stats = parChauffeur(computed)
    const ali = stats.find((s) => s.key === 'Ali')!
    const sami = stats.find((s) => s.key === 'Sami')!
    expect(ali.km).toBe(200)
    expect(ali.litres).toBe(20)
    expect(ali.conso).toBeCloseTo(10) // 20 L / 200 km
    expect(sami.conso).toBeCloseTo(20) // 20 L / 100 km → gros consommateur
    // trié conso décroissante : Sami en tête
    expect(stats[0].key).toBe('Sami')
  })
})

describe('periodeKey / semaineIso', () => {
  it('clé mensuelle', () => {
    expect(periodeKey('2026-03-15', 'mois')).toBe('2026-03')
  })
  it('semaine ISO connue', () => {
    // 2026-01-01 est un jeudi → semaine 1 de 2026
    expect(semaineIso('2026-01-01')).toBe('2026-S01')
  })
})

describe('filtrerPeriode', () => {
  it('filtre sur les bornes incluses', () => {
    const trips = [trip({ date: '2026-01-05' }), trip({ id: 't2', date: '2026-02-05' })]
    expect(filtrerPeriode(trips, '2026-02-01', '2026-02-28')).toHaveLength(1)
  })
})

describe('comparerExcursions', () => {
  it('détecte des km différents pour la même excursion', () => {
    const trips = [
      trip({ id: 't1', excursion: 'Matmata', chauffeur: 'Ali', km_depart: 0, km_arrivee: 200, litres: 20 }),
      trip({ id: 't2', excursion: 'Matmata', chauffeur: 'Sami', km_depart: 0, km_arrivee: 260, litres: 26,
        lieux_prise_en_charge: 'Prises en charge à 3 hôtels différents' }),
    ]
    const computed = computeTrips(trips, new Map([['v1', vehicle()]]))
    const comp = comparerExcursions(computed, { seuilPct: 15 })
    expect(comp).toHaveLength(1)
    expect(comp[0].nom).toBe('Matmata')
    expect(comp[0].minKm).toBe(200)
    expect(comp[0].maxKm).toBe(260)
    expect(comp[0].ecartMaxPct).toBeCloseTo(30) // 60/200
    expect(comp[0].anomalie).toBe(true)
    // La ligne la plus longue porte la justification
    const sami = comp[0].rows.find((r) => r.chauffeur === 'Sami')!
    expect(sami.flag).toBe(true)
    expect(sami.justification).toMatch(/hôtels/)
  })

  it('ignore les excursions à une seule sortie', () => {
    const trips = [trip({ excursion: 'Solo', km_arrivee: 1200 })]
    const computed = computeTrips(trips, new Map([['v1', vehicle()]]))
    expect(comparerExcursions(computed)).toHaveLength(0)
  })
})

describe('parExcursion / rentabilité', () => {
  it('consolide le coût gasoil par excursion', () => {
    const trips = [
      trip({ id: 't1', excursion: 'Matmata', km_depart: 0, km_arrivee: 200, litres: 20, montant: 60 }),
      trip({ id: 't2', excursion: 'Matmata', km_depart: 0, km_arrivee: 220, litres: 22, montant: 66 }),
      trip({ id: 't3', excursion: 'Douz', km_depart: 0, km_arrivee: 400, litres: 40, montant: 120 }),
    ]
    const computed = computeTrips(trips, new Map([['v1', vehicle()]]))
    const stats = parExcursion(computed)
    const matmata = stats.find((s) => s.key === 'Matmata')!
    expect(matmata.sorties).toBe(2)
    expect(matmata.cost).toBe(126) // 60 + 66
    expect(coutMoyenParSortie(matmata)).toBe(63) // 126 / 2
  })
})
