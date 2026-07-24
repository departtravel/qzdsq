import { createClient } from '@supabase/supabase-js'

// ============================================================
//  Connexion Supabase
//  La configuration peut venir de deux sources :
//   1. Variables de build  (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
//   2. Saisie de l'utilisateur au 1er lancement (stockée en localStorage)
//  → l'installeur de bureau est donc UNIVERSEL : on télécharge l'app,
//    on colle son URL + clé Supabase une seule fois, et c'est prêt.
// ============================================================

const LS_URL = 'sb_url'
const LS_KEY = 'sb_anon_key'

function fromStorage(name: string): string {
  try {
    return localStorage.getItem(name) ?? ''
  } catch {
    return ''
  }
}

const url =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) || fromStorage(LS_URL)
const anonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || fromStorage(LS_KEY)

export const isSupabaseConfigured = Boolean(url && anonKey)

/** Enregistre la config saisie par l'utilisateur puis recharge l'app. */
export function saveSupabaseConfig(newUrl: string, newKey: string) {
  localStorage.setItem(LS_URL, newUrl.trim())
  localStorage.setItem(LS_KEY, newKey.trim())
  location.reload()
}

/** Efface la config (bouton « changer de projet Supabase »). */
export function resetSupabaseConfig() {
  localStorage.removeItem(LS_URL)
  localStorage.removeItem(LS_KEY)
  location.reload()
}

/** true si la config vient d'une saisie utilisateur (et non du build). */
export const isRuntimeConfig = !import.meta.env.VITE_SUPABASE_URL && Boolean(url)

export const supabase = isSupabaseConfigured
  ? createClient(url!, anonKey!)
  : // Client factice : évite un crash avant configuration.
    (null as unknown as ReturnType<typeof createClient>)
