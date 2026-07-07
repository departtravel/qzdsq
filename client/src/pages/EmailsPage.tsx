import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useParseEmail, useCreateReservation, useAgentLogs, useExcursions, useOtas } from '../api/hooks'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Spinner from '../components/ui/Spinner'

export default function EmailsPage() {
  const [emailText, setEmailText] = useState('')
  const [parsedData, setParsedData] = useState<Record<string, unknown> | null>(null)
  const parseEmail = useParseEmail()
  const createReservation = useCreateReservation()
  const { data: logs = [], isLoading: logsLoading } = useAgentLogs()
  const { data: excursions = [] } = useExcursions()
  const { data: otas = [] } = useOtas()

  const form = useForm()

  async function handleParse() {
    if (!emailText.trim()) return
    const result = await parseEmail.mutateAsync({ email_text: emailText })
    setParsedData(result.extracted ?? result)
    if (result.extracted) {
      Object.entries(result.extracted).forEach(([key, val]) => {
        form.setValue(key, val)
      })
    }
  }

  function handleCreate(data: Record<string, unknown>) {
    createReservation.mutate(data, {
      onSuccess: () => {
        setParsedData(null)
        setEmailText('')
        form.reset()
      },
    })
  }

  const excursionOptions = excursions.map((e: Record<string, unknown>) => ({
    value: String(e.id),
    label: String(e.name),
  }))

  const otaOptions = otas.map((o: Record<string, unknown>) => ({
    value: String(o.id),
    label: String(o.name),
  }))

  const emailLogs = logs.filter(
    (l: Record<string, unknown>) => l.agent_type === 'voyage' || l.action === 'parse_email',
  )

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-text">Emails IA</h1>
        <p className="text-text/40 text-sm mt-0.5">Analyse et extraction automatique des réservations</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Email input */}
        <div className="bg-bg2 border border-border rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-text/60 uppercase tracking-wide">
            Email à analyser
          </h2>
          <textarea
            value={emailText}
            onChange={(e) => setEmailText(e.target.value)}
            rows={14}
            placeholder="Collez ou tapez le contenu de l'email ici..."
            className="w-full bg-bg3 border border-border rounded-md px-3 py-2 text-sm text-text placeholder-text/30 focus:outline-none focus:ring-2 focus:ring-accent/40 resize-none font-mono"
          />
          <Button
            onClick={handleParse}
            loading={parseEmail.isPending}
            disabled={!emailText.trim()}
            className="w-full justify-center"
          >
            ✨ Analyser avec IA
          </Button>
          {parseEmail.isError && (
            <p className="text-sm text-alert">
              Erreur lors de l'analyse. Vérifiez la connexion.
            </p>
          )}
        </div>

        {/* Right: Extracted data */}
        <div className="bg-bg2 border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-text/60 uppercase tracking-wide mb-4">
            Données extraites
          </h2>
          {parseEmail.isPending ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Spinner size="lg" />
              <p className="text-text/40 text-sm">Analyse en cours...</p>
            </div>
          ) : parsedData ? (
            <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Nom client"
                  {...form.register('client_name')}
                />
                <Input
                  label="Email client"
                  type="email"
                  {...form.register('client_email')}
                />
                <Input
                  label="Téléphone"
                  {...form.register('client_phone')}
                />
                <Input
                  label="Date excursion"
                  type="date"
                  {...form.register('excursion_date')}
                />
                <Select
                  label="Excursion"
                  options={excursionOptions}
                  placeholder="Choisir"
                  {...form.register('excursion_id')}
                />
                <Select
                  label="OTA"
                  options={otaOptions}
                  placeholder="Choisir"
                  {...form.register('ota_id')}
                />
                <Input
                  label="Réf OTA"
                  {...form.register('ota_ref')}
                />
                <Input
                  label="Pax"
                  type="number"
                  {...form.register('pax')}
                />
                <Input
                  label="Hôtel"
                  {...form.register('hotel')}
                />
                <Input
                  label="Heure pickup"
                  type="time"
                  {...form.register('pickup_time')}
                />
                <Input
                  label="Prix vente (TND)"
                  type="number"
                  step="0.001"
                  {...form.register('sale_price_tnd')}
                  className="col-span-2"
                />
              </div>

              {/* Raw JSON preview */}
              <details className="mt-2">
                <summary className="text-xs text-text/30 cursor-pointer hover:text-text/50">
                  Voir JSON brut
                </summary>
                <pre className="mt-2 bg-bg3 rounded p-3 text-xs text-text/50 overflow-x-auto font-mono">
                  {JSON.stringify(parsedData, null, 2)}
                </pre>
              </details>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <Button variant="ghost" type="button" onClick={() => setParsedData(null)}>
                  Effacer
                </Button>
                <Button type="submit" loading={createReservation.isPending}>
                  Créer la réservation
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <span className="text-4xl mb-3">✉️</span>
              <p className="text-text/30 text-sm">
                Collez un email à gauche et cliquez sur "Analyser avec IA" pour extraire les données.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* History */}
      <div className="bg-bg2 border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-text/60 uppercase tracking-wide mb-4">
          Historique des analyses
        </h2>
        {logsLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : emailLogs.length === 0 ? (
          <p className="text-text/30 text-sm text-center py-4">Aucun historique disponible.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-text/40 text-xs uppercase tracking-wide">
                  <th className="text-left pb-2 font-medium">Date</th>
                  <th className="text-left pb-2 font-medium">Entrée</th>
                  <th className="text-left pb-2 font-medium">Résultat</th>
                  <th className="text-right pb-2 font-medium tabular-nums">Tokens</th>
                  <th className="text-right pb-2 font-medium tabular-nums">Coût $</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {emailLogs.map((log: Record<string, unknown>, i: number) => (
                  <tr key={i}>
                    <td className="py-2 text-text/40 tabular-nums whitespace-nowrap">
                      {new Date(log.created_at as string).toLocaleString('fr-FR')}
                    </td>
                    <td className="py-2 text-text/60 truncate max-w-[200px]">
                      {log.input_summary as string}
                    </td>
                    <td className="py-2 text-text/60 truncate max-w-[200px]">
                      {log.output_summary as string}
                    </td>
                    <td className="py-2 text-right tabular-nums text-text/50">
                      {log.tokens as number}
                    </td>
                    <td className="py-2 text-right tabular-nums text-text/50">
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
