import { useState } from 'react'
import { isRuntimeConfig, resetSupabaseConfig, supabase } from '../lib/supabase'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function signIn(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setInfo(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(traduire(error.message))
    setLoading(false)
  }

  async function resetPassword() {
    if (!email) {
      setError('Saisis ton email pour réinitialiser le mot de passe.')
      return
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) setError(traduire(error.message))
    else setInfo('Email de réinitialisation envoyé (si le compte existe).')
  }

  const input = 'w-full rounded border border-slate-300 px-3 py-2 text-sm'

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={signIn} className="w-full max-w-sm rounded-lg bg-white p-8 shadow">
        <h1 className="mb-1 text-xl font-bold text-blue-700">🚚 Gestion de Flotte</h1>
        <p className="mb-6 text-sm text-slate-500">Connecte-toi pour continuer.</p>

        {error && (
          <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        {info && (
          <div className="mb-3 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            {info}
          </div>
        )}

        <label className="mb-1 block text-xs font-medium text-slate-600">Email</label>
        <input
          type="email"
          className={`${input} mb-3`}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <label className="mb-1 block text-xs font-medium text-slate-600">Mot de passe</label>
        <input
          type="password"
          className={`${input} mb-4`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>
        <button
          type="button"
          onClick={resetPassword}
          className="mt-3 w-full text-center text-xs text-slate-500 hover:underline"
        >
          Mot de passe oublié ?
        </button>
        <p className="mt-4 text-center text-xs text-slate-400">
          Les comptes sont créés dans Supabase → Authentication → Users.
        </p>
        {isRuntimeConfig && (
          <button
            type="button"
            onClick={resetSupabaseConfig}
            className="mt-2 w-full text-center text-xs text-slate-400 hover:underline"
          >
            Changer de projet Supabase
          </button>
        )}
      </form>
    </div>
  )
}

function traduire(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return 'Email ou mot de passe incorrect.'
  if (/email not confirmed/i.test(msg)) return 'Email non confirmé.'
  return msg
}
