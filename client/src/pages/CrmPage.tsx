import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useCrmClients, useCrmClient, useClientHistory } from '../api/hooks'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import Spinner from '../components/ui/Spinner'

interface Client {
  id: string
  name: string
  email: string
  phone: string
  nationality: string
  total_bookings: number
  total_spent_tnd: number
  loyalty_points: number
  preferences?: string
}

function ClientDetail({ clientId }: { clientId: string }) {
  const { data: client, isLoading } = useCrmClient(clientId)
  const { data: history = [], isLoading: histLoading } = useClientHistory(clientId)
  const form = useForm<Client>()
  const [editMode, setEditMode] = useState(false)

  if (isLoading) return <div className="flex justify-center py-8"><Spinner /></div>
  if (!client) return null

  return (
    <div className="space-y-6">
      {/* Info */}
      {editMode ? (
        <form className="grid grid-cols-2 gap-3">
          <Input label="Nom" defaultValue={client.name} {...form.register('name')} />
          <Input label="Email" type="email" defaultValue={client.email} {...form.register('email')} />
          <Input label="Téléphone" defaultValue={client.phone} {...form.register('phone')} />
          <Input label="Nationalité" defaultValue={client.nationality} {...form.register('nationality')} />
          <Input
            label="Préférences"
            defaultValue={client.preferences}
            {...form.register('preferences')}
            className="col-span-2"
          />
          <div className="col-span-2 flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="ghost" type="button" onClick={() => setEditMode(false)}>Annuler</Button>
            <Button type="submit">Enregistrer</Button>
          </div>
        </form>
      ) : (
        <div>
          <div className="flex justify-end mb-3">
            <Button size="sm" variant="ghost" onClick={() => setEditMode(true)}>Modifier</Button>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['Email', client.email],
              ['Téléphone', client.phone],
              ['Nationalité', client.nationality],
            ].map(([label, val]) => (
              <div key={label}>
                <div className="text-xs text-text/40 uppercase tracking-wide">{label}</div>
                <div className="text-text mt-0.5">{val || '—'}</div>
              </div>
            ))}
            {client.preferences && (
              <div className="col-span-2">
                <div className="text-xs text-text/40 uppercase tracking-wide">Préférences</div>
                <div className="text-text/70 mt-0.5 text-sm">{client.preferences}</div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-bg3 rounded-lg p-3 text-center">
              <div className="text-xs text-text/40 uppercase tracking-wide">Réservations</div>
              <div className="text-xl font-bold text-text tabular-nums mt-1">
                {client.total_bookings}
              </div>
            </div>
            <div className="bg-bg3 rounded-lg p-3 text-center">
              <div className="text-xs text-text/40 uppercase tracking-wide">Dépenses TND</div>
              <div className="text-xl font-bold text-accent tabular-nums mt-1">
                {client.total_spent_tnd?.toFixed(0)}
              </div>
            </div>
            <div className="bg-bg3 rounded-lg p-3 text-center">
              <div className="text-xs text-text/40 uppercase tracking-wide">Points fidélité</div>
              <div className="text-xl font-bold text-warning tabular-nums mt-1">
                {client.loyalty_points}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History */}
      <div>
        <h3 className="text-sm font-semibold text-text/60 uppercase tracking-wide mb-3">
          Historique des réservations
        </h3>
        {histLoading ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : history.length === 0 ? (
          <p className="text-text/30 text-sm">Aucune réservation.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg3 border-b border-border">
                <tr className="text-text/40 text-xs uppercase tracking-wide">
                  <th className="text-left px-3 py-2 font-medium">Date</th>
                  <th className="text-left px-3 py-2 font-medium">Excursion</th>
                  <th className="text-left px-3 py-2 font-medium">Statut</th>
                  <th className="text-right px-3 py-2 font-medium">Prix</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {history.map((h: Record<string, unknown>, i: number) => (
                  <tr key={i}>
                    <td className="px-3 py-2 text-text/50 tabular-nums">{h.excursion_date as string}</td>
                    <td className="px-3 py-2 text-text">{h.excursion_name as string}</td>
                    <td className="px-3 py-2">
                      <Badge variant={(h.status as 'confirmed' | 'cancelled' | 'modified' | 'pending') ?? 'pending'} />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-accent">
                      {(h.sale_price_tnd as number)?.toFixed(3)} TND
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

export default function CrmPage() {
  const { data: clients = [], isLoading } = useCrmClients()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const filtered = clients.filter((c: Client) =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text">CRM Clients</h1>
          <p className="text-text/40 text-sm mt-0.5">Gestion de la relation client</p>
        </div>
        <input
          type="search"
          placeholder="Rechercher un client..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-bg3 border border-border rounded-md px-3 py-1.5 text-sm text-text placeholder-text/30 focus:outline-none focus:ring-2 focus:ring-accent/40 w-64"
        />
      </div>

      <div className="bg-bg2 border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg3 border-b border-border">
                <tr className="text-text/40 text-xs uppercase tracking-wide">
                  <th className="text-left px-4 py-3 font-medium">Nom</th>
                  <th className="text-left px-4 py-3 font-medium">Email</th>
                  <th className="text-left px-4 py-3 font-medium">Téléphone</th>
                  <th className="text-left px-4 py-3 font-medium">Nationalité</th>
                  <th className="text-right px-4 py-3 font-medium tabular-nums">Réservations</th>
                  <th className="text-right px-4 py-3 font-medium tabular-nums">Dépenses TND</th>
                  <th className="text-right px-4 py-3 font-medium tabular-nums">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-text/30">
                      Aucun client trouvé
                    </td>
                  </tr>
                ) : (
                  filtered.map((c: Client) => (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      className="hover:bg-bg3/50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-text">{c.name}</td>
                      <td className="px-4 py-3 text-text/60">{c.email}</td>
                      <td className="px-4 py-3 text-text/60 tabular-nums">{c.phone}</td>
                      <td className="px-4 py-3 text-text/50">{c.nationality}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{c.total_bookings}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-accent">
                        {c.total_spent_tnd?.toFixed(0)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-warning">
                        {c.loyalty_points}
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
        isOpen={!!selectedId}
        onClose={() => setSelectedId(null)}
        title={clients.find((c: Client) => c.id === selectedId)?.name ?? 'Client'}
        size="xl"
      >
        {selectedId && <ClientDetail clientId={selectedId} />}
      </Modal>
    </div>
  )
}
