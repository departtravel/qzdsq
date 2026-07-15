import { createClient } from '@supabase/supabase-js'
import { createLocalClient } from './localdb/client'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// Mode 100% hors-ligne : base Postgres embarquée (PGlite), aucune
// connexion réseau. Activé par VITE_LOCAL_MODE=true (build desktop local).
export const isLocalMode = (import.meta.env.VITE_LOCAL_MODE as string | undefined) === 'true'

// Configuré = mode local OU identifiants Supabase renseignés.
export const isSupabaseConfigured = isLocalMode || Boolean(url && anonKey)

export const supabase = isLocalMode
  ? (createLocalClient() as unknown as ReturnType<typeof createClient>)
  : isSupabaseConfigured
    ? createClient(url!, anonKey!)
    : // Client factice : évite un crash avant configuration.
      (null as unknown as ReturnType<typeof createClient>)
