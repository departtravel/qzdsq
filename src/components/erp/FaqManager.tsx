import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface Faq {
  id: string
  excursion_id: string | null
  question: string
  reponse: string
  categorie: string | null
  ordre: number
  actif: boolean
}

export function FaqManager() {
  const [rows, setRows] = useState<Faq[]>([])
  const [excursions, setExcursions] = useState<{ id: string; nom: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<Faq> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [f, e] = await Promise.all([
      supabase.from('faqs').select('*').order('ordre'),
      supabase.from('excursions').select('id, nom').order('nom'),
    ])
    if (f.error) setError(f.error.message)
    setRows((f.data as Faq[]) ?? [])
    setExcursions((e.data as any[]) ?? [])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!draft?.question || !draft?.reponse) return
    const payload = {
      question: draft.question, reponse: draft.reponse, categorie: draft.categorie ?? null,
      excursion_id: draft.excursion_id || null, ordre: draft.ordre ?? rows.length, actif: draft.actif ?? true,
    }
    const res = draft.id
      ? await supabase.from('faqs').update(payload).eq('id', draft.id)
      : await supabase.from('faqs').insert(payload)
    if (res.error) { setError(res.error.message); return }
    setDraft(null); load()
  }
  const del = async (id: string) => { await supabase.from('faqs').delete().eq('id', id); load() }
  const toggle = async (f: Faq) => { await supabase.from('faqs').update({ actif: !f.actif }).eq('id', f.id); load() }

  if (loading) return <p className="text-slate-500">Chargement de la FAQ…</p>
  if (error)
    return <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {error} — as-tu exécuté <code>supabase/faq.sql</code> ?
    </div>

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">FAQ ({rows.length})</h2>
        <button onClick={() => setDraft({ actif: true })} className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">+ Nouvelle question</button>
      </div>

      {draft && (
        <div className="mb-4 space-y-2 rounded-lg border border-blue-200 bg-blue-50/50 p-4">
          <input className={inp} placeholder="Question" value={draft.question ?? ''} onChange={(e) => setDraft({ ...draft, question: e.target.value })} />
          <textarea className={inp} rows={3} placeholder="Réponse" value={draft.reponse ?? ''} onChange={(e) => setDraft({ ...draft, reponse: e.target.value })} />
          <div className="grid gap-2 sm:grid-cols-3">
            <input className={inp} placeholder="Catégorie (optionnel)" value={draft.categorie ?? ''} onChange={(e) => setDraft({ ...draft, categorie: e.target.value })} />
            <select className={inp} value={draft.excursion_id ?? ''} onChange={(e) => setDraft({ ...draft, excursion_id: e.target.value || null })}>
              <option value="">FAQ générale</option>
              {excursions.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}
            </select>
            <input type="number" className={inp} placeholder="Ordre" value={draft.ordre ?? ''} onChange={(e) => setDraft({ ...draft, ordre: Number(e.target.value) })} />
          </div>
          <div className="flex gap-2">
            <button onClick={save} className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white">Enregistrer</button>
            <button onClick={() => setDraft(null)} className="rounded border border-slate-300 px-4 py-2 text-sm">Annuler</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {rows.map((f) => (
          <div key={f.id} className={`rounded-lg border p-3 ${f.actif ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50 opacity-60'}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium">{f.question}</div>
                <p className="mt-1 text-sm text-slate-500">{f.reponse}</p>
                <div className="mt-1 text-xs text-slate-400">
                  {f.excursion_id ? excursions.find((x) => x.id === f.excursion_id)?.nom ?? 'Produit' : 'Générale'}{f.categorie ? ` · ${f.categorie}` : ''}
                </div>
              </div>
              <div className="flex shrink-0 gap-2 text-sm">
                <button onClick={() => toggle(f)} className="text-slate-500 hover:underline">{f.actif ? 'Masquer' : 'Afficher'}</button>
                <button onClick={() => setDraft(f)} className="text-blue-600 hover:underline">Éditer</button>
                <button onClick={() => del(f.id)} className="text-red-500 hover:underline">Suppr.</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const inp = 'w-full rounded border border-slate-300 px-3 py-2 text-sm'
