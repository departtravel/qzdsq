/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_LOCAL_MODE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Import de fichiers SQL en texte brut (schéma local PGlite).
declare module '*.sql?raw' {
  const content: string
  export default content
}
