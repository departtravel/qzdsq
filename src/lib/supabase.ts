import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// Permet à l'app d'afficher un message clair tant que .env n'est pas rempli.
export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase = isSupabaseConfigured
  ? createClient(url!, anonKey!)
  : // Client factice : évite un crash avant configuration.
    (null as unknown as ReturnType<typeof createClient>)
