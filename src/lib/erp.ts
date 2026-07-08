// ============================================================
//  DTS OPERATION ERP — Logique métier (rentabilité)
//  Répond automatiquement aux questions du cahier des charges :
//   - Combien coûte réellement cette excursion ?
//   - Combien gagne-t-on par personne ?
//   - Combien de participants minimum pour être rentable ?
// ============================================================

// ----- Types (miroir des tables Supabase) -------------------
export type ErpRole =
  | 'ADMIN' | 'COMPTABLE' | 'RESERVATION' | 'CONFIRMATION'
  | 'OPERATIONS' | 'LOGISTIQUE' | 'LECTURE'

export interface OtaChannel {
  id: string
  nom: string
  commission_percentage: number
  devise: string
  actif: boolean
}

export interface Excursion {
  id: string
  code_interne: string
  nom: string
  ota_channel_id: string | null
  compte_ota: string | null
  ville_depart: string | null
  duree: string | null
  nombre_jours: number
  prix_adulte: number
  prix_enfant: number
  prix_bebe: number
  devise: string
  commission_ota: number
  taux_conversion: number
  statut: string
}

export type CostCategory =
  | 'TRANSPORT' | 'GUIDE' | 'CHAUFFEUR' | 'RESTAURANT' | 'HEBERGEMENT'
  | 'EXTRA' | 'GASOIL' | 'PEAGE' | 'PARKING' | 'AUTRE'

export type CostType = 'PAR_PERSONNE' | 'PAR_VEHICULE' | 'PAR_GROUPE' | 'FIXE'

export interface CostLine {
  id: string
  excursion_id: string
  jour: number
  categorie: CostCategory
  type_depense: CostType | null
  nom_depense: string
  quantite: number
  unite: string | null
  prix_unitaire: number
  devise: string
  inclure_comptabilite: boolean
}

// ----- Paramètres d'un calcul de rentabilité ----------------
export interface RentabilityInput {
  excursion: Pick<Excursion,
    'prix_adulte' | 'prix_enfant' | 'prix_bebe' | 'commission_ota' | 'taux_conversion'>
  lignes: CostLine[]
  adultes: number
  enfants: number
  bebes: number
  /** Capacité d'un véhicule pour répartir les coûts PAR_VEHICULE. Déf. 1. */
  capaciteVehicule?: number
}

export interface CostBreakdownRow {
  categorie: CostCategory
  nom: string
  /** Coût total de la ligne en TND (déjà multiplié par participants/véhicules). */
  totalTnd: number
  /** true si la ligne varie avec le nombre de participants (coût variable). */
  variable: boolean
}

export interface RentabilityResult {
  participants: number          // adultes + enfants (les bébés ne paient pas de coût)
  payants: number               // adultes + enfants (base commerciale)
  caBrutEur: number
  commissionEur: number
  caNetEur: number
  caNetTnd: number
  coutTotalTnd: number
  coutFixeTnd: number           // coûts indépendants du nombre de participants
  coutVariableParPersTnd: number
  margeTnd: number
  margePct: number              // marge / CA net (%)
  coutParPersonneTnd: number
  margeParPersonneTnd: number
  /** Nb minimum de participants payants pour atteindre l'équilibre (>= 0). */
  seuilRentabilite: number | null
  detail: CostBreakdownRow[]
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Coût d'une ligne, exprimé en TND, pour un effectif donné.
 * - PAR_PERSONNE  : prix × quantité × (adultes + enfants)
 * - PAR_GROUPE / FIXE : prix × quantité (une seule fois)
 * - PAR_VEHICULE  : prix × nb véhicules nécessaires (ceil(pax / capacité))
 */
export function ligneCoutTnd(
  ligne: CostLine,
  payants: number,
  taux: number,
  capaciteVehicule: number,
): number {
  const enTnd = ligne.devise === 'TND' ? ligne.prix_unitaire : ligne.prix_unitaire * taux
  const base = enTnd * ligne.quantite
  switch (ligne.type_depense) {
    case 'PAR_PERSONNE':
      return base * payants
    case 'PAR_VEHICULE': {
      const cap = Math.max(1, capaciteVehicule)
      return base * Math.max(1, Math.ceil(payants / cap))
    }
    case 'PAR_GROUPE':
    case 'FIXE':
    default:
      return base
  }
}

/** Une ligne est « variable » si son coût dépend du nombre de participants. */
export function ligneEstVariable(ligne: CostLine): boolean {
  return ligne.type_depense === 'PAR_PERSONNE'
}

/**
 * Calcul complet de rentabilité d'une excursion pour un effectif donné.
 * Toutes les valeurs monétaires de coût sont ramenées en TND.
 */
export function calculerRentabilite(input: RentabilityInput): RentabilityResult {
  const { excursion, lignes, adultes, enfants, bebes } = input
  const capaciteVehicule = input.capaciteVehicule ?? 1
  const taux = excursion.taux_conversion || 3.34
  const payants = adultes + enfants
  const participants = adultes + enfants + bebes

  // --- Chiffre d'affaires (EUR) ---
  const caBrutEur =
    adultes * excursion.prix_adulte +
    enfants * excursion.prix_enfant +
    bebes * excursion.prix_bebe
  const commissionEur = caBrutEur * (excursion.commission_ota / 100)
  const caNetEur = caBrutEur - commissionEur
  const caNetTnd = caNetEur * taux

  // --- Coûts (TND), en distinguant fixes et variables ---
  let coutTotalTnd = 0
  let coutFixeTnd = 0
  let coutVariableParPersTnd = 0
  const detail: CostBreakdownRow[] = []

  const comptabilisees = lignes.filter((l) => l.inclure_comptabilite)
  for (const ligne of comptabilisees) {
    const total = ligneCoutTnd(ligne, payants, taux, capaciteVehicule)
    coutTotalTnd += total
    const variable = ligneEstVariable(ligne)
    if (variable) {
      const unitTnd = ligne.devise === 'TND' ? ligne.prix_unitaire : ligne.prix_unitaire * taux
      coutVariableParPersTnd += unitTnd * ligne.quantite
    } else {
      coutFixeTnd += total
    }
    detail.push({
      categorie: ligne.categorie,
      nom: ligne.nom_depense,
      totalTnd: round2(total),
      variable,
    })
  }

  const margeTnd = caNetTnd - coutTotalTnd
  const margePct = caNetTnd > 0 ? (margeTnd / caNetTnd) * 100 : 0

  // --- Seuil de rentabilité ---
  // Marge unitaire = prix net moyen par payant (TND) - coût variable par personne.
  const prixNetMoyenTnd =
    payants > 0 ? caNetTnd / payants : moyenneNetUnitaireTnd(excursion, taux)
  const margeUnitaire = prixNetMoyenTnd - coutVariableParPersTnd
  const seuilRentabilite =
    margeUnitaire > 0 ? Math.ceil(coutFixeTnd / margeUnitaire) : null

  return {
    participants,
    payants,
    caBrutEur: round2(caBrutEur),
    commissionEur: round2(commissionEur),
    caNetEur: round2(caNetEur),
    caNetTnd: round2(caNetTnd),
    coutTotalTnd: round2(coutTotalTnd),
    coutFixeTnd: round2(coutFixeTnd),
    coutVariableParPersTnd: round2(coutVariableParPersTnd),
    margeTnd: round2(margeTnd),
    margePct: round2(margePct),
    coutParPersonneTnd: payants > 0 ? round2(coutTotalTnd / payants) : 0,
    margeParPersonneTnd: payants > 0 ? round2(margeTnd / payants) : 0,
    seuilRentabilite,
    detail,
  }
}

/** Prix net unitaire (TND) basé sur le tarif adulte, pour amorcer le seuil. */
function moyenneNetUnitaireTnd(
  excursion: Pick<Excursion, 'prix_adulte' | 'commission_ota' | 'taux_conversion'>,
  taux: number,
): number {
  const net = excursion.prix_adulte * (1 - excursion.commission_ota / 100)
  return net * taux
}

/** Conversion utilitaire EUR -> TND. */
export const eurToTnd = (eur: number, taux = 3.34) => round2(eur * taux)

/** Prix net (EUR) après commission OTA. */
export const prixNetEur = (brut: number, commissionPct: number) =>
  round2(brut * (1 - commissionPct / 100))
