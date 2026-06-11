export type Role = 'admin' | 'viewer'

export interface Profile {
  id: string
  email: string | null
  role: Role
  created_at: string
}

/** Situation administrative de la personne. */
export type Situation = 'identifie' | 'non_identifie' | 'en_investigation' | 'rapatrie'

/** Type de document d'identité fourni. */
export type DocType = 'cin' | 'passeport' | 'laissez_passer' | 'aucun'

export type Sexe = 'M' | 'F' | 'autre'

export interface Person {
  id: string
  first_name: string
  last_name: string
  sexe: Sexe | null
  birth_date: string | null
  nationality: string | null
  nationality_presumed: boolean
  doc_type: DocType
  passport_number: string | null
  doc_country: string | null
  situation: Situation
  entry_at: string
  exit_at: string | null
  remark: string | null
  repatriation_country: string | null
  repatriation_date: string | null
  created_at: string
  created_by: string | null
}

/** Champs saisis par l'utilisateur (sans les colonnes gérées par la base). */
export type PersonInput = Omit<Person, 'id' | 'created_at' | 'created_by'>

export interface PersonDocument {
  id: string
  person_id: string
  label: string
  doc_type: DocType
  storage_path: string
  mime: string | null
  size_bytes: number | null
  uploaded_at: string
}

export const SITUATION_LABEL: Record<Situation, string> = {
  identifie: 'Identifié',
  non_identifie: 'Non identifié',
  en_investigation: 'En investigation',
  rapatrie: 'Rapatrié',
}

export const DOC_TYPE_LABEL: Record<DocType, string> = {
  cin: 'CIN',
  passeport: 'Passeport',
  laissez_passer: 'Laissez-passer',
  aucun: 'Aucun document',
}
