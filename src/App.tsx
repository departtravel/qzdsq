import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import type { Person, PersonInput, Role } from './lib/types'
import { uploadDocument } from './lib/storage'
import { Dashboard } from './components/Dashboard'
import { PersonDetail } from './components/PersonDetail'
import { PersonForm } from './components/PersonForm'
import { Login } from './components/Login'

const APP_NAME = '🛂 Centre & Rapatriement'

type View =
  | { name: 'dashboard' }
  | { name: 'detail'; id: string }
  | { name: 'new' }
  | { name: 'edit'; id: string }

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
  return <CenterApp email={session.user.email ?? ''} userId={session.user.id} />
}

function CenterApp({ email, userId }: { email: string; userId: string }) {
  const [persons, setPersons] = useState<Person[]>([])
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
    const { data, error } = await supabase
      .from('persons')
      .select('*')
      .order('entry_at', { ascending: false })
    if (error) setError(error.message)
    setPersons((data as Person[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function uploadFiles(personId: string, files: File[], docType: PersonInput['doc_type']) {
    for (const file of files) {
      const path = await uploadDocument(personId, file)
      const { error } = await supabase.from('person_documents').insert({
        person_id: personId,
        label: file.name,
        doc_type: docType,
        storage_path: path,
        mime: file.type || null,
        size_bytes: file.size,
      })
      if (error) throw new Error(error.message)
    }
  }

  async function createPerson(input: PersonInput, files: File[]) {
    const { data, error } = await supabase.from('persons').insert(input).select('id').single()
    if (error) throw new Error(error.message)
    const personId = (data as { id: string }).id
    await uploadFiles(personId, files, input.doc_type)
    await load()
    setView({ name: 'detail', id: personId })
  }

  async function updatePerson(id: string, input: PersonInput, files: File[]) {
    const { error } = await supabase.from('persons').update(input).eq('id', id)
    if (error) throw new Error(error.message)
    await uploadFiles(id, files, input.doc_type)
    await load()
    setView({ name: 'detail', id })
  }

  const current =
    view.name === 'detail' || view.name === 'edit'
      ? persons.find((p) => p.id === view.id) ?? null
      : null

  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3">
          <button
            onClick={() => setView({ name: 'dashboard' })}
            className="text-lg font-bold text-blue-700"
          >
            {APP_NAME}
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
            <button
              onClick={() => supabase.auth.signOut()}
              className="rounded border border-slate-300 px-3 py-1.5 hover:bg-slate-50"
            >
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
            <h2 className="mb-4 text-lg font-semibold">Nouvelle personne</h2>
            <PersonForm onSave={createPerson} onCancel={() => setView({ name: 'dashboard' })} />
          </div>
        ) : view.name === 'edit' && current && isAdmin ? (
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-semibold">Modifier la fiche</h2>
            <PersonForm
              initial={current}
              onSave={(input, files) => updatePerson(current.id, input, files)}
              onCancel={() => setView({ name: 'detail', id: current.id })}
            />
          </div>
        ) : view.name === 'detail' && current ? (
          <PersonDetail
            person={current}
            isAdmin={isAdmin}
            onBack={() => setView({ name: 'dashboard' })}
            onEdit={() => setView({ name: 'edit', id: current.id })}
            onChanged={load}
          />
        ) : (
          <Dashboard
            persons={persons}
            isAdmin={isAdmin}
            onSelect={(p) => setView({ name: 'detail', id: p.id })}
            onAdd={() => setView({ name: 'new' })}
          />
        )}
      </main>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center text-slate-500">{children}</div>
  )
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
            Vérifie que le bucket privé{' '}
            <code className="rounded bg-amber-100 px-1">person-documents</code> existe (créé par le
            script).
          </li>
          <li>
            Dans <strong>Authentication → Users</strong>, crée au moins un compte.
          </li>
          <li>
            Copie <code className="rounded bg-amber-100 px-1">.env.example</code> en{' '}
            <code className="rounded bg-amber-100 px-1">.env</code> et renseigne{' '}
            <code className="rounded bg-amber-100 px-1">VITE_SUPABASE_URL</code> et{' '}
            <code className="rounded bg-amber-100 px-1">VITE_SUPABASE_ANON_KEY</code>.
          </li>
          <li>
            Relance <code className="rounded bg-amber-100 px-1">npm run dev</code>.
          </li>
        </ol>
      </div>
    </div>
  )
}
