// ============================================================
//  CONTRÔLE GASOIL — logique métier (testée dans gasoil.test.ts)
//
//  - Carnet de bord par sortie : km départ/arrivée, carburant mis
//    par le chauffeur, consommation et coût au km.
//  - Suivi AdBlue : autonomie habituelle saisie manuellement,
//    alerte quand il reste ~500 km avant le prochain plein.
//  - Agrégations par chauffeur / véhicule / semaine / mois avec
//    détection d'anomalies (surconsommation, siphonnage probable).
// ============================================================
import type { AdblueLog, Trip, Vehicle } from './types'
import type { DeadlineStatus, Severity } from './fleet'

/** Seuil sous lequel il reste « juste assez » d'AdBlue → alerte. */
export const ADBLUE_ALERTE_KM = 500

const SEV_ORDER: Severity[] = ['danger', 'warn', 'ok', 'unknown']

export function pireSeverite(items: Severity[]): Severity {
  if (items.length === 0) return 'unknown'
  return items.reduce((a, b) => (SEV_ORDER.indexOf(a) < SEV_ORDER.indexOf(b) ? a : b))
}

function severiteEcart(ecartPct: number, seuil: number): Severity {
  if (ecartPct > seuil) return 'danger'
  if (ecartPct > seuil / 2) return 'warn'
  return 'ok'
}

// ----------------------------------------------------------------
//  Calcul d'une sortie
// ----------------------------------------------------------------

export interface TripComputed {
  trip: Trip
  distance: number // km parcourus (arrivée − départ)
  conso: number | null // L/100 km sur la sortie (litres mis ÷ distance)
  ecartPct: number | null // écart vs conso normale du véhicule
  cost: number | null // coût carburant (dinar)
  costPerKm: number | null // coût carburant au km (dinar)
  severity: Severity
  anomalies: string[] // libellés des anomalies détectées
}

/** Coût carburant d'une sortie : montant saisi, sinon prix × litres. */
export function tripCost(t: Trip): number | null {
  if (t.montant != null) return t.montant
  if (t.prix_litre != null && t.litres > 0) return t.prix_litre * t.litres
  return null
}

/**
 * Consommation, coût et anomalies d'une sortie, à la lumière de la
 * consommation de référence du véhicule.
 */
export function computeTrip(trip: Trip, vehicle: Vehicle | undefined): TripComputed {
  const distance = trip.km_arrivee - trip.km_depart
  const cost = tripCost(trip)
  const costPerKm = cost != null && distance > 0 ? cost / distance : null

  const anomalies: string[] = []
  let conso: number | null = null
  let ecartPct: number | null = null
  let severity: Severity = 'unknown'

  if (distance > 0 && trip.litres > 0) {
    conso = (trip.litres / distance) * 100
    if (vehicle) {
      ecartPct = ((conso - vehicle.conso_normale) / vehicle.conso_normale) * 100
      severity = severiteEcart(ecartPct, vehicle.seuil_alerte_pct)
      if (ecartPct > vehicle.seuil_alerte_pct) {
        anomalies.push(`Surconsommation ${ecartPct >= 0 ? '+' : ''}${ecartPct.toFixed(0)} %`)
      }
      // Conso anormalement basse → km ou litres probablement mal saisis.
      if (conso < vehicle.conso_normale * 0.4) {
        anomalies.push('Conso anormalement basse (saisie douteuse ?)')
        severity = pireSeverite([severity, 'warn'])
      }
    }
  }

  // Carburant mis mais aucune distance → risque de siphonnage / erreur.
  if (trip.litres > 0 && distance === 0) {
    anomalies.push('Carburant sans distance parcourue')
    severity = 'danger'
  }

  return { trip, distance, conso, ecartPct, cost, costPerKm, severity, anomalies }
}

export function computeTrips(
  trips: Trip[],
  vehicleById: Map<string, Vehicle>,
): TripComputed[] {
  return [...trips]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.km_arrivee - a.km_arrivee))
    .map((t) => computeTrip(t, vehicleById.get(t.vehicle_id)))
}

// ----------------------------------------------------------------
//  Suivi AdBlue
// ----------------------------------------------------------------

/**
 * Kilométrage courant connu d'un véhicule, tous relevés confondus
 * (sorties + pleins AdBlue). null si aucune donnée.
 */
export function latestKm(trips: Trip[], adblue: AdblueLog[]): number | null {
  const kms = [
    ...trips.map((t) => t.km_arrivee),
    ...adblue.map((a) => a.km_compteur),
  ]
  return kms.length ? Math.max(...kms) : null
}

/**
 * État AdBlue : à partir du dernier plein (autonomie habituelle
 * saisie manuellement) et du km courant, combien de km restent
 * avant le prochain plein. Alerte à ADBLUE_ALERTE_KM (500 km).
 */
export function adblueStatus(adblue: AdblueLog[], km: number | null): DeadlineStatus {
  if (adblue.length === 0) {
    return { label: 'AdBlue', severity: 'unknown', detail: 'Aucun plein enregistré' }
  }
  const dernier = [...adblue].sort((a, b) => b.km_compteur - a.km_compteur)[0]
  if (km == null) {
    return { label: 'AdBlue', severity: 'unknown', detail: 'Km courant inconnu' }
  }
  const parcourus = km - dernier.km_compteur
  const restant = dernier.autonomie_km - parcourus
  const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR')
  if (restant <= 0) {
    return { label: 'AdBlue', severity: 'danger', detail: `Plein requis (dépassé de ${fmt(-restant)} km)` }
  }
  if (restant <= ADBLUE_ALERTE_KM) {
    return { label: 'AdBlue', severity: 'warn', detail: `Bientôt : reste ${fmt(restant)} km` }
  }
  return { label: 'AdBlue', severity: 'ok', detail: `Reste ${fmt(restant)} km` }
}

/**
 * Dosage AdBlue réel (L / 1000 km) entre les deux derniers pleins,
 * si disponible. Indicateur bonus pour repérer une dérive.
 */
export function adblueDosage(adblue: AdblueLog[]): number | null {
  if (adblue.length < 2) return null
  const sorted = [...adblue].sort((a, b) => a.km_compteur - b.km_compteur)
  const last = sorted[sorted.length - 1]
  const prev = sorted[sorted.length - 2]
  const dist = last.km_compteur - prev.km_compteur
  if (dist <= 0) return null
  return (last.litres / dist) * 1000
}

// ----------------------------------------------------------------
//  Agrégations : par chauffeur, par véhicule, par semaine / mois
// ----------------------------------------------------------------

export type Periode = 'semaine' | 'mois'

/** Numéro de semaine ISO 8601 → clé "YYYY-Sww". */
export function semaineIso(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  const day = (d.getUTCDay() + 6) % 7 // lundi = 0
  d.setUTCDate(d.getUTCDate() - day + 3) // jeudi de la semaine
  const jeudi = d.getTime()
  d.setUTCMonth(0, 1)
  if (d.getUTCDay() !== 4) {
    d.setUTCMonth(0, 1 + ((4 - d.getUTCDay() + 7) % 7))
  }
  const semaine = 1 + Math.round((jeudi - d.getTime()) / (7 * 24 * 3600 * 1000))
  const annee = new Date(jeudi).getUTCFullYear()
  return `${annee}-S${String(semaine).padStart(2, '0')}`
}

/** Clé de période d'une date : "YYYY-MM" ou "YYYY-Sww". */
export function periodeKey(dateStr: string, periode: Periode): string {
  return periode === 'mois' ? dateStr.slice(0, 7) : semaineIso(dateStr)
}

export interface FuelStat {
  key: string // chauffeur, matricule ou clé de période
  sorties: number
  km: number
  litres: number
  conso: number | null // L/100 agrégé (Σ litres ÷ Σ km)
  cost: number // coût carburant total (dinar)
  costPerKm: number | null
  anomalies: number // nb de sorties en anomalie
  worst: Severity
}

/**
 * Regroupe des sorties calculées selon une clé (chauffeur, véhicule,
 * période…) et produit une statistique consolidée par groupe, triée
 * de la plus forte consommation à la plus faible.
 */
export function aggregate(
  computed: TripComputed[],
  keyOf: (c: TripComputed) => string | null,
): FuelStat[] {
  const map = new Map<string, FuelStat>()
  for (const c of computed) {
    const key = keyOf(c)
    if (key == null || key === '') continue
    let s = map.get(key)
    if (!s) {
      s = { key, sorties: 0, km: 0, litres: 0, conso: null, cost: 0, costPerKm: null, anomalies: 0, worst: 'unknown' }
      map.set(key, s)
    }
    s.sorties += 1
    s.km += c.distance
    s.litres += c.trip.litres
    s.cost += c.cost ?? 0
    if (c.anomalies.length) s.anomalies += 1
    s.worst = pireSeverite([s.worst, c.severity])
  }
  const stats = [...map.values()]
  for (const s of stats) {
    s.conso = s.km > 0 && s.litres > 0 ? (s.litres / s.km) * 100 : null
    s.costPerKm = s.km > 0 && s.cost > 0 ? s.cost / s.km : null
  }
  return stats.sort((a, b) => (b.conso ?? -1) - (a.conso ?? -1))
}

export const parChauffeur = (c: TripComputed[]) => aggregate(c, (x) => x.trip.chauffeur)
export const parPeriode = (c: TripComputed[], p: Periode) =>
  aggregate(c, (x) => periodeKey(x.trip.date, p)).sort((a, b) => (a.key < b.key ? 1 : -1))

/**
 * Coût gasoil consolidé PAR EXCURSION — alimente la rentabilité :
 * combien coûte réellement le carburant d'une excursion, en moyenne
 * par sortie et au km. Regroupe par excursion (id → nom, sinon libellé).
 */
export const parExcursion = (c: TripComputed[], excursionNom?: Map<string, string>) =>
  aggregate(c, (x) => {
    const t = x.trip
    if (t.excursion_id) return excursionNom?.get(t.excursion_id) ?? t.excursion
    return t.excursion
  })

/** Coût gasoil moyen par sortie d'un agrégat (rentabilité). */
export const coutMoyenParSortie = (s: FuelStat): number | null =>
  s.sorties > 0 && s.cost > 0 ? s.cost / s.sorties : null

/** Km moyen par sortie d'un agrégat. */
export const kmMoyenParSortie = (s: FuelStat): number | null =>
  s.sorties > 0 ? s.km / s.sorties : null

/** Filtre les sorties sur une plage de dates (bornes incluses, vides = ouvertes). */
export function filtrerPeriode(trips: Trip[], du: string, au: string): Trip[] {
  return trips.filter((t) => (!du || t.date >= du) && (!au || t.date <= au))
}

// ----------------------------------------------------------------
//  Comparaison PAR EXCURSION : même circuit, chauffeurs différents
//  → repérer qui a fait plus de km (détour, prise en charge ailleurs)
// ----------------------------------------------------------------

function mediane(nums: number[]): number {
  if (nums.length === 0) return 0
  const s = [...nums].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export interface ExcursionCompareRow {
  trip: Trip
  chauffeur: string
  matricule: string
  distance: number
  conso: number | null
  ecartKmPct: number | null // écart de distance vs la médiane de l'excursion
  flag: boolean // distance nettement au-dessus de la médiane
  justification: string | null // lieux de prise en charge / détours
}

export interface ExcursionCompare {
  key: string
  nom: string
  kmReference: number | null
  medianeKm: number
  minKm: number
  maxKm: number
  ecartMaxPct: number // (max − min) / min, en %
  rows: ExcursionCompareRow[]
  anomalie: boolean // des chauffeurs ont fait des km sensiblement différents
}

/**
 * Regroupe les sorties par excursion et compare les distances des
 * différents chauffeurs. Une excursion est « en anomalie » quand
 * l'écart max/min de distance dépasse `seuilPct` (déf. 15 %), signe
 * que quelqu'un a roulé plus (détour, prises en charge éparpillées).
 */
export function comparerExcursions(
  computed: TripComputed[],
  opts: {
    excursionNom?: Map<string, string>
    excursionKmRef?: Map<string, number | null>
    matricule?: Map<string, string>
    seuilPct?: number
  } = {},
): ExcursionCompare[] {
  const seuil = opts.seuilPct ?? 15
  const groups = new Map<string, { nom: string; items: TripComputed[] }>()

  for (const c of computed) {
    if (c.distance <= 0) continue
    const t = c.trip
    const key = t.excursion_id ?? (t.excursion ? `nom:${t.excursion.trim().toLowerCase()}` : null)
    if (!key) continue
    const nom =
      (t.excursion_id && opts.excursionNom?.get(t.excursion_id)) || t.excursion || 'Excursion'
    let g = groups.get(key)
    if (!g) {
      g = { nom, items: [] }
      groups.set(key, g)
    }
    g.items.push(c)
  }

  const result: ExcursionCompare[] = []
  for (const [key, g] of groups) {
    if (g.items.length < 2) continue // rien à comparer avec une seule sortie
    const distances = g.items.map((c) => c.distance)
    const med = mediane(distances)
    const minKm = Math.min(...distances)
    const maxKm = Math.max(...distances)
    const ecartMaxPct = minKm > 0 ? ((maxKm - minKm) / minKm) * 100 : 0
    const excId = g.items[0].trip.excursion_id
    const kmReference = excId ? opts.excursionKmRef?.get(excId) ?? null : null
    // Référence de comparaison : distance « normale » saisie, sinon le
    // trajet le plus court réellement fait (le plus efficient).
    const baseline = kmReference && kmReference > 0 ? kmReference : minKm

    const rows: ExcursionCompareRow[] = g.items
      .map((c) => {
        const ecartKmPct = baseline > 0 ? ((c.distance - baseline) / baseline) * 100 : null
        return {
          trip: c.trip,
          chauffeur: c.trip.chauffeur ?? '—',
          matricule: opts.matricule?.get(c.trip.vehicle_id) ?? '—',
          distance: c.distance,
          conso: c.conso,
          ecartKmPct,
          flag: ecartKmPct != null && ecartKmPct > seuil,
          justification: c.trip.lieux_prise_en_charge,
        }
      })
      .sort((a, b) => b.distance - a.distance)

    result.push({
      key,
      nom: g.nom,
      kmReference,
      medianeKm: med,
      minKm,
      maxKm,
      ecartMaxPct,
      rows,
      anomalie: ecartMaxPct > seuil,
    })
  }

  return result.sort((a, b) => b.ecartMaxPct - a.ecartMaxPct)
}
