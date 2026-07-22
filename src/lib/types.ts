export type Role = 'admin' | 'viewer'

export interface Profile {
  id: string
  email: string | null
  role: Role
  created_at: string
}

export interface Vehicle {
  id: string
  matricule: string
  marque: string | null
  modele: string | null
  chauffeur: string | null
  actif: boolean
  conso_normale: number
  seuil_alerte_pct: number
  date_vidange: string | null
  km_vidange: number | null
  vidange_interval_km: number | null
  vidange_interval_mois: number | null
  date_distribution: string | null
  km_distribution: number | null
  distribution_interval_km: number | null
  date_assurance: string | null
  date_visite_technique: string | null
  date_vignette: string | null
  created_at: string
}

export interface FuelLog {
  id: string
  vehicle_id: string
  date: string
  km: number
  litres: number
  prix_litre: number | null
  montant: number | null
  plein_complet: boolean
  note: string | null
  created_at: string
}

export interface MaintenanceLog {
  id: string
  vehicle_id: string
  date: string
  km: number | null
  type: string
  cout: number | null
  note: string | null
  created_at: string
}

export type Carburant = 'gasoil' | 'essence'

/** Chauffeur (référentiel partagé avec l'ERP). */
export interface Chauffeur {
  id: string
  nom: string
  prenom: string | null
  telephone: string | null
  cin: string | null
  permis: string | null
  type_chauffeur: string
  actif: boolean
  created_at: string
}

/** Excursion / circuit type, avec distance de référence pour comparer. */
export interface GasoilExcursion {
  id: string
  nom: string
  km_reference: number | null
  actif: boolean
  created_at: string
}

/** Carnet de bord : une sortie / excursion (chauffeur + km + carburant). */
export interface Trip {
  id: string
  vehicle_id: string
  date: string
  chauffeur: string | null
  chauffeur_id: string | null
  excursion: string | null
  excursion_id: string | null
  km_depart: number
  km_arrivee: number
  carburant: Carburant
  litres: number
  prix_litre: number | null
  montant: number | null
  lieux_prise_en_charge: string | null
  ticket_url: string | null
  note: string | null
  created_at: string
}

/** Plein d'AdBlue avec autonomie habituelle attendue (saisie manuelle). */
export interface AdblueLog {
  id: string
  vehicle_id: string
  date: string
  litres: number
  km_compteur: number
  autonomie_km: number
  note: string | null
  created_at: string
}

// Champs éditables (sans id / created_at)
export type VehicleInput = Omit<Vehicle, 'id' | 'created_at'>
export type FuelLogInput = Omit<FuelLog, 'id' | 'created_at'>
export type MaintenanceLogInput = Omit<MaintenanceLog, 'id' | 'created_at'>
export type TripInput = Omit<Trip, 'id' | 'created_at'>
export type AdblueLogInput = Omit<AdblueLog, 'id' | 'created_at'>
export type ChauffeurInput = Omit<Chauffeur, 'id' | 'created_at'>
export type GasoilExcursionInput = Omit<GasoilExcursion, 'id' | 'created_at'>
