import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'

// ============================================================
//  MODULE COMPTABILITÉ FOURNISSEURS
//  - Liste des fournisseurs avec solde
//  - Détail : historique des transactions + solde calculé
//  - Ajout d'une transaction (avance / facture / paiement)
//  - Alerte "factures manquantes"
//  - Totaux : total dû, total avances, total payé
// ============================================================

type SupplierType = string

interface Supplier {
  id: string
  nom: string
  type: SupplierType | null
  telephone: string | null
  solde_actuel: number | null
  actif: boolean
}

type OperationType = 'FACTURE' | 'AVANCE' | 'PAIEMENT' | 'CREDIT'

interface SupplierTransaction {
  id: string
  supplier_id: string
  date: string
  type_operation: OperationType
  montant: number
  reference: string | null
  description: string | null
  statut: string | null
}

type InvoiceStatut = 'RECUE' | 'MANQUANTE' | 'VALIDEE' | 'PAYEE'

interface SupplierInvoice {
  id: string
  supplier_id: string
  numero_facture: string | null
  date_facture: string
  montant: number
  statut: InvoiceStatut
}

const OPERATION_TYPES: OperationType[] = ['FACTURE', 'AVANCE', 'PAIEMENT', 'CREDIT']

const fmt = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * Solde d'un fournisseur (ce qu'on lui doit) :
 *   FACTURE / CREDIT  -> augmente la dette
 *   PAIEMENT / AVANCE -> diminue la dette
 */
function soldeCalcule(txs: SupplierTransaction[]): number {
  return txs.reduce((acc, t) => {
    switch (t.type_operation) {
      case 'FACTURE':
      case 'CREDIT':
        return acc + t.montant
      case 'PAIEMENT':
      case 'AVANCE':
        return acc - t.montant
      default:
        return acc
    }
  }, 0)
}

export function Comptabilite() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [transactions, setTransactions] = useState<SupplierTransaction[]>([])
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [sRes, tRes, iRes] = await Promise.all([
      supabase.from('suppliers').select('*').order('nom'),
      supabase.from('supplier_transactions').select('*').order('date', { ascending: false }),
      supabase.from('supplier_invoices').select('*').order('date_facture', { ascending: false }),
    ])
    if (sRes.error) setError(sRes.error.message)
    else if (tRes.error) setError(tRes.error.message)
    else if (iRes.error) setError(iRes.error.message)
    setSuppliers((sRes.data as Supplier[]) ?? [])
    setTransactions((tRes.data as SupplierTransaction[]) ?? [])
    setInvoices((iRes.data as SupplierInvoice[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Solde calculé par fournisseur à partir des transactions.
  const soldesParFournisseur = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of suppliers) map.set(s.id, 0)
    for (const s of suppliers) {
      map.set(s.id, soldeCalcule(transactions.filter((t) => t.supplier_id === s.id)))
    }
    return map
  }, [suppliers, transactions])

  // Totaux globaux.
  const totaux = useMemo(() => {
    let totalDu = 0
    let totalAvances = 0
    let totalPaye = 0
    for (const t of transactions) {
      if (t.type_operation === 'FACTURE' || t.type_operation === 'CREDIT') totalDu += t.montant
      if (t.type_operation === 'AVANCE') totalAvances += t.montant
      if (t.type_operation === 'PAIEMENT') totalPaye += t.montant
    }
    return { totalDu, totalAvances, totalPaye }
  }, [transactions])

  // Alerte factures manquantes : fournisseurs ayant reçu un paiement mais
  // dont une facture est MANQUANTE, ou sans aucune facture RECUE ce mois-ci.
  const alertesFacturesManquantes = useMemo(() => {
    const now = new Date()
    const moisCourant = now.getFullYear() * 100 + (now.getMonth() + 1)
    const moisDe = (dateStr: string) => {
      const d = new Date(dateStr)
      return d.getFullYear() * 100 + (d.getMonth() + 1)
    }
    const alertes: { supplier: Supplier; raison: string }[] = []
    for (const s of suppliers) {
      const sTx = transactions.filter((t) => t.supplier_id === s.id)
      const aRecuPaiement = sTx.some((t) => t.type_operation === 'PAIEMENT')
      if (!aRecuPaiement) continue
      const sInv = invoices.filter((i) => i.supplier_id === s.id)
      const aFactureManquante = sInv.some((i) => i.statut === 'MANQUANTE')
      const aFactureRecueCeMois = sInv.some(
        (i) => i.statut === 'RECUE' && moisDe(i.date_facture) === moisCourant,
      )
      if (aFactureManquante) {
        alertes.push({ supplier: s, raison: 'Facture au statut MANQUANTE' })
      } else if (!aFactureRecueCeMois) {
        alertes.push({ supplier: s, raison: 'Aucune facture reçue ce mois-ci' })
      }
    }
    return alertes
  }, [suppliers, transactions, invoices])

  if (loading) return <p className="text-slate-500">Chargement de la comptabilité…</p>
  if (error)
    return (
      <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error} — as-tu exécuté <code>supabase/erp.sql</code> puis <code>supabase/seed.sql</code> ?
      </div>
    )

  const selected = suppliers.find((s) => s.id === selectedId) ?? null
  if (selected)
    return (
      <SupplierDetail
        supplier={selected}
        transactions={transactions.filter((t) => t.supplier_id === selected.id)}
        invoices={invoices.filter((i) => i.supplier_id === selected.id)}
        solde={soldesParFournisseur.get(selected.id) ?? 0}
        onBack={() => setSelectedId(null)}
        onChanged={load}
      />
    )

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Comptabilité fournisseurs ({suppliers.length})</h2>

      {/* Alerte factures manquantes */}
      {alertesFacturesManquantes.length > 0 && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-red-700">
            ⚠️ Factures manquantes ({alertesFacturesManquantes.length})
          </h3>
          <ul className="space-y-1 text-sm text-red-700">
            {alertesFacturesManquantes.map(({ supplier, raison }) => (
              <li key={supplier.id}>
                <button
                  onClick={() => setSelectedId(supplier.id)}
                  className="font-medium underline hover:text-red-900"
                >
                  {supplier.nom}
                </button>{' '}
                — {raison}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Totaux */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Total dû (factures + crédits)" value={`${fmt(totaux.totalDu)} TND`} tone="bad" />
        <Stat label="Total avances" value={`${fmt(totaux.totalAvances)} TND`} tone="neutral" />
        <Stat label="Total payé" value={`${fmt(totaux.totalPaye)} TND`} tone="good" />
      </div>

      {/* Liste des fournisseurs */}
      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-3 py-2">Fournisseur</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Téléphone</th>
              <th className="px-3 py-2">Statut</th>
              <th className="px-3 py-2 text-right">Solde (TND)</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => {
              const solde = soldesParFournisseur.get(s.id) ?? 0
              return (
                <tr
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  className="cursor-pointer border-b last:border-0 hover:bg-blue-50"
                >
                  <td className="px-3 py-2 font-medium">{s.nom}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-500">{s.type ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-500">{s.telephone ?? '—'}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs ${
                        s.actif ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {s.actif ? 'actif' : 'inactif'}
                    </span>
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-semibold ${
                      solde > 0 ? 'text-red-700' : solde < 0 ? 'text-green-700' : 'text-slate-900'
                    }`}
                  >
                    {fmt(solde)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {suppliers.length === 0 && (
        <p className="mt-4 text-sm text-slate-500">
          Aucun fournisseur. Exécute <code>supabase/seed.sql</code> pour charger les données.
        </p>
      )}
    </div>
  )
}

function SupplierDetail({
  supplier,
  transactions,
  invoices,
  solde,
  onBack,
  onChanged,
}: {
  supplier: Supplier
  transactions: SupplierTransaction[]
  invoices: SupplierInvoice[]
  solde: number
  onBack: () => void
  onChanged: () => void | Promise<void>
}) {
  const [showForm, setShowForm] = useState(false)

  const totauxSupplier = useMemo(() => {
    let du = 0
    let avances = 0
    let paye = 0
    for (const t of transactions) {
      if (t.type_operation === 'FACTURE' || t.type_operation === 'CREDIT') du += t.montant
      if (t.type_operation === 'AVANCE') avances += t.montant
      if (t.type_operation === 'PAIEMENT') paye += t.montant
    }
    return { du, avances, paye }
  }, [transactions])

  return (
    <div>
      <button onClick={onBack} className="mb-4 text-sm text-blue-700 hover:underline">
        ← Retour aux fournisseurs
      </button>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">{supplier.nom}</h2>
          <p className="text-sm text-slate-500">
            {supplier.type ?? 'Type inconnu'}
            {supplier.telephone ? ` · ${supplier.telephone}` : ''} ·{' '}
            {supplier.actif ? 'Actif' : 'Inactif'}
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {showForm ? 'Annuler' : '+ Nouvelle transaction'}
        </button>
      </div>

      {/* Cartes solde/totaux */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Solde actuel"
          value={`${fmt(solde)} TND`}
          sub={solde > 0 ? 'à payer' : solde < 0 ? 'avance/crédit' : 'à jour'}
          tone={solde > 0 ? 'bad' : solde < 0 ? 'good' : 'neutral'}
        />
        <Stat label="Total dû" value={`${fmt(totauxSupplier.du)} TND`} />
        <Stat label="Total avances" value={`${fmt(totauxSupplier.avances)} TND`} />
        <Stat label="Total payé" value={`${fmt(totauxSupplier.paye)} TND`} tone="good" />
      </div>

      {showForm && (
        <TransactionForm
          supplierId={supplier.id}
          onDone={async () => {
            setShowForm(false)
            await onChanged()
          }}
        />
      )}

      {/* Historique des transactions */}
      <div className="mb-4 rounded-lg bg-white p-4 shadow">
        <h3 className="mb-2 font-semibold">Historique des transactions ({transactions.length})</h3>
        {transactions.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune transaction enregistrée pour ce fournisseur.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-1">Date</th>
                  <th className="py-1">Type</th>
                  <th className="py-1">Référence</th>
                  <th className="py-1">Description</th>
                  <th className="py-1 text-right">Montant (TND)</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-t">
                    <td className="whitespace-nowrap py-1 text-slate-500">{t.date}</td>
                    <td className="py-1">
                      <span className={`rounded px-1.5 py-0.5 text-xs ${typeBadge(t.type_operation)}`}>
                        {t.type_operation}
                      </span>
                    </td>
                    <td className="py-1 text-slate-500">{t.reference ?? '—'}</td>
                    <td className="py-1 text-slate-500">{t.description ?? '—'}</td>
                    <td className="py-1 text-right font-medium">{fmt(t.montant)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Factures */}
      <div className="rounded-lg bg-white p-4 shadow">
        <h3 className="mb-2 font-semibold">Factures ({invoices.length})</h3>
        {invoices.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune facture enregistrée pour ce fournisseur.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-1">N° facture</th>
                  <th className="py-1">Date</th>
                  <th className="py-1">Statut</th>
                  <th className="py-1 text-right">Montant (TND)</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id} className="border-t">
                    <td className="py-1 font-mono text-xs text-slate-500">{i.numero_facture ?? '—'}</td>
                    <td className="whitespace-nowrap py-1 text-slate-500">{i.date_facture}</td>
                    <td className="py-1">
                      <span className={`rounded px-1.5 py-0.5 text-xs ${invoiceBadge(i.statut)}`}>
                        {i.statut}
                      </span>
                    </td>
                    <td className="py-1 text-right font-medium">{fmt(i.montant)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function TransactionForm({
  supplierId,
  onDone,
}: {
  supplierId: string
  onDone: () => void | Promise<void>
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [typeOp, setTypeOp] = useState<OperationType>('FACTURE')
  const [montant, setMontant] = useState('')
  const [reference, setReference] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const submit = async () => {
    const montantNum = Number(montant)
    if (!montant || Number.isNaN(montantNum) || montantNum <= 0) {
      setFormError('Montant invalide.')
      return
    }
    setSaving(true)
    setFormError(null)
    const { error } = await supabase.from('supplier_transactions').insert({
      supplier_id: supplierId,
      date,
      type_operation: typeOp,
      montant: montantNum,
      reference: reference || null,
      description: description || null,
      statut: 'ENREGISTRE',
    })
    setSaving(false)
    if (error) {
      setFormError(error.message)
      return
    }
    await onDone()
  }

  return (
    <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
      <h3 className="mb-3 font-semibold">Nouvelle transaction</h3>
      {formError && <p className="mb-2 text-sm text-red-700">{formError}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">Type d'opération</span>
          <select
            value={typeOp}
            onChange={(e) => setTypeOp(e.target.value as OperationType)}
            className="w-full rounded border border-slate-300 px-2 py-1"
          >
            {OPERATION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">Montant (TND)</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">Référence</span>
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-slate-500">Description</span>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1"
          />
        </label>
      </div>
      <div className="mt-3">
        <button
          onClick={submit}
          disabled={saving}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  )
}

function typeBadge(t: OperationType): string {
  switch (t) {
    case 'FACTURE':
      return 'bg-red-100 text-red-700'
    case 'CREDIT':
      return 'bg-amber-100 text-amber-700'
    case 'PAIEMENT':
      return 'bg-green-100 text-green-700'
    case 'AVANCE':
      return 'bg-blue-100 text-blue-700'
    default:
      return 'bg-slate-100 text-slate-600'
  }
}

function invoiceBadge(s: InvoiceStatut): string {
  switch (s) {
    case 'MANQUANTE':
      return 'bg-red-100 text-red-700'
    case 'RECUE':
      return 'bg-blue-100 text-blue-700'
    case 'VALIDEE':
      return 'bg-amber-100 text-amber-700'
    case 'PAYEE':
      return 'bg-green-100 text-green-700'
    default:
      return 'bg-slate-100 text-slate-600'
  }
}

function Stat({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string
  value: string
  sub?: string
  tone?: 'good' | 'bad' | 'neutral'
}) {
  const color =
    tone === 'good' ? 'text-green-700' : tone === 'bad' ? 'text-red-700' : 'text-slate-900'
  return (
    <div className="rounded-lg bg-white p-3 shadow">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  )
}
