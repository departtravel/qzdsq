import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { confirmAdmin } from '../../lib/adminGuard'
import { useErpRole, peutEcrire } from '../../lib/roles'

// ============================================================
//  CAISSE — espèces de l'agence (multi-devises)
//  Séparée de la comptabilité fournisseurs. Encaissements et
//  dépenses en liquide + solde du jour par devise :
//  « combien dois-je avoir en caisse après toutes les opérations ».
// ============================================================

interface CashEntry {
  id: string
  date: string
  devise: string
  sens: 'ENCAISSEMENT' | 'DEPENSE'
  montant: number
  libelle: string | null
  categorie: string | null
  note: string | null
}

const DEVISES = ['TND', 'EUR', 'USD']
const CATEGORIES = ['VENTE', 'AVANCE', 'ACHAT', 'SALAIRE', 'CARBURANT', 'DIVERS']
const todayIso = () => new Date().toISOString().slice(0, 10)
const inputCls = 'w-full rounded border border-slate-300 px-2 py-1'

export function Caisse() {
  const { role } = useErpRole()
  const canWrite = peutEcrire.comptabilite(role)
  const [rows, setRows] = useState<CashEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [jour, setJour] = useState(todayIso())

  const [date, setDate] = useState(todayIso())
  const [devise, setDevise] = useState('TND')
  const [sens, setSens] = useState<'ENCAISSEMENT' | 'DEPENSE'>('ENCAISSEMENT')
  const [montant, setMontant] = useState('')
  const [libelle, setLibelle] = useState('')
  const [categorie, setCategorie] = useState('VENTE')

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('cash_entries')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    setRows((data as CashEntry[]) ?? [])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  async function ajouter(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!montant || Number(montant) <= 0) { setError('Montant requis.'); return }
    const { error } = await supabase.from('cash_entries').insert({
      date, devise, sens, montant: Number(montant),
      libelle: libelle.trim() || null, categorie,
    })
    if (error) { setError(error.message); return }
    setMontant(''); setLibelle('')
    load()
  }

  async function supprimer(id: string) {
    if (!(await confirmAdmin('la suppression de cette opération de caisse'))) return
    const { error } = await supabase.from('cash_entries').delete().eq('id', id)
    if (error) setError(error.message)
    else load()
  }

  // Solde par devise à la date « jour » (cumul de toutes les opérations <= jour).
  const soldes = useMemo(() => {
    const m = new Map<string, { entree: number; sortie: number; solde: number }>()
    for (const d of DEVISES) m.set(d, { entree: 0, sortie: 0, solde: 0 })
    for (const r of rows) {
      if (r.date > jour) continue
      const s = m.get(r.devise) ?? { entree: 0, sortie: 0, solde: 0 }
      if (r.sens === 'ENCAISSEMENT') s.entree += r.montant
      else s.sortie += r.montant
      s.solde = s.entree - s.sortie
      m.set(r.devise, s)
    }
    return m
  }, [rows, jour])

  // Mouvements du jour sélectionné.
  const mouvementsJour = useMemo(() => rows.filter((r) => r.date === jour), [rows, jour])

  if (loading) return <p className="text-slate-500">Chargement de la caisse…</p>

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">🧰 Caisse (espèces)</h2>
        <label className="text-sm">
          <span className="mr-2 text-slate-500">État au</span>
          <input type="date" value={jour} onChange={(e) => setJour(e.target.value)} className="rounded border border-slate-300 px-2 py-1" />
        </label>
      </div>

      {error && <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {/* Solde du jour par devise */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {DEVISES.map((d) => {
          const s = soldes.get(d)!
          return (
            <div key={d} className="rounded-lg bg-white p-4 shadow">
              <p className="text-xs text-slate-500">Solde caisse {d}</p>
              <p className={`text-2xl font-bold ${s.solde >= 0 ? 'text-green-700' : 'text-red-700'}`}>{s.solde.toFixed(2)} {d}</p>
              <p className="text-xs text-slate-400">Entrées {s.entree.toFixed(2)} · Sorties {s.sortie.toFixed(2)}</p>
            </div>
          )
        })}
      </div>
      <p className="mb-4 text-xs text-slate-400">
        « Solde caisse » = ce que tu dois trouver en liquide au {jour} après toutes les opérations, par devise.
      </p>

      {/* Ajout d'une opération */}
      {canWrite && (
        <form onSubmit={ajouter} className="mb-4 grid grid-cols-2 gap-3 rounded-lg bg-white p-4 shadow sm:grid-cols-3 lg:grid-cols-7">
          <label className="text-sm"><span className="mb-1 block text-slate-500">Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} /></label>
          <label className="text-sm"><span className="mb-1 block text-slate-500">Sens</span>
            <select value={sens} onChange={(e) => setSens(e.target.value as 'ENCAISSEMENT' | 'DEPENSE')} className={inputCls}>
              <option value="ENCAISSEMENT">Encaissement (+)</option>
              <option value="DEPENSE">Dépense (−)</option>
            </select></label>
          <label className="text-sm"><span className="mb-1 block text-slate-500">Montant</span>
            <input type="number" min={0} step="0.01" value={montant} onChange={(e) => setMontant(e.target.value)} className={inputCls} /></label>
          <label className="text-sm"><span className="mb-1 block text-slate-500">Devise</span>
            <select value={devise} onChange={(e) => setDevise(e.target.value)} className={inputCls}>
              {DEVISES.map((d) => <option key={d} value={d}>{d}</option>)}
            </select></label>
          <label className="text-sm"><span className="mb-1 block text-slate-500">Catégorie</span>
            <select value={categorie} onChange={(e) => setCategorie(e.target.value)} className={inputCls}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select></label>
          <label className="text-sm sm:col-span-2 lg:col-span-1"><span className="mb-1 block text-slate-500">Libellé</span>
            <input value={libelle} onChange={(e) => setLibelle(e.target.value)} className={inputCls} /></label>
          <div className="flex items-end">
            <button className="w-full rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700">Ajouter</button>
          </div>
        </form>
      )}

      {/* Mouvements du jour */}
      <h3 className="mb-2 font-semibold">Opérations du {jour} ({mouvementsJour.length})</h3>
      <div className="mb-6 overflow-x-auto rounded-lg bg-white shadow">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50 text-left text-slate-500">
            <tr><th className="px-3 py-2">Sens</th><th className="px-3 py-2">Catégorie</th><th className="px-3 py-2">Libellé</th><th className="px-3 py-2 text-right">Montant</th><th></th></tr>
          </thead>
          <tbody>
            {mouvementsJour.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="px-3 py-2">
                  <span className={`rounded px-1.5 py-0.5 text-xs ${r.sens === 'ENCAISSEMENT' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {r.sens === 'ENCAISSEMENT' ? 'Entrée' : 'Sortie'}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-500">{r.categorie ?? '—'}</td>
                <td className="px-3 py-2">{r.libelle ?? '—'}</td>
                <td className={`px-3 py-2 text-right font-medium ${r.sens === 'ENCAISSEMENT' ? 'text-green-700' : 'text-red-700'}`}>
                  {r.sens === 'ENCAISSEMENT' ? '+' : '−'}{r.montant.toFixed(2)} {r.devise}
                </td>
                <td className="px-3 py-2 text-right">
                  {canWrite && <button onClick={() => supprimer(r.id)} className="text-xs text-red-600 hover:underline">✕</button>}
                </td>
              </tr>
            ))}
            {mouvementsJour.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-3 text-center text-slate-400">Aucune opération ce jour.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Historique complet */}
      <h3 className="mb-2 font-semibold">Historique complet ({rows.length})</h3>
      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50 text-left text-slate-500">
            <tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Sens</th><th className="px-3 py-2">Libellé</th><th className="px-3 py-2 text-right">Montant</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="px-3 py-2 whitespace-nowrap text-slate-500">{r.date}</td>
                <td className="px-3 py-2">{r.sens === 'ENCAISSEMENT' ? 'Entrée' : 'Sortie'}</td>
                <td className="px-3 py-2">{r.libelle ?? '—'} <span className="text-xs text-slate-400">{r.categorie}</span></td>
                <td className={`px-3 py-2 text-right ${r.sens === 'ENCAISSEMENT' ? 'text-green-700' : 'text-red-700'}`}>
                  {r.sens === 'ENCAISSEMENT' ? '+' : '−'}{r.montant.toFixed(2)} {r.devise}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
