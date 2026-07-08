import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useSettings } from '../../lib/settings'

// ============================================================
//  RELEVÉ PRESTATAIRE — fiche comptable par fournisseur
//  Lit la COMPTA RÉELLE : les supplier_transactions générées
//  automatiquement par le trigger SQL (FACTURE 'AUTO:'), plus
//  les avances/paiements saisis manuellement. Ne recalcule plus
//  depuis les cost_lines (source de double-comptage).
//    date · description · type · montant
//  Totaux : facturé, payé/avances, solde à payer.
// ============================================================

type RefType = 'GUIDE' | 'CHAUFFEUR' | 'TRANSPORT' | 'RESTAURANT' | 'HEBERGEMENT' | 'EXTRA' | 'AUTRE'

interface Supplier {
  id: string
  nom: string
  type: string | null
  ref_type: string | null
}

interface Txn {
  id: string
  date: string | null
  type_operation: string | null
  montant: number | null
  reference: string | null
  description: string | null
  statut: string | null
}

const GROUPS: { key: RefType; label: string }[] = [
  { key: 'GUIDE', label: 'Guides' },
  { key: 'CHAUFFEUR', label: 'Chauffeurs' },
  { key: 'TRANSPORT', label: 'Transports' },
  { key: 'RESTAURANT', label: 'Restaurants' },
  { key: 'HEBERGEMENT', label: 'Hébergements' },
  { key: 'EXTRA', label: 'Extras / prestataires' },
  { key: 'AUTRE', label: 'Autres' },
]

function groupOf(s: Supplier): RefType {
  const rt = (s.ref_type ?? '').toUpperCase()
  if (rt === 'GUIDE' || rt === 'CHAUFFEUR' || rt === 'TRANSPORT' || rt === 'RESTAURANT' || rt === 'HEBERGEMENT' || rt === 'EXTRA') return rt
  return 'AUTRE'
}

export function RelevePartenaire() {
  const settings = useSettings()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [supplierId, setSupplierId] = useState('')
  const [txns, setTxns] = useState<Txn[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [du, setDu] = useState('')
  const [au, setAu] = useState('')

  // Charge la liste des fournisseurs.
  useEffect(() => {
    supabase
      .from('suppliers')
      .select('id, nom, type, ref_type')
      .order('nom')
      .then(({ data, error: e }) => {
        if (e) { setError(e.message); setLoading(false); return }
        setSuppliers((data as Supplier[]) ?? [])
        setLoading(false)
      })
  }, [])

  const supplier = suppliers.find((s) => s.id === supplierId) ?? null

  const loadTxns = useCallback(async () => {
    if (!supplier) { setTxns([]); return }
    setBusy(true); setError(null)
    let q = supabase
      .from('supplier_transactions')
      .select('id, date, type_operation, montant, reference, description, statut')
      .eq('supplier_id', supplier.id)
    if (du) q = q.gte('date', du)
    if (au) q = q.lte('date', au)
    const { data, error: e } = await q.order('date', { ascending: true })
    if (e) { setError(e.message); setBusy(false); return }
    setTxns((data as Txn[]) ?? [])
    setBusy(false)
  }, [supplier, du, au])

  useEffect(() => { loadTxns() }, [loadTxns])

  const { totalFacture, totalPaye, solde } = useMemo(() => {
    let f = 0, p = 0
    for (const t of txns) {
      const m = t.montant ?? 0
      const op = (t.type_operation ?? '').toUpperCase()
      if (op === 'FACTURE' || op === 'CREDIT') f += m
      else if (op === 'PAIEMENT' || op === 'AVANCE') p += m
    }
    return { totalFacture: f, totalPaye: p, solde: f - p }
  }, [txns])

  const devise = 'TND'

  const groupedSuppliers = useMemo(() => {
    const map = new Map<RefType, Supplier[]>()
    for (const s of suppliers) {
      const g = groupOf(s)
      const arr = map.get(g) ?? []
      arr.push(s)
      map.set(g, arr)
    }
    return map
  }, [suppliers])

  if (loading) return <p className="text-slate-500">Chargement…</p>

  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-end gap-3 rounded-lg bg-white p-4 shadow">
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">Fournisseur</span>
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1">
            <option value="">— choisir —</option>
            {GROUPS.map((grp) => {
              const items = groupedSuppliers.get(grp.key) ?? []
              if (items.length === 0) return null
              return (
                <optgroup key={grp.key} label={grp.label}>
                  {items.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
                </optgroup>
              )
            })}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">Du</span>
          <input type="date" value={du} onChange={(e) => setDu(e.target.value)} className="rounded border border-slate-300 px-2 py-1" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">Au</span>
          <input type="date" value={au} onChange={(e) => setAu(e.target.value)} className="rounded border border-slate-300 px-2 py-1" />
        </label>
        {supplier && (
          <button onClick={() => window.print()} className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">🖨️ Imprimer</button>
        )}
      </div>

      {error && <div className="no-print mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {!supplier ? (
        <p className="text-slate-500">Choisis un fournisseur pour voir son relevé comptable.</p>
      ) : (
        <div className="printable rounded-lg border bg-white p-6 shadow">
          <div className="mb-4 flex items-start justify-between border-b pb-3">
            <div className="flex items-center gap-3">
              {settings.logo && <img src={settings.logo} alt="logo" className="max-h-16" />}
              <div>
                <h1 className="text-xl font-bold">RELEVÉ PRESTATAIRE</h1>
                <p className="text-sm text-slate-500">{settings.company_name}</p>
              </div>
            </div>
            <div className="text-right text-sm">
              <p className="text-lg font-semibold">{supplier.nom}</p>
              <p className="text-slate-500">{supplier.ref_type ?? supplier.type ?? ''}</p>
              {(du || au) && <p className="text-xs text-slate-400">Période : {du || '…'} → {au || '…'}</p>}
            </div>
          </div>

          {busy ? (
            <p className="text-slate-500">Chargement…</p>
          ) : txns.length === 0 ? (
            <p className="text-sm text-slate-500">
              Aucune opération comptable pour ce fournisseur sur la période. (Les factures sont générées
              automatiquement au départ d'une sortie ; les avances et paiements se saisissent dans la fiche compta.)
            </p>
          ) : (
            <>
              <table className="w-full border text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="border px-2 py-1">Date</th>
                    <th className="border px-2 py-1">Description</th>
                    <th className="border px-2 py-1">Type</th>
                    <th className="border px-2 py-1 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {txns.map((t) => {
                    const op = (t.type_operation ?? '').toUpperCase()
                    const isCredit = op === 'PAIEMENT' || op === 'AVANCE'
                    return (
                      <tr key={t.id}>
                        <td className="border px-2 py-1 whitespace-nowrap">{t.date ?? ''}</td>
                        <td className="border px-2 py-1">{t.description ?? t.reference ?? ''}</td>
                        <td className="border px-2 py-1">
                          <span className={`rounded px-1.5 text-xs ${isCredit ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                            {t.type_operation ?? ''}
                          </span>
                        </td>
                        <td className={`border px-2 py-1 text-right font-medium ${isCredit ? 'text-emerald-700' : ''}`}>
                          {isCredit ? '−' : ''}{(t.montant ?? 0).toFixed(2)} {devise}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="font-medium">
                    <td className="border px-2 py-1.5" colSpan={3}>TOTAL FACTURÉ</td>
                    <td className="border px-2 py-1.5 text-right">{totalFacture.toFixed(2)} {devise}</td>
                  </tr>
                  <tr className="font-medium text-emerald-700">
                    <td className="border px-2 py-1.5" colSpan={3}>TOTAL PAYÉ / AVANCES</td>
                    <td className="border px-2 py-1.5 text-right">{totalPaye.toFixed(2)} {devise}</td>
                  </tr>
                  <tr className="bg-slate-50 text-base font-semibold">
                    <td className="border px-2 py-2" colSpan={3}>SOLDE À PAYER</td>
                    <td className="border px-2 py-2 text-right">{solde.toFixed(2)} {devise}</td>
                  </tr>
                </tfoot>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  )
}
