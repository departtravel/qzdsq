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

// Champs éditables (sans id / created_at)
export type VehicleInput = Omit<Vehicle, 'id' | 'created_at'>
export type FuelLogInput = Omit<FuelLog, 'id' | 'created_at'>
export type MaintenanceLogInput = Omit<MaintenanceLog, 'id' | 'created_at'>
