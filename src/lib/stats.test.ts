import { describe, expect, it } from 'vitest'
import {
  calculerKpis, compterPar, topProduits, tauxDevisGagnes,
  type BookingStat,
} from './stats'

const b = (over: Partial<BookingStat>): BookingStat => ({
  excursion_id: 'e1', statut: 'CONFIRMEE', montant_total: 100, type_sortie: 'GROUPE', ...over,
})

describe('calculerKpis', () => {
  it('exclut les annulées du CA et compte la conversion', () => {
    const k = calculerKpis([b({}), b({ montant_total: 200 }), b({ statut: 'ANNULEE', montant_total: 999 })], 100)
    expect(k.ca).toBe(300)
    expect(k.reservationsValides).toBe(2)
    expect(k.panierMoyen).toBe(150)
    expect(k.tauxConversion).toBe(3) // 3 résas / 100 visites
  })
  it('gère zéro visite sans diviser par zéro', () => {
    expect(calculerKpis([b({})], 0).tauxConversion).toBe(0)
  })
  it('calcule la part de privatif', () => {
    const k = calculerKpis([b({ type_sortie: 'PRIVE' }), b({ type_sortie: 'GROUPE' })], 10)
    expect(k.partPrive).toBe(50)
  })
})

describe('compterPar', () => {
  it('agrège par clé', () => {
    expect(compterPar([b({ statut: 'A' }), b({ statut: 'A' }), b({ statut: 'B' })], (x) => x.statut))
      .toEqual({ A: 2, B: 1 })
  })
})

describe('topProduits', () => {
  it('classe par CA décroissant et ignore les annulées', () => {
    const top = topProduits(
      [b({ excursion_id: 'e1', montant_total: 100 }), b({ excursion_id: 'e2', montant_total: 300 }),
       b({ excursion_id: 'e2', statut: 'ANNULEE', montant_total: 999 })],
      { e1: 'A', e2: 'B' },
    )
    expect(top[0].excursion_id).toBe('e2')
    expect(top[0].ca).toBe(300)
    expect(top[0].nom).toBe('B')
  })
})

describe('tauxDevisGagnes', () => {
  it('gagnés / (gagnés + perdus)', () => {
    expect(tauxDevisGagnes([
      { type: 'CIRCUIT', statut: 'GAGNE' }, { type: 'MARIAGE', statut: 'PERDU' },
      { type: 'EVG', statut: 'NOUVELLE' },
    ])).toBe(50)
  })
})
