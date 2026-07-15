// ============================================================
//  DTS OPERATION ERP — Logique de facturation (pure, testée)
//  Une facture = une excursion (à une date), toutes plateformes
//  confondues. Chaque réservation garde son prix de vente et sa
//  commission plateforme propres :
//     prix net = prix de vente − commission plateforme
// ============================================================

export interface FactureLigne {
  date: string
  numero_reservation: string
  client_nom: string
  plateforme: string
  pax: number
  prix_vente: number
  commission_montant: number
  prix_net: number // dérivé : prix_vente − commission_montant
}

export interface FactureTotaux {
  pax: number
  vente: number
  commission: number
  net: number
}

/** Net d'une ligne = vente − commission (jamais négatif). */
export function prixNet(prixVente: number, commission: number): number {
  return Math.max(0, round2(prixVente - commission))
}

/** Convertit un taux de commission (%) en montant, à partir du prix de vente. */
export function commissionDepuisPct(prixVente: number, pct: number): number {
  return round2((prixVente * pct) / 100)
}

/** Taux de commission (%) d'une ligne, pour affichage. */
export function pctCommission(prixVente: number, commission: number): number {
  if (prixVente <= 0) return 0
  return round2((commission / prixVente) * 100)
}

/** Additionne les lignes d'une facture. */
export function totauxFacture(lignes: FactureLigne[]): FactureTotaux {
  return lignes.reduce<FactureTotaux>(
    (t, l) => ({
      pax: t.pax + l.pax,
      vente: round2(t.vente + l.prix_vente),
      commission: round2(t.commission + l.commission_montant),
      net: round2(t.net + l.prix_net),
    }),
    { pax: 0, vente: 0, commission: 0, net: 0 },
  )
}

/**
 * Numéro de facture séquentiel : FAC-<année>-<NNNN>.
 * `numerosExistants` = numéros déjà émis (toutes années). On prend le plus
 * grand rang de l'année cible et on l'incrémente.
 */
export function prochainNumero(annee: number, numerosExistants: string[]): string {
  const prefixe = `FAC-${annee}-`
  let maxRang = 0
  for (const n of numerosExistants) {
    if (!n.startsWith(prefixe)) continue
    const rang = parseInt(n.slice(prefixe.length), 10)
    if (Number.isFinite(rang) && rang > maxRang) maxRang = rang
  }
  return `${prefixe}${String(maxRang + 1).padStart(4, '0')}`
}

// ----- Fiscalité (TVA + droit de timbre) --------------------
export type TvaBase = 'NET' | 'VENTE'

export interface FactureFiscalite {
  tvaPct: number      // 0, 7, 19…
  tvaBase: TvaBase    // base sur laquelle s'applique la TVA
  timbre: number      // droit de timbre fiscal (montant fixe)
}

export interface FactureResultat {
  totaux: FactureTotaux
  baseTva: number     // montant sur lequel la TVA est calculée
  montantTva: number
  timbre: number
  totalTtc: number    // base + TVA + timbre
}

/** Taux de TVA proposés par défaut (Tunisie). */
export const TAUX_TVA = [0, 7, 19] as const

/**
 * Calcul complet d'une facture : totaux + TVA + timbre + TTC.
 * La base de TVA est le net (vente − commission) ou le prix de vente.
 */
export function calculerFacture(lignes: FactureLigne[], fisc: FactureFiscalite): FactureResultat {
  const totaux = totauxFacture(lignes)
  const baseTva = fisc.tvaBase === 'VENTE' ? totaux.vente : totaux.net
  const montantTva = round2((baseTva * fisc.tvaPct) / 100)
  const timbre = round2(fisc.timbre)
  const totalTtc = round2(baseTva + montantTva + timbre)
  return { totaux, baseTva, montantTva, timbre, totalTtc }
}

/** Arrondi comptable à 2 décimales (évite les 0.1 + 0.2 = 0.300000004). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}
