import { describe, expect, it } from 'vitest'
import {
  calculerRentabilite,
  prixNetEur,
  eurToTnd,
  type CostLine,
  type RentabilityInput,
} from './erp'

function ligne(partial: Partial<CostLine>): CostLine {
  return {
    id: crypto.randomUUID?.() ?? Math.random().toString(),
    excursion_id: 'x',
    jour: 1,
    categorie: 'AUTRE',
    type_depense: 'FIXE',
    nom_depense: 'test',
    quantite: 1,
    unite: null,
    prix_unitaire: 0,
    devise: 'TND',
    inclure_comptabilite: true,
    ...partial,
  }
}

describe('conversions de base', () => {
  it('prix net EUR applique la commission OTA', () => {
    // 125 EUR - 30% = 87.50 EUR (exemple du cahier des charges)
    expect(prixNetEur(125, 30)).toBe(87.5)
  })

  it('conversion EUR -> TND au taux 3.34', () => {
    // 87.50 EUR × 3.34 = 292.25 TND
    expect(eurToTnd(87.5, 3.34)).toBe(292.25)
  })
})

describe('calculerRentabilite — GYG-TDE-002 (Ksar Ghilane 2 jours)', () => {
  const base: RentabilityInput = {
    excursion: {
      prix_adulte: 125,
      prix_enfant: 125,
      prix_bebe: 0,
      commission_ota: 30,
      taux_conversion: 3.34,
    },
    lignes: [
      ligne({ categorie: 'GUIDE', type_depense: 'FIXE', nom_depense: 'Guide 2j', prix_unitaire: 300 }),
      ligne({ categorie: 'RESTAURANT', type_depense: 'PAR_PERSONNE', nom_depense: 'Sidi Idriss', prix_unitaire: 15 }),
      ligne({ categorie: 'HEBERGEMENT', type_depense: 'PAR_PERSONNE', nom_depense: 'Sahara Lounge', prix_unitaire: 55 }),
      ligne({ categorie: 'RESTAURANT', type_depense: 'PAR_PERSONNE', nom_depense: 'Ammar El Jem', prix_unitaire: 25 }),
      ligne({ categorie: 'EXTRA', type_depense: 'PAR_PERSONNE', nom_depense: 'Ticket El Jem', prix_unitaire: 20 }),
    ],
    adultes: 10,
    enfants: 0,
    bebes: 0,
  }

  it('calcule CA net par personne (net EUR × taux)', () => {
    const r = calculerRentabilite(base)
    // 10 × 125 = 1250 brut ; net 875 EUR ; × 3.34 = 2922.5 TND
    expect(r.caBrutEur).toBe(1250)
    expect(r.caNetEur).toBe(875)
    expect(r.caNetTnd).toBe(2922.5)
  })

  it('sépare coûts fixes et variables', () => {
    const r = calculerRentabilite(base)
    // Fixe : guide 300 TND. Variable/pers : 15+55+25+20 = 115 TND
    expect(r.coutFixeTnd).toBe(300)
    expect(r.coutVariableParPersTnd).toBe(115)
    // Total 10 pax : 300 + 10×115 = 1450
    expect(r.coutTotalTnd).toBe(1450)
    expect(r.margeTnd).toBe(2922.5 - 1450)
  })

  it('calcule un seuil de rentabilité entier positif', () => {
    const r = calculerRentabilite(base)
    // Net/pers = 292.25 TND ; marge unitaire = 292.25 - 115 = 177.25
    // seuil = ceil(300 / 177.25) = 2
    expect(r.seuilRentabilite).toBe(2)
  })
})

describe('coûts PAR_VEHICULE (4x4 réparti par capacité)', () => {
  it('un 4x4 de 200 TND pour 5 pers ⇒ 1 véhicule', () => {
    const r = calculerRentabilite({
      excursion: { prix_adulte: 100, prix_enfant: 100, prix_bebe: 0, commission_ota: 30, taux_conversion: 3.34 },
      lignes: [ligne({ categorie: 'EXTRA', type_depense: 'PAR_VEHICULE', nom_depense: '4x4', prix_unitaire: 200 })],
      adultes: 4, enfants: 0, bebes: 0,
      capaciteVehicule: 5,
    })
    expect(r.coutTotalTnd).toBe(200)
  })

  it('6 pers dans des 4x4 de 5 places ⇒ 2 véhicules', () => {
    const r = calculerRentabilite({
      excursion: { prix_adulte: 100, prix_enfant: 100, prix_bebe: 0, commission_ota: 30, taux_conversion: 3.34 },
      lignes: [ligne({ categorie: 'EXTRA', type_depense: 'PAR_VEHICULE', nom_depense: '4x4', prix_unitaire: 200 })],
      adultes: 6, enfants: 0, bebes: 0,
      capaciteVehicule: 5,
    })
    expect(r.coutTotalTnd).toBe(400)
  })
})

describe('prix enfant distinct sur les lignes PAR_PERSONNE', () => {
  it('restaurant 15/7.5 avec 10 adultes + 2 enfants = 165 TND', () => {
    const r = calculerRentabilite({
      excursion: { prix_adulte: 100, prix_enfant: 50, prix_bebe: 0, commission_ota: 30, taux_conversion: 3.34 },
      lignes: [
        ligne({ categorie: 'RESTAURANT', type_depense: 'PAR_PERSONNE', nom_depense: 'Sidi Idriss', prix_unitaire: 15, prix_enfant: 7.5 }),
      ],
      adultes: 10, enfants: 2, bebes: 0,
    })
    // 15×10 + 7.5×2 = 150 + 15 = 165
    expect(r.coutTotalTnd).toBe(165)
  })

  it('sans prix enfant, le prix adulte s\'applique à tous', () => {
    const r = calculerRentabilite({
      excursion: { prix_adulte: 100, prix_enfant: 50, prix_bebe: 0, commission_ota: 30, taux_conversion: 3.34 },
      lignes: [ligne({ categorie: 'RESTAURANT', type_depense: 'PAR_PERSONNE', nom_depense: 'X', prix_unitaire: 15 })],
      adultes: 10, enfants: 2, bebes: 0,
    })
    // 15 × 12 = 180
    expect(r.coutTotalTnd).toBe(180)
  })
})

describe('lignes exclues de la comptabilité', () => {
  it('une ligne inclure_comptabilite=false est ignorée', () => {
    const r = calculerRentabilite({
      excursion: { prix_adulte: 50, prix_enfant: 50, prix_bebe: 0, commission_ota: 30, taux_conversion: 3.34 },
      lignes: [
        ligne({ type_depense: 'FIXE', prix_unitaire: 100, inclure_comptabilite: true }),
        ligne({ type_depense: 'FIXE', prix_unitaire: 999, inclure_comptabilite: false }),
      ],
      adultes: 2, enfants: 0, bebes: 0,
    })
    expect(r.coutTotalTnd).toBe(100)
  })
})
