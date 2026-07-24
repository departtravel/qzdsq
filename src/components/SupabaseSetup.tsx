import { useState } from 'react'
import { saveSupabaseConfig } from '../lib/supabase'

// Écran affiché au 1er lancement (app de bureau ou web sans config de build).
// L'utilisateur colle l'URL et la clé « anon public » de SON projet Supabase.
export function SupabaseSetup() {
  const [url, setUrl] = useState('')
  const [key, setKey] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const u = url.trim()
    const k = key.trim()
    if (!/^https:\/\/.+\.supabase\.co/.test(u)) {
      setError("L'URL doit ressembler à https://xxxx.supabase.co")
      return
    }
    if (k.length < 30) {
      setError('La clé anon semble incorrecte (trop courte).')
      return
    }
    saveSupabaseConfig(u, k)
  }

  const input = 'w-full rounded border border-slate-300 px-3 py-2 text-sm'

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-bold text-blue-800">⛽ Contrôle Gasoil — connexion</h1>
        <p className="mb-4 text-sm text-slate-600">
          Première utilisation : reliez l'application à votre base de données Supabase
          (vos données restent chez vous, dans votre projet). À faire une seule fois.
        </p>

        <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-slate-600">
          <li>
            Ouvrez votre projet sur{' '}
            <a className="text-blue-600 underline" href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">
              supabase.com
            </a>{' '}
            → <b>Settings</b> → <b>API</b>.
          </li>
          <li>Copiez le <b>Project URL</b> et la clé <b>anon public</b> ci-dessous.</li>
        </ol>

        <form onSubmit={submit} className="space-y-3">
          {error && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Project URL</label>
            <input className={input} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxxxxxx.supabase.co" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Clé anon public</label>
            <textarea className={`${input} h-24 font-mono text-xs`} value={key} onChange={(e) => setKey(e.target.value)} placeholder="eyJhbGciOiJ..." />
          </div>
          <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Connecter l'application
          </button>
        </form>

        <p className="mt-4 text-xs text-slate-400">
          La clé « anon » est publique par conception : la sécurité est assurée par les règles
          d'accès (RLS) de votre base. N'utilisez jamais la clé « service_role » ici.
        </p>
      </div>
    </div>
  )
}
