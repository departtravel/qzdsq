// ============================================================
//  DTS — Statistiques direction (calculs purs, testables)
// ============================================================

export interface BookingStat {
  excursion_id: string | null
  statut: string
  montant_total: number | null
  type_sortie?: string | null
  created_at?: string
}
export interface QuoteStat { type: string; statut: string }

const ANNULEE = 'ANNULEE'
const round2 = (n: number) => Math.round(n * 100) / 100

export interface KpiResult {
  visites: number
  reservations: number
  reservationsValides: number      // hors annulées
  ca: number                       // CA hors annulées
  panierMoyen: number
  tauxConversion: number           // % réservations / visites
  partPrive: number                // % de réservations privatives
}

export function calculerKpis(
  bookings: BookingStat[],
  visites: number,
): KpiResult {
  const valides = bookings.filter((b) => b.statut !== ANNULEE)
  const ca = round2(valides.reduce((s, b) => s + (b.montant_total ?? 0), 0))
  const prives = valides.filter((b) => b.type_sortie === 'PRIVE').length
  return {
    visites,
    reservations: bookings.length,
    reservationsValides: valides.length,
    ca,
    panierMoyen: valides.length ? round2(ca / valides.length) : 0,
    tauxConversion: visites ? round2((bookings.length / visites) * 100) : 0,
    partPrive: valides.length ? round2((prives / valides.length) * 100) : 0,
  }
}

/** Répartition d'un tableau par clé (statut, type…). */
export function compterPar<T>(rows: T[], key: (r: T) => string): Record<string, number> {
  const acc: Record<string, number> = {}
  for (const r of rows) { const k = key(r); acc[k] = (acc[k] ?? 0) + 1 }
  return acc
}

export interface TopProduit { excursion_id: string; nom: string; reservations: number; ca: number }

/** Top produits par CA (hors annulées). */
export function topProduits(
  bookings: BookingStat[],
  noms: Record<string, string>,
  limit = 5,
): TopProduit[] {
  const m = new Map<string, TopProduit>()
  for (const b of bookings) {
    if (b.statut === ANNULEE || !b.excursion_id) continue
    const cur = m.get(b.excursion_id) ?? {
      excursion_id: b.excursion_id, nom: noms[b.excursion_id] ?? '—', reservations: 0, ca: 0,
    }
    cur.reservations += 1
    cur.ca = round2(cur.ca + (b.montant_total ?? 0))
    m.set(b.excursion_id, cur)
  }
  return [...m.values()].sort((a, b) => b.ca - a.ca).slice(0, limit)
}

/** Taux de transformation des devis (gagnés / total traités). */
export function tauxDevisGagnes(quotes: QuoteStat[]): number {
  const traites = quotes.filter((q) => q.statut === 'GAGNE' || q.statut === 'PERDU')
  if (!traites.length) return 0
  const gagnes = traites.filter((q) => q.statut === 'GAGNE').length
  return round2((gagnes / traites.length) * 100)
}
