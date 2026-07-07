import { useState } from 'react'
import { useOtas, useOtaMonthlySheet } from '../api/hooks'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import Modal from '../components/ui/Modal'
import apiClient from '../api/client'

interface Ota {
  id: string
  name: string
  commission_pct: number
  default_currency: string
  website?: string
}

function OtaDetail({ ota }: { ota: Ota }) {
  const currentMonth = new Date().toISOString().slice(0, 7)
  const [month, setMonth] = useState(currentMonth)
  const { data: sheet, isLoading } = useOtaMonthlySheet(ota.id, month)

  async function handleGeneratePDF() {
    try {
      const res = await apiClient.get(`/pdf/ota-statement/${ota.id}/${month}`, {
        responseType: 'blob',
      })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `releve-${ota.name}-${month}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Erreur lors de la génération du relevé PDF.')
    }
  }

  const grossRevenue = sheet?.gross_revenue ?? 0
  const commission = grossRevenue * (ota.commission_pct / 100)
  const netToReceive = grossRevenue - commission

  return (
    <div className="space-y-6">
      {/* OTA info */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-bg3 rounded-lg p-3">
          <div className="text-xs text-text/40 uppercase tracking-wide">Commission</div>
          <div className="text-xl font-bold text-accent tabular-nums mt-1">
            {ota.commission_pct}%
          </div>
        </div>
        <div className="bg-bg3 rounded-lg p-3">
          <div className="text-xs text-text/40 uppercase tracking-wide">Devise défaut</div>
          <div className="text-xl font-bold text-text mt-1">{ota.default_currency}</div>
        </div>
        {ota.website && (
          <div className="bg-bg3 rounded-lg p-3">
            <div className="text-xs text-text/40 uppercase tracking-wide">Site web</div>
            <a
              href={ota.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent2 text-sm hover:underline mt-1 block truncate"
            >
              {ota.website}
            </a>
          </div>
        )}
      </div>

      {/* Monthly sheet */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-text/60 uppercase tracking-wide">
            Relevé mensuel
          </h3>
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="bg-bg3 border border-border rounded-md px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
            <Button size="sm" variant="secondary" onClick={handleGeneratePDF}>
              Générer relevé PDF
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : sheet?.rows?.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-bg3 border-b border-border">
                  <tr className="text-text/40 text-xs uppercase tracking-wide">
                    <th className="text-left px-3 py-2 font-medium">Réf OTA</th>
                    <th className="text-left px-3 py-2 font-medium">Client</th>
                    <th className="text-left px-3 py-2 font-medium">Excursion</th>
                    <th className="text-left px-3 py-2 font-medium">Date</th>
                    <th className="text-right px-3 py-2 font-medium">Brut</th>
                    <th className="text-right px-3 py-2 font-medium">Commission</th>
                    <th className="text-right px-3 py-2 font-medium">Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {sheet.rows.map((row: Record<string, unknown>, i: number) => {
                    const brut = row.gross as number
                    const comm = brut * (ota.commission_pct / 100)
                    const net = brut - comm
                    return (
                      <tr key={i}>
                        <td className="px-3 py-2 font-mono text-xs text-text/50">
                          {row.ota_ref as string}
                        </td>
                        <td className="px-3 py-2 text-text">{row.client_name as string}</td>
                        <td className="px-3 py-2 text-text/60">{row.excursion_name as string}</td>
                        <td className="px-3 py-2 text-text/40 tabular-nums">{row.date as string}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{brut.toFixed(3)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-alert">
                          -{comm.toFixed(3)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-success">
                          {net.toFixed(3)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-3 bg-bg3 rounded-lg p-4 text-sm space-y-1.5">
              <div className="flex justify-between">
                <span className="text-text/50">Chiffre d'affaires brut</span>
                <span className="tabular-nums">{grossRevenue.toFixed(3)} TND</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text/50">
                  Commission {ota.name} ({ota.commission_pct}%)
                </span>
                <span className="tabular-nums text-alert">-{commission.toFixed(3)} TND</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-border font-semibold">
                <span className="text-text">Net à recevoir</span>
                <span className="tabular-nums text-accent">{netToReceive.toFixed(3)} TND</span>
              </div>
            </div>
          </>
        ) : (
          <p className="text-text/30 text-sm text-center py-6">Aucune données pour ce mois.</p>
        )}
      </div>
    </div>
  )
}

export default function OtasPage() {
  const { data: otas = [], isLoading } = useOtas()
  const [selected, setSelected] = useState<Ota | null>(null)

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-text">OTAs</h1>
        <p className="text-text/40 text-sm mt-0.5">Plateformes de distribution en ligne</p>
      </div>

      <div className="bg-bg2 border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg3 border-b border-border">
                <tr className="text-text/40 text-xs uppercase tracking-wide">
                  <th className="text-left px-4 py-3 font-medium">OTA</th>
                  <th className="text-left px-4 py-3 font-medium">Commission</th>
                  <th className="text-left px-4 py-3 font-medium">Devise</th>
                  <th className="text-left px-4 py-3 font-medium">Site web</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {otas.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-12 text-text/30">
                      Aucune OTA configurée
                    </td>
                  </tr>
                ) : (
                  otas.map((o: Ota) => (
                    <tr
                      key={o.id}
                      onClick={() => setSelected(o)}
                      className="hover:bg-bg3/50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-semibold text-text">{o.name}</td>
                      <td className="px-4 py-3 tabular-nums text-alert">
                        {o.commission_pct}%
                      </td>
                      <td className="px-4 py-3 text-text/60">{o.default_currency}</td>
                      <td className="px-4 py-3 text-accent2 text-xs">
                        {o.website && (
                          <a
                            href={o.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="hover:underline"
                          >
                            {o.website}
                          </a>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.name ?? ''}
        size="xl"
      >
        {selected && <OtaDetail ota={selected} />}
      </Modal>
    </div>
  )
}
