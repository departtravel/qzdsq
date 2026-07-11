import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface Review {
  id: string
  excursion_id: string
  client_nom: string
  pays: string | null
  note: number
  commentaire: string | null
  statut: 'EN_ATTENTE' | 'PUBLIE' | 'REJETE'
  created_at: string
}

export function AvisModeration() {
  const [rows, setRows] = useState<Review[]>([])
  const [noms, setNoms] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtre, setFiltre] = useState<Review['statut'] | ''>('EN_ATTENTE')

  const load = useCallback(async () => {
    setLoading(true)
    const [rv, ex] = await Promise.all([
      supabase.from('reviews').select('*').order('created_at', { ascending: false }),
      supabase.from('excursions').select('id, nom'),
    ])
    if (rv.error) setError(rv.error.message)
    setRows((rv.data as Review[]) ?? [])
    const m: Record<string, string> = {}
    for (const e of (ex.data as any[]) ?? []) m[e.id] = e.nom
    setNoms(m)
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const setStatut = async (id: string, statut: Review['statut']) => {
    await supabase.from('reviews').update({ statut }).eq('id', id)
    setRows((rs) => rs.map((r) => r.id === id ? { ...r, statut } : r))
  }

  if (loading) return <p className="text-slate-500">Chargement des avis…</p>
  if (error)
    return <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {error} — as-tu exécuté <code>supabase/avis.sql</code> ?
    </div>

  const filtered = filtre ? rows.filter((r) => r.statut === filtre) : rows
  const nAttente = rows.filter((r) => r.statut === 'EN_ATTENTE').length

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Avis clients {nAttente > 0 && <span className="text-amber-600">({nAttente} à modérer)</span>}</h2>
        <select value={filtre} onChange={(e) => setFiltre(e.target.value as never)} className="rounded border border-slate-300 px-3 py-1.5 text-sm">
          <option value="EN_ATTENTE">À modérer</option>
          <option value="PUBLIE">Publiés</option>
          <option value="REJETE">Rejetés</option>
          <option value="">Tous</option>
        </select>
      </div>

      <div className="space-y-2">
        {filtered.map((r) => (
          <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm text-slate-400">{noms[r.excursion_id] ?? '—'}</div>
                <div className="font-medium">{'★'.repeat(r.note)}<span className="text-slate-300">{'★'.repeat(5 - r.note)}</span> · {r.client_nom}{r.pays ? ` · ${r.pays}` : ''}</div>
              </div>
              <StatutBadge s={r.statut} />
            </div>
            {r.commentaire && <p className="mt-2 text-sm text-slate-600">“{r.commentaire}”</p>}
            <div className="mt-3 flex gap-2">
              {r.statut !== 'PUBLIE' && <button onClick={() => setStatut(r.id, 'PUBLIE')} className="rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white">Publier</button>}
              {r.statut !== 'REJETE' && <button onClick={() => setStatut(r.id, 'REJETE')} className="rounded bg-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600">Rejeter</button>}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-sm text-slate-500">Aucun avis.</p>}
      </div>
    </div>
  )
}

function StatutBadge({ s }: { s: Review['statut'] }) {
  const map = { EN_ATTENTE: 'bg-amber-100 text-amber-700', PUBLIE: 'bg-green-100 text-green-700', REJETE: 'bg-slate-200 text-slate-500' }
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${map[s]}`}>{s}</span>
}
