import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import type { FuelLog, Role, Vehicle, VehicleInput } from './lib/types'
import { Dashboard } from './components/Dashboard'
import { VehicleDetail } from './components/VehicleDetail'
import { VehicleForm } from './components/VehicleForm'
import { Login } from './components/Login'

type View = { name: 'dashboard' } | { name: 'detail'; id: string } | { name: 'new' }

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!isSupabaseConfigured) return <ConfigNotice />
  if (!authReady) return <Centered>Chargement…</Centered>
  if (!session) return <Login />
  return <FleetApp userId={session.user.id} email={session.user.email ?? ''} />
}

function FleetApp({ userId, email }: { userId: string; email: string }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [logsByVehicle, setLogsByVehicle] = useState<Record<string, FuelLog[]>>({})
  const [role, setRole] = useState<Role>('viewer')
  const [view, setView] = useState<View>({ name: 'dashboard' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isAdmin = role === 'admin'

  useEffect(() => {
    supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (data?.role) setRole(data.role as Role)
      })
  }, [userId])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [vRes, lRes] = await Promise.all([
      supabase.from('vehicles').select('*').order('matricule'),
      supabase.from('fuel_logs').select('*'),
    ])
    if (vRes.error) setError(vRes.error.message)
    setVehicles((vRes.data as Vehicle[]) ?? [])
    const grouped: Record<string, FuelLog[]> = {}
    for (const log of (lRes.data as FuelLog[]) ?? []) {
      ;(grouped[log.vehicle_id] ??= []).push(log)
    }
    setLogsByVehicle(grouped)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function createVehicle(input: VehicleInput) {
    const { error } = await supabase.from('vehicles').insert(input)
    if (error) throw new Error(error.message)
    await load()
    setView({ name: 'dashboard' })
  }

  const selected =
    view.name === 'detail' ? vehicles.find((v) => v.id === view.id) ?? null : null

  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3">
          <button onClick={() => setView({ name: 'dashboard' })} className="text-lg font-bold text-blue-700">
            🚚 Gestion de Flotte
          </button>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span className="hidden items-center gap-2 sm:flex">
              {email}
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium ${
                  isAdmin ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {isAdmin ? 'Admin' : 'Lecture seule'}
              </span>
            </span>
            <button onClick={() => supabase.auth.signOut()} className="rounded border border-slate-300 px-3 py-1.5 hover:bg-slate-50">
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {error && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error} — vérifie que le schéma SQL a bien été exécuté dans Supabase.
          </div>
        )}

        {loading ? (
          <p className="text-slate-500">Chargement…</p>
        ) : view.name === 'new' && isAdmin ? (
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-semibold">Nouveau véhicule</h2>
            <VehicleForm onSave={createVehicle} onCancel={() => setView({ name: 'dashboard' })} />
          </div>
        ) : view.name === 'detail' && selected ? (
          <VehicleDetail
            vehicle={selected}
            isAdmin={isAdmin}
            onBack={() => setView({ name: 'dashboard' })}
            onChanged={load}
          />
        ) : (
          <Dashboard
            vehicles={vehicles}
            logsByVehicle={logsByVehicle}
            isAdmin={isAdmin}
            onSelect={(v) => setView({ name: 'detail', id: v.id })}
            onAdd={() => setView({ name: 'new' })}
          />
        )}
      </main>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center text-slate-500">{children}</div>
}

function ConfigNotice() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
        <h1 className="mb-2 text-xl font-bold text-amber-900">Configuration requise</h1>
        <p className="mb-4 text-amber-800">
          L'application n'est pas encore connectée à Supabase. Pour démarrer :
        </p>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-amber-900">
          <li>
            Crée un projet sur{' '}
            <a className="underline" href="https://supabase.com" target="_blank" rel="noreferrer">
              supabase.com
            </a>
            .
          </li>
          <li>
            Dans <strong>SQL Editor</strong>, exécute le contenu de{' '}
            <code className="rounded bg-amber-100 px-1">supabase/schema.sql</code>.
          </li>
          <li>
            Dans <strong>Authentication → Users</strong>, crée au moins un compte.
          </li>
          <li>
            Copie <code className="rounded bg-amber-100 px-1">.env.example</code> en{' '}
            <code className="rounded bg-amber-100 px-1">.env</code> et renseigne{' '}
            <code className="rounded bg-amber-100 px-1">VITE_SUPABASE_URL</code> et{' '}
            <code className="rounded bg-amber-100 px-1">VITE_SUPABASE_ANON_KEY</code> (Settings → API).
          </li>
          <li>
            Relance <code className="rounded bg-amber-100 px-1">npm run dev</code>.
          </li>
        </ol>
      </div>
    </div>
  )
}
