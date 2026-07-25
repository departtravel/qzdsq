import type { FuelLog, Vehicle } from './types'

export type Severity = 'ok' | 'warn' | 'danger' | 'unknown'

export interface DeadlineStatus {
  label: string
  severity: Severity
  detail: string
}

const DAY = 1000 * 60 * 60 * 24
const SEV_ORDER: Severity[] = ['danger', 'warn', 'ok', 'unknown']

export function worstSeverity(items: { severity: Severity }[]): Severity {
  if (items.length === 0) return 'unknown'
  return items.reduce((a, b) =>
    SEV_ORDER.indexOf(a.severity) < SEV_ORDER.indexOf(b.severity) ? a : b,
  ).severity
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const target = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / DAY)
}

function addMonths(dateStr: string, months: number): Date {
  const d = new Date(dateStr + 'T00:00:00')
  d.setMonth(d.getMonth() + months)
  return d
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('fr-FR')
}

/** Kilométrage courant = plus grand km relevé dans les pleins. */
export function currentKm(logs: FuelLog[]): number | null {
  if (logs.length === 0) return null
  return Math.max(...logs.map((l) => l.km))
}

/** Statut d'une échéance basée uniquement sur une date. */
export function dateStatus(
  label: string,
  dateStr: string | null,
  warnDays = 30,
): DeadlineStatus {
  const days = daysUntil(dateStr)
  if (days === null) return { label, severity: 'unknown', detail: 'Non renseigné' }
  if (days < 0) return { label, severity: 'danger', detail: `Dépassé de ${-days} j` }
  if (days <= warnDays) return { label, severity: 'warn', detail: `Dans ${days} j` }
  return { label, severity: 'ok', detail: `Dans ${days} j` }
}

/**
 * Statut d'un entretien basé sur une date d'intervalle ET/OU un kilométrage.
 * On retient la sévérité la plus critique des deux dimensions.
 */
function maintenanceStatus(
  label: string,
  lastDate: string | null,
  intervalMonths: number | null,
  lastKm: number | null,
  intervalKm: number | null,
  km: number | null,
  warnDays = 30,
  warnKm = 1000,
): DeadlineStatus {
  const parts: { sev: Severity; detail: string }[] = []

  if (lastDate && intervalMonths) {
    const next = addMonths(lastDate, intervalMonths)
    const days = Math.round((next.getTime() - Date.now()) / DAY)
    let sev: Severity = 'ok'
    if (days < 0) sev = 'danger'
    else if (days <= warnDays) sev = 'warn'
    parts.push({
      sev,
      detail: days < 0 ? `échéance ${fmtDate(next)} dépassée` : `prévu ${fmtDate(next)}`,
    })
  }

  if (lastKm != null && intervalKm && km != null) {
    const nextKm = lastKm + intervalKm
    const remaining = nextKm - km
    let sev: Severity = 'ok'
    if (remaining < 0) sev = 'danger'
    else if (remaining <= warnKm) sev = 'warn'
    parts.push({
      sev,
      detail:
        remaining < 0
          ? `dépassé de ${(-remaining).toLocaleString('fr-FR')} km`
          : `dans ${remaining.toLocaleString('fr-FR')} km`,
    })
  }

  if (parts.length === 0) return { label, severity: 'unknown', detail: 'Non renseigné' }

  const worst = parts.reduce((a, b) =>
    SEV_ORDER.indexOf(a.sev) < SEV_ORDER.indexOf(b.sev) ? a : b,
  )
  return { label, severity: worst.sev, detail: parts.map((p) => p.detail).join(' · ') }
}

export function vidangeStatus(v: Vehicle, km: number | null): DeadlineStatus {
  return maintenanceStatus(
    'Vidange',
    v.date_vidange,
    v.vidange_interval_mois,
    v.km_vidange,
    v.vidange_interval_km,
    km,
    v.preavis_jours,
    v.preavis_km,
  )
}

export function distributionStatus(v: Vehicle, km: number | null): DeadlineStatus {
  return maintenanceStatus(
    'Distribution',
    v.date_distribution,
    null,
    v.km_distribution,
    v.distribution_interval_km,
    km,
    v.preavis_jours,
    v.preavis_km,
  )
}

export function assuranceStatus(v: Vehicle): DeadlineStatus {
  return dateStatus('Assurance', v.date_assurance, v.preavis_jours)
}

export function visiteTechniqueStatus(v: Vehicle): DeadlineStatus {
  return dateStatus('Visite technique', v.date_visite_technique, v.preavis_jours)
}

export function vignetteStatus(v: Vehicle): DeadlineStatus {
  return dateStatus('Vignette', v.date_vignette, v.preavis_jours)
}

// ----------------------------------------------------------------
//  Calcul de consommation
// ----------------------------------------------------------------

export interface ConsumptionRow {
  log: FuelLog
  distance: number | null // km parcourus depuis le plein précédent
  consoReelle: number | null // L/100km réels sur cette période
  ecartPct: number | null // écart vs conso normale, en %
  severity: Severity
}

function severityFromEcart(ecartPct: number, seuil: number): Severity {
  if (ecartPct > seuil) return 'danger'
  if (ecartPct > seuil / 2) return 'warn'
  return 'ok'
}

/**
 * Consommation réelle entre pleins consécutifs (méthode "plein à plein") :
 * les litres d'un plein couvrent la distance parcourue DEPUIS le plein
 * précédent. Le résultat est trié du plus récent au plus ancien.
 */
export function computeConsumption(vehicle: Vehicle, logs: FuelLog[]): ConsumptionRow[] {
  const sorted = [...logs].sort((a, b) => a.km - b.km)
  const rows: ConsumptionRow[] = []

  for (let i = 0; i < sorted.length; i++) {
    const log = sorted[i]
    if (i === 0) {
      rows.push({ log, distance: null, consoReelle: null, ecartPct: null, severity: 'unknown' })
      continue
    }
    const prev = sorted[i - 1]
    const distance = log.km - prev.km
    // Une conso n'a de sens que si le plein précédent était complet.
    if (distance <= 0 || !prev.plein_complet) {
      rows.push({ log, distance: distance > 0 ? distance : null, consoReelle: null, ecartPct: null, severity: 'unknown' })
      continue
    }
    const consoReelle = (log.litres / distance) * 100
    const ecartPct = ((consoReelle - vehicle.conso_normale) / vehicle.conso_normale) * 100
    rows.push({
      log,
      distance,
      consoReelle,
      ecartPct,
      severity: severityFromEcart(ecartPct, vehicle.seuil_alerte_pct),
    })
  }

  return rows.reverse()
}

/**
 * Moyenne globale robuste sur toute la période : somme des litres (hors
 * premier plein) ÷ distance totale parcourue. Moins sensible aux pleins
 * partiels qu'une mesure segment par segment.
 */
export function consumptionSummary(vehicle: Vehicle, logs: FuelLog[]): DeadlineStatus {
  const sorted = [...logs].sort((a, b) => a.km - b.km)
  if (sorted.length < 2) {
    return { label: 'Conso', severity: 'unknown', detail: 'Pas assez de pleins' }
  }
  const distance = sorted[sorted.length - 1].km - sorted[0].km
  if (distance <= 0) {
    return { label: 'Conso', severity: 'unknown', detail: 'km incohérents' }
  }
  // On exclut le 1er plein (sert de point de départ km).
  const litres = sorted.slice(1).reduce((s, l) => s + l.litres, 0)
  const avg = (litres / distance) * 100
  const ecart = ((avg - vehicle.conso_normale) / vehicle.conso_normale) * 100
  const sign = ecart >= 0 ? '+' : ''
  return {
    label: 'Conso',
    severity: severityFromEcart(ecart, vehicle.seuil_alerte_pct),
    detail: `${avg.toFixed(1)} L/100 (${sign}${ecart.toFixed(0)}%)`,
  }
}

// ----------------------------------------------------------------
//  Agrégation : statuts d'un véhicule + rappels de la flotte
// ----------------------------------------------------------------

export function vehicleStatuses(
  v: Vehicle,
  logs: FuelLog[],
  kmOverride?: number | null,
): DeadlineStatus[] {
  // km réel = le plus grand entre les pleins et le km fourni (carnet de bord).
  const kmLogs = currentKm(logs)
  const km =
    kmOverride != null ? Math.max(kmOverride, kmLogs ?? 0) : kmLogs
  return [
    vidangeStatus(v, km),
    distributionStatus(v, km),
    assuranceStatus(v),
    visiteTechniqueStatus(v),
    vignetteStatus(v),
    consumptionSummary(v, logs),
  ]
}

export interface Reminder {
  vehicle: Vehicle
  status: DeadlineStatus
}

/** Liste à plat des échéances en alerte (danger puis warn), triée. */
export function buildReminders(
  vehicles: Vehicle[],
  logsByVehicle: Record<string, FuelLog[]>,
  kmByVehicle: Record<string, number | null> = {},
): Reminder[] {
  const reminders: Reminder[] = []
  for (const v of vehicles) {
    for (const status of vehicleStatuses(v, logsByVehicle[v.id] ?? [], kmByVehicle[v.id])) {
      if (status.severity === 'danger' || status.severity === 'warn') {
        reminders.push({ vehicle: v, status })
      }
    }
  }
  return reminders.sort(
    (a, b) => SEV_ORDER.indexOf(a.status.severity) - SEV_ORDER.indexOf(b.status.severity),
  )
}
