import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Paramètres généraux (logo, nom, coordonnées) stockés dans app_settings.
export interface AppSettings {
  company_name: string
  company_mf: string // Matricule Fiscal (imprimé sur les factures)
  company_website: string // site web (pied de page des factures)
  company_info: string
  logo: string // data URL de l'image, ou ''
}

const DEFAULTS: AppSettings = {
  company_name: 'Depart Travel Services',
  company_mf: '1612019Y',
  company_website: 'www.depart-travel-services.com',
  company_info: '',
  logo: '',
}

export async function loadSettings(): Promise<AppSettings> {
  const { data } = await supabase.from('app_settings').select('key, value')
  const s = { ...DEFAULTS }
  for (const row of (data as { key: string; value: string | null }[] | null) ?? []) {
    if (row.key in s) (s as Record<string, string>)[row.key] = row.value ?? ''
  }
  return s
}

export async function saveSetting(key: keyof AppSettings, value: string) {
  return supabase.from('app_settings').upsert(
    { key, value, updated_at: new Date().toISOString() },
    { onConflict: 'key' },
  )
}

/** Hook lecture seule : récupère les paramètres (utilisé par les documents). */
export function useSettings(): AppSettings {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS)
  useEffect(() => {
    loadSettings().then(setSettings)
  }, [])
  return settings
}
