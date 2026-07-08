import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Identifiants Supabase : d'abord depuis les variables d'env (build),
// sinon depuis ce que l'utilisateur a saisi dans l'écran de configuration
// (stocké dans le navigateur). Permet d'utiliser l'app en ligne sans
// recompiler : on colle simplement l'URL et la clé dans l'interface.
const LS_URL = 'dts_supabase_url'
const LS_KEY = 'dts_supabase_key'

function readConfig(): { url?: string; key?: string } {
  const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  if (envUrl && envKey) return { url: envUrl, key: envKey }
  try {
    return {
      url: localStorage.getItem(LS_URL) ?? undefined,
      key: localStorage.getItem(LS_KEY) ?? undefined,
    }
  } catch {
    return {}
  }
}

const { url, key } = readConfig()

export const isSupabaseConfigured = Boolean(url && key)

export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(url!, key!)
  : (null as unknown as SupabaseClient)

/** Enregistre les identifiants saisis dans l'interface puis recharge l'app. */
export function saveSupabaseConfig(newUrl: string, newKey: string) {
  localStorage.setItem(LS_URL, newUrl.trim())
  localStorage.setItem(LS_KEY, newKey.trim())
  location.reload()
}
