import { useState } from 'react'
import { useParseEmail, useCheckAlerts, useAgentLogs } from '../api/hooks'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import apiClient from '../api/client'

interface AgentResult {
  type: string
  data: unknown
}

function ResultPanel({ label, data }: { label: string; data: unknown }) {
  return (
    <div className="mt-3 bg-bg3 border border-border rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-border text-xs text-text/40 uppercase tracking-wide">
        {label}
      </div>
      <pre className="px-3 py-3 text-xs text-text/70 overflow-x-auto font-mono leading-relaxed">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  )
}

export default function AgentsPage() {
  const parseEmail = useParseEmail()
  const checkAlerts = useCheckAlerts()
  const { data: logs = [], isLoading: logsLoading } = useAgentLogs()

  const [results, setResults] = useState<AgentResult[]>([])
  const [emailInput, setEmailInput] = useState('')
  const [accountingResult, setAccountingResult] = useState<unknown>(null)
  const [accountingLoading, setAccountingLoading] = useState(false)
  const [invoiceResult, setInvoiceResult] = useState<unknown>(null)
  const [invoiceLoading, setInvoiceLoading] = useState(false)

  async function handleParseEmail() {
    if (!emailInput.trim()) return
    const data = await parseEmail.mutateAsync({ email_text: emailInput })
    setResults((r) => [{ type: 'voyage', data }, ...r])
  }

  async function handleCheckAlerts() {
    const data = await checkAlerts.mutateAsync()
    setResults((r) => [{ type: 'erp', data }, ...r])
  }

  async function handleAccounting() {
    setAccountingLoading(true)
    try {
      const res = await apiClient.post('/agents/accounting/entries')
      setAccountingResult(res.data)
      setResults((r) => [{ type: 'accounting', data: res.data }, ...r])
    } catch (e) {
      setAccountingResult({ error: String(e) })
    } finally {
      setAccountingLoading(false)
    }
  }

  async function handleInvoice() {
    setInvoiceLoading(true)
    try {
      const res = await apiClient.post('/agents/invoicing/generate')
      setInvoiceResult(res.data)
      setResults((r) => [{ type: 'invoicing', data: res.data }, ...r])
    } catch (e) {
      setInvoiceResult({ error: String(e) })
    } finally {
      setInvoiceLoading(false)
    }
  }

  const agents = [
    {
      id: 'voyage',
      icon: '✈️',
      title: 'Agent Spécialiste Voyage',
      description:
        'Analyse les emails de réservation et extrait les données client, excursion, dates et tarifs automatiquement.',
      color: 'border-accent/30 bg-accent/5',
      action: (
        <div className="space-y-2">
          <textarea
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            rows={4}
            placeholder="Collez le texte de l'email..."
            className="w-full bg-bg3 border border-border rounded-md px-3 py-2 text-xs text-text placeholder-text/30 focus:outline-none resize-none font-mono"
          />
          <Button
            size="sm"
            onClick={handleParseEmail}
            loading={parseEmail.isPending}
            disabled={!emailInput.trim()}
          >
            Lancer
          </Button>
          {parseEmail.data != null && <ResultPanel label="Résultat" data={parseEmail.data as Record<string, unknown>} />}
        </div>
      ),
    },
    {
      id: 'erp',
      icon: '🔍',
      title: 'Agent ERP',
      description:
        'Vérifie les alertes système : réservations sans chauffeur, dates dépassées, fournisseurs non réservés.',
      color: 'border-alert/30 bg-alert/5',
      action: (
        <div>
          <Button size="sm" onClick={handleCheckAlerts} loading={checkAlerts.isPending}>
            Lancer
          </Button>
          {checkAlerts.data != null && <ResultPanel label="Alertes" data={checkAlerts.data as Record<string, unknown>} />}
        </div>
      ),
    },
    {
      id: 'accounting',
      icon: '📒',
      title: 'Agent Comptabilité Tunisienne',
      description:
        'Génère les écritures comptables selon le Plan Comptable Général 2000 (PCG 2000) à partir des réservations du mois.',
      color: 'border-success/30 bg-success/5',
      action: (
        <div>
          <Button size="sm" variant="secondary" onClick={handleAccounting} loading={accountingLoading}>
            Lancer
          </Button>
          {accountingResult != null && <ResultPanel label="Écritures comptables" data={accountingResult as Record<string, unknown>} />}
        </div>
      ),
    },
    {
      id: 'invoicing',
      icon: '🧾',
      title: 'Agent Facturation',
      description:
        'Génère automatiquement les factures partenaires et relevés OTA à partir des données du mois en cours.',
      color: 'border-accent2/30 bg-accent2/5',
      action: (
        <div>
          <Button size="sm" variant="secondary" onClick={handleInvoice} loading={invoiceLoading}>
            Lancer
          </Button>
          {invoiceResult != null && <ResultPanel label="Factures générées" data={invoiceResult as Record<string, unknown>} />}
        </div>
      ),
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-text">Agents IA</h1>
        <p className="text-text/40 text-sm mt-0.5">Automatisation intelligente des processus agence</p>
      </div>

      {/* Agent cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className={`bg-bg2 border rounded-xl p-5 ${agent.color}`}
          >
            <div className="flex items-start gap-3 mb-4">
              <span className="text-2xl">{agent.icon}</span>
              <div>
                <h2 className="font-semibold text-text">{agent.title}</h2>
                <p className="text-text/50 text-xs mt-1 leading-relaxed">{agent.description}</p>
              </div>
            </div>
            {agent.action}
          </div>
        ))}
      </div>

      {/* Recent results */}
      {results.length > 0 && (
        <div className="bg-bg2 border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-text/60 uppercase tracking-wide mb-3">
            Résultats de cette session
          </h2>
          <div className="space-y-3">
            {results.map((r, i) => (
              <div key={i}>
                <div className="text-xs text-text/40 uppercase tracking-wide mb-1">
                  Agent {r.type}
                </div>
                <ResultPanel label="Résultat" data={r.data} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Log table */}
      <div className="bg-bg2 border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-text/60 uppercase tracking-wide mb-4">
          Journal des agents
        </h2>
        {logsLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : logs.length === 0 ? (
          <p className="text-text/30 text-sm text-center py-4">Aucun log disponible.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg3 border-b border-border">
                <tr className="text-text/40 text-xs uppercase tracking-wide">
                  <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Horodatage</th>
                  <th className="text-left px-3 py-2 font-medium">Type</th>
                  <th className="text-left px-3 py-2 font-medium">Entrée</th>
                  <th className="text-left px-3 py-2 font-medium">Résultat</th>
                  <th className="text-right px-3 py-2 font-medium tabular-nums">Tokens</th>
                  <th className="text-right px-3 py-2 font-medium tabular-nums">Coût $</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {logs.map((log: Record<string, unknown>, i: number) => (
                  <tr key={i}>
                    <td className="px-3 py-2 text-text/40 tabular-nums whitespace-nowrap text-xs">
                      {new Date(log.created_at as string).toLocaleString('fr-FR')}
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-mono text-xs bg-bg3 text-accent px-1.5 py-0.5 rounded">
                        {log.agent_type as string}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-text/60 truncate max-w-[160px] text-xs">
                      {log.input_summary as string}
                    </td>
                    <td className="px-3 py-2 text-text/60 truncate max-w-[160px] text-xs">
                      {log.output_summary as string}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-text/50">
                      {log.tokens as number}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-text/50">
                      ${(log.cost_usd as number)?.toFixed(4)}
                    </td>
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
