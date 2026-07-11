// Jeu de démonstration affiché UNIQUEMENT quand Supabase n'est pas connecté,
// pour que la vitrine soit vivante (et présentable) avant le branchement réel.
import type { CatalogItem } from './data'
import type { City } from '../lib/produits'

const city = (id: string, nom: string): City => ({ id, nom, pays: 'Tunisie', actif: true })

export const DEMO_CITIES: City[] = [
  city('c1', 'Tunis'), city('c2', 'Djerba'), city('c3', 'Douz'),
  city('c4', 'Tozeur'), city('c5', 'Hammamet'), city('c6', 'Sousse'),
  city('c7', 'Kairouan'), city('c8', 'Tataouine'),
]

let seq = 0
function item(
  nom: string, categorie: string, duree: string, prix: number,
  opts: { note?: number; avis?: number; best?: boolean; promo?: number; depart?: string[] } = {},
): CatalogItem {
  const id = `demo-${++seq}`
  return {
    excursion: {
      id, code_interne: id, nom, categorie, duree, destination: nom,
      nombre_jours: /jour/.test(duree) ? Number(duree) || 1 : 1,
      ville_depart: opts.depart?.[0] ?? 'Tunis', devise: 'EUR', statut: 'ACTIVE',
      prix_adulte: prix, prix_enfant: Math.round(prix * 0.6), prix_bebe: 0,
      commission_ota: 30, taux_conversion: 3.34,
      note_moyenne: opts.note ?? null, nb_avis: opts.avis ?? 0, best_seller: !!opts.best,
    } as any,
    translations: [],
    variants: [],
    discounts: opts.promo
      ? [{ id: `d-${id}`, excursion_id: id, variant_id: null, nom: 'Offre', type: 'PCT', valeur: opts.promo, devise: 'EUR', permanente: true, date_debut: null, date_fin: null, actif: true }]
      : [],
    departures: [],
    cities: (opts.depart ?? ['Tunis']).map((cn) => ({
      id: `pc-${id}-${cn}`, excursion_id: id,
      city_id: DEMO_CITIES.find((c) => c.nom === cn)?.id ?? 'c1',
      role: 'DEPART' as const, supplement: 0, devise: 'EUR', par_defaut: false,
    })),
  }
}

export const DEMO_ITEMS: CatalogItem[] = [
  item('Ksar Ghilane — 1 jour désert & sources chaudes', 'Désert', 'journée', 79, { note: 4.8, avis: 342, best: true, depart: ['Djerba', 'Douz'] }),
  item('Sahara 2 jours : dunes de Douz & bivouac', 'Désert', '2 jours', 189, { note: 4.9, avis: 210, best: true, promo: 15, depart: ['Tunis', 'Douz'] }),
  item('Médina de Kairouan & El Jem', 'Culture', 'journée', 55, { note: 4.6, avis: 128, depart: ['Sousse', 'Hammamet'] }),
  item('Oasis de Tozeur & Chott El Jérid', 'Oasis', 'journée', 69, { note: 4.7, avis: 96, promo: 10, depart: ['Tozeur'] }),
  item('Djerba : tour de l’île en 4×4', 'Mer', 'journée', 49, { note: 4.5, avis: 174, depart: ['Djerba'] }),
  item('Quad & coucher de soleil à Hammamet', 'Aventure', 'demi-journée', 39, { note: 4.4, avis: 63, depart: ['Hammamet'] }),
  item('Grand Sud 3 jours : Matmata, Ksour & Sahara', 'Désert', '3 jours', 320, { note: 4.9, avis: 88, best: true, depart: ['Djerba', 'Tataouine'] }),
  item('Carthage & Sidi Bou Saïd', 'Culture', 'demi-journée', 45, { note: 4.6, avis: 205, depart: ['Tunis'] }),
]
