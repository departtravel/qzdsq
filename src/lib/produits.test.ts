import { describe, expect, it } from 'vitest'
import {
  calculerPrixProduit,
  coutExtra,
  prixBase,
  placesRestantes,
  pricingVariante,
  reductionActive,
  meilleureReduction,
  prixAPartirDe,
  promoAffichee,
  badgesProduit,
  type BookingConfig,
  type ProductDiscount,
  type ProductExtra,
  type ProductPricing,
} from './produits'

const pricing: ProductPricing = {
  prix_adulte: 40, prix_enfant: 20, prix_bebe: 0,
  prix_prive_adulte: 90, prix_prive_enfant: 45, prix_prive_bebe: 0,
}

const extra = (over: Partial<ProductExtra>): ProductExtra => ({
  id: 'x', excursion_id: 'e', nom_option: 'Camel ride', description: null,
  categorie: 'Activité', prix_adulte: 15, prix_enfant: 10, prix_bebe: 0,
  actif: true, obligatoire: false, ordre: 0, ...over,
})

const cfg = (over: Partial<BookingConfig> = {}): BookingConfig => ({
  mode: 'GROUPE', adultes: 2, enfants: 1, bebes: 0, extrasSelected: [], ...over,
})

describe('prixBase', () => {
  it('applique le tarif groupe', () => {
    expect(prixBase(pricing, cfg())).toBe(40 * 2 + 20)
  })
  it('applique le tarif privatif (conversion plus grande)', () => {
    expect(prixBase(pricing, cfg({ mode: 'PRIVE' }))).toBe(90 * 2 + 45)
  })
})

describe('coutExtra', () => {
  it('facture l’extra par catégorie de participant', () => {
    expect(coutExtra(extra({}), cfg())).toBe(15 * 2 + 10)
  })
})

describe('calculerPrixProduit', () => {
  it('ajoute le prix des extras cochés au prix de l’excursion', () => {
    const r = calculerPrixProduit(pricing, cfg({ extrasSelected: [extra({})] }))
    expect(r.base).toBe(100)
    expect(r.extras).toBe(40)
    expect(r.total).toBe(140)
  })

  it('additionne plusieurs extras + supplément ville d’arrivée', () => {
    const r = calculerPrixProduit(
      pricing,
      cfg({
        extrasSelected: [
          extra({ nom_option: 'Camel ride' }),
          extra({ nom_option: 'Quad', prix_adulte: 30, prix_enfant: 30 }),
        ],
        supplementVilleArrivee: 25,
      }),
    )
    expect(r.extras).toBe(40 + (30 * 2 + 30))
    expect(r.supplementVille).toBe(25)
    expect(r.total).toBe(100 + 130 + 25)
    expect(r.lignes).toHaveLength(4) // base + 2 extras + supplément
  })

  it('le mode privatif produit un total plus élevé que le groupe', () => {
    const groupe = calculerPrixProduit(pricing, cfg()).total
    const prive = calculerPrixProduit(pricing, cfg({ mode: 'PRIVE' })).total
    expect(prive).toBeGreaterThan(groupe)
  })
})

describe('pricingVariante', () => {
  it('retombe sur le produit quand l’option n’a pas de prix', () => {
    expect(pricingVariante(pricing, null)).toEqual(pricing)
    expect(pricingVariante(pricing, { prix_adulte: null } as never).prix_adulte).toBe(40)
  })
  it('utilise les prix propres de l’option', () => {
    expect(pricingVariante(pricing, { prix_adulte: 55 } as never).prix_adulte).toBe(55)
  })
})

const disc = (over: Partial<ProductDiscount>): ProductDiscount => ({
  id: 'd', excursion_id: 'e', variant_id: null, nom: 'Promo', type: 'PCT',
  valeur: 10, devise: 'EUR', permanente: true, date_debut: null, date_fin: null,
  actif: true, ...over,
})

describe('reductionActive', () => {
  it('permanente => toujours active', () => {
    expect(reductionActive(disc({}), '2026-07-11')).toBe(true)
  })
  it('respecte l’intervalle calendaire', () => {
    const d = disc({ permanente: false, date_debut: '2026-07-01', date_fin: '2026-07-31' })
    expect(reductionActive(d, '2026-06-30')).toBe(false)
    expect(reductionActive(d, '2026-07-15')).toBe(true)
    expect(reductionActive(d, '2026-08-01')).toBe(false)
  })
  it('inactive si désactivée', () => {
    expect(reductionActive(disc({ actif: false }), '2026-07-11')).toBe(false)
  })
})

describe('meilleureReduction', () => {
  it('ignore une réduction ciblée sur une autre option', () => {
    const r = meilleureReduction([disc({ variant_id: 'v2' })], 'v1', 100, '2026-07-11')
    expect(r).toBeNull()
  })
  it('applique une remise produit (toutes options)', () => {
    const r = meilleureReduction([disc({ valeur: 20 })], 'v1', 100, '2026-07-11')
    expect(r?.remise).toBe(20)
  })
  it('garde la meilleure remise et plafonne le montant fixe', () => {
    const r = meilleureReduction(
      [disc({ type: 'PCT', valeur: 10 }), disc({ type: 'MONTANT', valeur: 500 })],
      'v1', 100, '2026-07-11',
    )
    expect(r?.remise).toBe(100) // montant fixe plafonné au prix
  })
})

describe('prixAPartirDe', () => {
  it('prend le plus bas prix adulte groupe (produit + options)', () => {
    expect(prixAPartirDe(pricing, [{ prix_adulte: 30, actif: true } as never])).toBe(30)
    expect(prixAPartirDe(pricing, [{ prix_adulte: 30, actif: false } as never])).toBe(40)
  })
})

describe('promoAffichee', () => {
  it('retourne prix barré + prix promo + %', () => {
    const p = promoAffichee([disc({ valeur: 25 })], 'v1', 100, '2026-07-11')
    expect(p).toEqual({ prixBarre: 100, prixPromo: 75, pct: 25, nom: 'Promo' })
  })
  it('null sans promo active', () => {
    expect(promoAffichee([disc({ actif: false })], 'v1', 100, '2026-07-11')).toBeNull()
  })
})

describe('badgesProduit', () => {
  it('ajoute EN_PROMO quand une réduction est active', () => {
    const b = badgesProduit({ discounts: [disc({})], dateISO: '2026-07-11' })
    expect(b.some((x) => x.type === 'EN_PROMO')).toBe(true)
  })
  it('détecte early bird par le nom', () => {
    const b = badgesProduit({ discounts: [disc({ nom: 'Early birds -10%' })], dateISO: '2026-07-11' })
    expect(b.some((x) => x.type === 'EARLY_BIRD')).toBe(true)
  })
  it('signale bientôt complet selon les places restantes', () => {
    const b = badgesProduit({
      dateISO: '2026-07-11',
      departures: [{ statut: 'OUVERT', date_depart: '2026-07-20', capacite: 10, places_reservees: 8 } as never],
    })
    expect(b.some((x) => x.type === 'BIENTOT_COMPLET')).toBe(true)
  })
})

describe('placesRestantes', () => {
  it('null quand capacité illimitée', () => {
    expect(placesRestantes({ capacite: null, places_reservees: 3 } as never)).toBeNull()
  })
  it('ne descend jamais sous zéro', () => {
    expect(placesRestantes({ capacite: 5, places_reservees: 9 } as never)).toBe(0)
  })
})
