import { describe, expect, it } from 'vitest'
import {
  commissionDepuisPct,
  pctCommission,
  prixNet,
  prochainNumero,
  round2,
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

describe('round2', () => {
  it('corrige les erreurs de flottant', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3)
  })
})
