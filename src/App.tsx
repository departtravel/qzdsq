import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase, saveSupabaseConfig } from './lib/supabase'
import type { FuelLog, Role, Vehicle, VehicleInput } from './lib/types'
import { Dashboard } from './components/Dashboard'
import { VehicleDetail } from './components/VehicleDetail'
import { VehicleForm } from './components/VehicleForm'
import { Login } from './components/Login'
import { Excursions } from './components/erp/Excursions'
import { Reservations } from './components/erp/Reservations'
import { Planning } from './components/erp/Planning'
import { Comptabilite } from './components/erp/Comptabilite'
import { DashboardDirection } from './components/erp/DashboardDirection'
import { ImportOTA } from './components/erp/ImportOTA'
import { IAAnalytics } from './components/erp/IAAnalytics'
import { Referentiels } from './components/erp/Referentiels'
import { OrdreMission } from './components/erp/OrdreMission'
import { FicheReservation } from './components/erp/FicheReservation'
import { Utilisateurs } from './components/erp/Utilisateurs'
import { Parametres } from './components/erp/Parametres'
import { RelevePartenaire } from './components/erp/RelevePartenaire'

type View = { name: 'dashboard' } | { name: 'detail'; id: string } | { name: 'new' }
type Section =
  | 'flotte'
  | 'excursions'
  | 'reservations'
  | 'planning'
  | 'comptabilite'
  | 'dashboard'
  | 'importota'
  | 'ia'
  | 'referentiels'
  | 'ordremission'
  | 'fichereservation'
  | 'utilisateurs'
  | 'parametres'
  | 'relevepartenaire'

const ERP_SECTIONS: { key: Section; emoji: string; label: string }[] = [
  { key: 'excursions', emoji: '🧭', label: 'Excursions' },
  { key: 'reservations', emoji: '📅', label: 'Réservations' },
  { key: 'planning', emoji: '📆', label: 'Planning' },
  { key: 'ordremission', emoji: '📋', label: 'Ordre de mission' },
  { key: 'fichereservation', emoji: '🗒️', label: 'Réservations à effectuer' },
  { key: 'comptabilite', emoji: '💰', label: 'Comptabilité' },
  { key: 'relevepartenaire', emoji: '🧾', label: 'Relevé prestataire' },
  { key: 'dashboard', emoji: '📊', label: 'Direction' },
  { key: 'importota', emoji: '📥', label: 'Import OTA' },
  { key: 'ia', emoji: '🧠', label: 'IA Analytique' },
  { key: 'referentiels', emoji: '📇', label: 'Référentiels' },
  { key: 'utilisateurs', emoji: '🔐', label: 'Utilisateurs' },
  { key: 'parametres', emoji: '⚙️', label: 'Paramètres' },
]

const ERP_COMPONENTS: Record<Exclude<Section, 'flotte'>, JSX.Element> = {
  excursions: <Excursions />,
  reservations: <Reservations />,
  planning: <Planning />,
  ordremission: <OrdreMission />,
  fichereservation: <FicheReservation />,
  comptabilite: <Comptabilite />,
  dashboard: <DashboardDirection />,
  importota: <ImportOTA />,
  ia: <IAAnalytics />,
  referentiels: <Referentiels />,
  utilisateurs: <Utilisateurs />,
  parametres: <Parametres />,
  relevepartenaire: <RelevePartenaire />,
}

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
  const [section, setSection] = useState<Section>('flotte')
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
          <div className="flex items-center gap-4">
            <span className="text-lg font-bold text-blue-700">DTS Operation ERP</span>
            <nav className="flex gap-1 text-sm">
              <button
                onClick={() => { setSection('flotte'); setView({ name: 'dashboard' }) }}
                className={`rounded px-3 py-1.5 ${section === 'flotte' ? 'bg-blue-100 font-medium text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                🚚 Flotte
              </button>
              {ERP_SECTIONS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSection(s.key)}
                  className={`rounded px-3 py-1.5 ${section === s.key ? 'bg-blue-100 font-medium text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  {s.emoji} {s.label}
                </button>
              ))}
            </nav>
          </div>
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

        {section !== 'flotte' ? (
          ERP_COMPONENTS[section]
        ) : loading ? (
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
  const [url, setUrl] = useState('')
  const [key, setKey] = useState('')
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="mb-6 rounded-lg border border-blue-200 bg-white p-6 shadow">
        <h1 className="mb-1 text-xl font-bold text-slate-900">Connexion à Supabase</h1>
        <p className="mb-4 text-sm text-slate-600">
          Colle ici l'URL et la clé <strong>anon public</strong> de ton projet Supabase
          (Supabase → Settings → API). Elles sont enregistrées dans ce navigateur.
        </p>
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-500">Project URL</span>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://xxxx.supabase.co"
              className="w-full rounded border border-slate-300 px-2 py-1.5"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-500">Clé anon public</span>
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="eyJhbG..."
              className="w-full rounded border border-slate-300 px-2 py-1.5"
            />
          </label>
          <button
            disabled={!url || !key}
            onClick={() => saveSupabaseConfig(url, key)}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Connecter
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
        <h2 className="mb-2 text-lg font-bold text-amber-900">Étapes de mise en place</h2>
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
