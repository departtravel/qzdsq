import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface Conversation {
  id: string
  client_nom: string | null
  client_email: string | null
  client_telephone: string | null
  sujet: string | null
  statut: 'OUVERTE' | 'EN_COURS' | 'FERMEE'
  lu: boolean
  updated_at: string
}
interface Message {
  id: string
  conversation_id: string
  expediteur: 'CLIENT' | 'AGENCE'
  corps: string
  created_at: string
}

// Boîte de réception des messages clients (contact depuis la vitrine).
export function Messagerie() {
  const [convs, setConvs] = useState<Conversation[]>([])
  const [selId, setSelId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [reponse, setReponse] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadConvs = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .order('updated_at', { ascending: false })
    if (error) setError(error.message)
    setConvs((data as Conversation[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadConvs() }, [loadConvs])

  const openConv = async (id: string) => {
    setSelId(id)
    const { data } = await supabase
      .from('messages').select('*').eq('conversation_id', id).order('created_at')
    setMessages((data as Message[]) ?? [])
    const conv = convs.find((c) => c.id === id)
    if (conv && !conv.lu) {
      await supabase.from('conversations').update({ lu: true }).eq('id', id)
      setConvs((cs) => cs.map((c) => c.id === id ? { ...c, lu: true } : c))
    }
  }

  const envoyer = async () => {
    if (!selId || !reponse.trim()) return
    const corps = reponse.trim()
    setReponse('')
    const { error } = await supabase.from('messages').insert({
      conversation_id: selId, expediteur: 'AGENCE', corps,
    })
    if (error) { setError(error.message); return }
    await supabase.from('conversations')
      .update({ statut: 'EN_COURS', updated_at: new Date().toISOString() }).eq('id', selId)
    // Email de la réponse au client (best-effort).
    const conv = convs.find((c) => c.id === selId)
    if (conv?.client_email) {
      try {
        await supabase.functions.invoke('send-email', {
          body: { type: 'reply', data: { client_nom: conv.client_nom, client_email: conv.client_email, message: corps } },
        })
      } catch { /* silencieux */ }
    }
    openConv(selId)
    loadConvs()
  }

  const changerStatut = async (statut: Conversation['statut']) => {
    if (!selId) return
    await supabase.from('conversations').update({ statut }).eq('id', selId)
    setConvs((cs) => cs.map((c) => c.id === selId ? { ...c, statut } : c))
  }

  const sel = convs.find((c) => c.id === selId) ?? null

  if (loading) return <p className="text-slate-500">Chargement des messages…</p>
  if (error)
    return <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {error} — as-tu exécuté <code>supabase/messagerie.sql</code> ?
    </div>

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">
        Messagerie ({convs.filter((c) => !c.lu).length} non lu{convs.filter((c) => !c.lu).length > 1 ? 's' : ''})
      </h2>
      <div className="grid gap-4 md:grid-cols-3">
        {/* Liste */}
        <div className="space-y-1 md:col-span-1">
          {convs.length === 0 && <p className="text-sm text-slate-500">Aucun message.</p>}
          {convs.map((c) => (
            <button key={c.id} onClick={() => openConv(c.id)}
              className={`w-full rounded-lg border p-3 text-left text-sm ${selId === c.id ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
              <div className="flex items-center justify-between">
                <span className={`font-medium ${!c.lu ? 'text-slate-900' : 'text-slate-600'}`}>
                  {!c.lu && <span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-500 align-middle" />}
                  {c.client_nom || 'Client'}
                </span>
                <StatutBadge statut={c.statut} />
              </div>
              <div className="mt-0.5 truncate text-xs text-slate-400">{c.client_email}</div>
            </button>
          ))}
        </div>

        {/* Fil */}
        <div className="md:col-span-2">
          {!sel ? (
            <p className="text-sm text-slate-500">Sélectionne une conversation.</p>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div>
                  <div className="font-medium">{sel.client_nom}</div>
                  <div className="text-xs text-slate-400">
                    {sel.client_email}{sel.client_telephone ? ` · ${sel.client_telephone}` : ''}
                  </div>
                </div>
                <select value={sel.statut} onChange={(e) => changerStatut(e.target.value as never)}
                  className="rounded border border-slate-300 px-2 py-1 text-xs">
                  <option value="OUVERTE">Ouverte</option>
                  <option value="EN_COURS">En cours</option>
                  <option value="FERMEE">Fermée</option>
                </select>
              </div>

              <div className="max-h-96 space-y-2 overflow-y-auto p-4">
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.expediteur === 'AGENCE' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.expediteur === 'AGENCE' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-700'}`}>
                      {m.corps}
                      <div className={`mt-1 text-[10px] ${m.expediteur === 'AGENCE' ? 'text-white/70' : 'text-slate-400'}`}>
                        {new Date(m.created_at).toLocaleString('fr-FR')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 border-t p-3">
                <input value={reponse} onChange={(e) => setReponse(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && envoyer()}
                  placeholder="Votre réponse…" className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <button onClick={envoyer} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600">
                  Envoyer
                </button>
              </div>
              <p className="px-3 pb-3 text-xs text-slate-400">
                Réponse enregistrée. (Envoi email/WhatsApp automatique : à brancher plus tard.)
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatutBadge({ statut }: { statut: Conversation['statut'] }) {
  const map = {
    OUVERTE: 'bg-blue-100 text-blue-700',
    EN_COURS: 'bg-amber-100 text-amber-700',
    FERMEE: 'bg-slate-200 text-slate-500',
  }
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${map[statut]}`}>{statut}</span>
}
