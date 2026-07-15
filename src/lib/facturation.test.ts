import { describe, expect, it } from 'vitest'
import {
  calculerFacture,
  commissionDepuisPct,
  pctCommission,
  prixNet,
  prochainNumero,
  round2,
  statsParPlateforme,
  totalPlateformes,
  totauxFacture,
  type FactureLigne,
} from './facturation'

const ligne = (over: Partial<FactureLigne>): FactureLigne => ({
  date: '2026-07-15',
  numero_reservation: 'X',
  client_nom: 'Client',
  plateforme: 'GetYourGuide',
  pax: 2,
  prix_vente: 100,
  commission_montant: 30,
  prix_net: 70,
  ...over,
})

describe('prixNet', () => {
  it('soustrait la commission du prix de vente', () => {
    expect(prixNet(100, 30)).toBe(70)
  })
  it('ne descend jamais sous zéro', () => {
    expect(prixNet(50, 80)).toBe(0)
  })
  it('arrondit à 2 décimales', () => {
    expect(prixNet(99.999, 0)).toBe(100)
  })
})

describe('commission %', () => {
  it('convertit un pourcentage en montant', () => {
    expect(commissionDepuisPct(120, 25)).toBe(30)
  })
  it('retrouve le pourcentage depuis le montant', () => {
    expect(pctCommission(120, 30)).toBe(25)
  })
  it('gère un prix de vente nul', () => {
    expect(pctCommission(0, 10)).toBe(0)
  })
})

describe('totauxFacture', () => {
  it('additionne des plateformes/commissions différentes', () => {
    // GetYourGuide 30 % et Viator 20 % sur la même facture.
    const lignes = [
      ligne({ plateforme: 'GetYourGuide', prix_vente: 100, commission_montant: 30, prix_net: 70, pax: 2 }),
      ligne({ plateforme: 'Viator', prix_vente: 200, commission_montant: 40, prix_net: 160, pax: 3 }),
    ]
    expect(totauxFacture(lignes)).toEqual({ pax: 5, vente: 300, commission: 70, net: 230 })
  })
  it('renvoie zéro pour une facture vide', () => {
    expect(totauxFacture([])).toEqual({ pax: 0, vente: 0, commission: 0, net: 0 })
  })
})

describe('prochainNumero', () => {
  it('démarre à 0001 quand aucune facture', () => {
    expect(prochainNumero(2026, [])).toBe('FAC-2026-0001')
  })
  it('incrémente le plus grand rang de l’année', () => {
    expect(prochainNumero(2026, ['FAC-2026-0001', 'FAC-2026-0007', 'FAC-2025-0099'])).toBe('FAC-2026-0008')
  })
  it('ignore les autres années pour le rang', () => {
    expect(prochainNumero(2026, ['FAC-2025-0042'])).toBe('FAC-2026-0001')
  })
})

describe('calculerFacture (TVA + timbre)', () => {
  const lignes = [
    ligne({ prix_vente: 100, commission_montant: 30, prix_net: 70, pax: 2 }),
    ligne({ prix_vente: 200, commission_montant: 40, prix_net: 160, pax: 3 }),
  ]
  it('applique 19% de TVA sur le net + timbre', () => {
    const r = calculerFacture(lignes, { tvaPct: 19, tvaBase: 'NET', timbre: 1 })
    expect(r.baseTva).toBe(230)
    expect(r.montantTva).toBe(43.7) // 230 * 19%
    expect(r.timbre).toBe(1)
    expect(r.totalTtc).toBe(274.7) // 230 + 43.7 + 1
  })
  it('applique 7% sur le prix de vente si base = VENTE', () => {
    const r = calculerFacture(lignes, { tvaPct: 7, tvaBase: 'VENTE', timbre: 0 })
    expect(r.baseTva).toBe(300)
    expect(r.montantTva).toBe(21) // 300 * 7%
    expect(r.totalTtc).toBe(321)
  })
  it('TVA 0% => TTC = base + timbre', () => {
    const r = calculerFacture(lignes, { tvaPct: 0, tvaBase: 'NET', timbre: 2 })
    expect(r.montantTva).toBe(0)
    expect(r.totalTtc).toBe(232)
  })
})

describe('statsParPlateforme', () => {
  const lignes = [
    { plateforme: 'GetYourGuide', pax: 2, prix_vente: 100, commission_montant: 30 },
    { plateforme: 'GetYourGuide', pax: 1, prix_vente: 100, commission_montant: 30 },
    { plateforme: 'Viator', pax: 3, prix_vente: 300, commission_montant: 60 },
  ]
  it('agrège CA, commissions et net par plateforme', () => {
    const stats = statsParPlateforme(lignes)
    // Trié par CA brut décroissant : Viator (300) avant GetYourGuide (200).
    expect(stats[0]).toMatchObject({ plateforme: 'Viator', reservations: 1, pax: 3, caBrut: 300, commissions: 60, caNet: 240, commissionPct: 20 })
    expect(stats[1]).toMatchObject({ plateforme: 'GetYourGuide', reservations: 2, pax: 3, caBrut: 200, commissions: 60, caNet: 140, commissionPct: 30 })
  })
  it('regroupe les réservations sans plateforme sous « — »', () => {
    const stats = statsParPlateforme([{ plateforme: '', pax: 1, prix_vente: 50, commission_montant: 0 }])
    expect(stats[0].plateforme).toBe('—')
  })
  it('calcule les totaux tous-plateformes', () => {
    const t = totalPlateformes(statsParPlateforme(lignes))
    expect(t).toMatchObject({ reservations: 3, pax: 6, caBrut: 500, commissions: 120, caNet: 380, commissionPct: 24 })
  })
})

describe('round2', () => {
  it('corrige les erreurs de flottant', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3)
  })
})
