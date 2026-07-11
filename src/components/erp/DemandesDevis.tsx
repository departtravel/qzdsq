import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface Quote {
  id: string
  type: 'TEAM_BUILDING' | 'EVG' | 'EVJF' | 'MARIAGE' | 'CIRCUIT' | 'AUTRE'
  client_nom: string | null
  client_email: string | null
  client_telephone: string | null
  nb_personnes: number | null
  date_souhaitee: string | null
  ville_depart: string | null
  budget: number | null
  devise: string | null
  message: string | null
  details: any
  montant_estime: number | null
  statut: 'NOUVELLE' | 'EN_COURS' | 'DEVIS_ENVOYE' | 'GAGNE' | 'PERDU'
  lu: boolean
  created_at: string
}

const TYPE_LABEL: Record<Quote['type'], string> = {
  TEAM_BUILDING: '🤝 Team building', EVG: '🎉 EVG', EVJF: '💃 EVJF',
  MARIAGE: '💍 Mariage', CIRCUIT: '🗺️ Circuit sur mesure', AUTRE: 'Autre',
}
const STATUTS: Quote['statut'][] = ['NOUVELLE', 'EN_COURS', 'DEVIS_ENVOYE', 'GAGNE', 'PERDU']

export function DemandesDevis() {
  const [rows, setRows] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtre, setFiltre] = useState<string>('')
  const [selId, setSelId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('quote_requests').select('*').order('created_at', { ascending: false })
    if (error) setError(error.message)
    setRows((data as Quote[]) ?? [])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const open = async (q: Quote) => {
    setSelId(q.id)
    if (!q.lu) {
      await supabase.from('quote_requests').update({ lu: true }).eq('id', q.id)
      setRows((rs) => rs.map((r) => r.id === q.id ? { ...r, lu: true } : r))
    }
  }
  const setStatut = async (id: string, statut: Quote['statut']) => {
    await supabase.from('quote_requests').update({ statut, updated_at: new Date().toISOString() }).eq('id', id)
    setRows((rs) => rs.map((r) => r.id === id ? { ...r, statut } : r))
  }

  if (loading) return <p className="text-slate-500">Chargement des demandes…</p>
  if (error)
    return <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {error} — as-tu exécuté <code>supabase/devis.sql</code> ?
    </div>

  const filtered = filtre ? rows.filter((r) => r.type === filtre) : rows
  const sel = rows.find((r) => r.id === selId) ?? null

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Demandes de devis ({rows.filter((r) => !r.lu).length} nouvelle{rows.filter((r) => !r.lu).length > 1 ? 's' : ''})
        </h2>
        <select value={filtre} onChange={(e) => setFiltre(e.target.value)} className="rounded border border-slate-300 px-3 py-1.5 text-sm">
          <option value="">Tous les types</option>
          {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-3 py-2">Type</th><th className="px-3 py-2">Client</th>
              <th className="px-3 py-2">Pers.</th><th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Budget</th><th className="px-3 py-2">Statut</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((q) => (
              <tr key={q.id} onClick={() => open(q)}
                className={`cursor-pointer border-b last:border-0 hover:bg-purple-50 ${!q.lu ? 'font-medium' : ''}`}>
                <td className="whitespace-nowrap px-3 py-2">
                  {!q.lu && <span className="mr-1 inline-block h-2 w-2 rounded-full bg-purple-500 align-middle" />}
                  {TYPE_LABEL[q.type]}
                </td>
                <td className="px-3 py-2">{q.client_nom}<div className="text-xs text-slate-400">{q.client_email}</div></td>
                <td className="px-3 py-2">{q.nb_personnes ?? '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-500">{q.date_souhaitee ?? '—'}</td>
                <td className="px-3 py-2">{q.budget ? `${q.budget} ${q.devise ?? '€'}` : '—'}</td>
                <td className="px-3 py-2"><StatutBadge s={q.statut} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && <p className="mt-4 text-sm text-slate-500">Aucune demande.</p>}

      {sel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelId(null)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm text-slate-400">{TYPE_LABEL[sel.type]}</div>
                <h3 className="text-lg font-bold">{sel.client_nom}</h3>
              </div>
              <button onClick={() => setSelId(null)} className="text-slate-400">✕</button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <Info label="Email" value={sel.client_email} />
              <Info label="Téléphone" value={sel.client_telephone} />
              <Info label="Personnes" value={sel.nb_personnes?.toString()} />
              <Info label="Date souhaitée" value={sel.date_souhaitee} />
              <Info label="Ville départ" value={sel.ville_depart} />
              <Info label="Budget" value={sel.budget ? `${sel.budget} ${sel.devise ?? '€'}` : null} />
              {sel.montant_estime != null && <Info label="Estimation" value={`${sel.montant_estime} ${sel.devise ?? '€'}`} />}
            </div>
            {sel.message && <div className="mt-3"><div className="text-xs text-slate-400">Message</div><p className="whitespace-pre-line text-sm text-slate-700">{sel.message}</p></div>}
            {sel.details && (
              <div className="mt-3">
                <div className="text-xs text-slate-400">Détails de l'itinéraire</div>
                <pre className="mt-1 overflow-x-auto rounded bg-slate-50 p-2 text-xs text-slate-600">{JSON.stringify(sel.details, null, 2)}</pre>
              </div>
            )}
            <div className="mt-4">
              <div className="mb-1 text-xs text-slate-400">Statut</div>
              <div className="flex flex-wrap gap-1">
                {STATUTS.map((s) => (
                  <button key={s} onClick={() => setStatut(sel.id, s)}
                    className={`rounded px-3 py-1.5 text-xs ${sel.statut === s ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <a href={`mailto:${sel.client_email}`} className="mt-4 inline-block rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white">
              Répondre par email
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return <div><div className="text-xs text-slate-400">{label}</div><div className="text-slate-700">{value || '—'}</div></div>
}
function StatutBadge({ s }: { s: Quote['statut'] }) {
  const map: Record<Quote['statut'], string> = {
    NOUVELLE: 'bg-blue-100 text-blue-700', EN_COURS: 'bg-amber-100 text-amber-700',
    DEVIS_ENVOYE: 'bg-indigo-100 text-indigo-700', GAGNE: 'bg-green-100 text-green-700',
    PERDU: 'bg-slate-200 text-slate-500',
  }
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${map[s]}`}>{s}</span>
}
