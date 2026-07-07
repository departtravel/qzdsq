import { useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  useReservations,
  useCreateReservation,
  useUpdateReservation,
  useExcursions,
  useOtas,
} from '../api/hooks'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Spinner from '../components/ui/Spinner'

const WORKFLOW_LABELS: Record<number, string> = {
  0: 'Nouveau',
  1: 'Assigné',
  2: 'Réservé',
  3: 'Imprimé',
}

const WORKFLOW_COLORS: Record<number, string> = {
  0: 'bg-alert/20 text-alert',
  1: 'bg-warning/20 text-warning',
  2: 'bg-accent2/20 text-accent2',
  3: 'bg-success/20 text-success',
}

function exportToCSV(data: Record<string, unknown>[]) {
  if (!data.length) return
  const keys = Object.keys(data[0])
  const rows = [
    keys.join(','),
    ...data.map((row) =>
      keys.map((k) => `"${String(row[k] ?? '').replace(/"/g, '""')}"`).join(','),
    ),
  ]
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'planning.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function PlanningPage() {
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const { data: reservations = [], isLoading } = useReservations(filters)
  const { data: excursions = [] } = useExcursions()
  const { data: otas = [] } = useOtas()

  const createReservation = useCreateReservation()
  const updateReservation = useUpdateReservation()

  const selected = reservations.find((r: Record<string, unknown>) => r.id === selectedId)

  const createForm = useForm()
  const editForm = useForm()

  function handleCreate(data: Record<string, unknown>) {
    createReservation.mutate(data, {
      onSuccess: () => {
        setShowCreate(false)
        createForm.reset()
      },
    })
  }

  function handleUpdate(data: Record<string, unknown>) {
    if (!selectedId) return
    updateReservation.mutate(
      { id: selectedId, ...data },
      { onSuccess: () => setSelectedId(null) },
    )
  }

  const excursionOptions = excursions.map((e: Record<string, unknown>) => ({
    value: String(e.id),
    label: String(e.name),
  }))

  const otaOptions = otas.map((o: Record<string, unknown>) => ({
    value: String(o.id),
    label: String(o.name),
  }))

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text">Planning</h1>
          <p className="text-text/40 text-sm mt-0.5">Gestion des réservations</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => exportToCSV(reservations)}>
            Exporter CSV
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            + Nouvelle réservation
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-bg2 border border-border rounded-xl p-4 flex flex-wrap gap-3">
        <input
          type="date"
          className="bg-bg3 border border-border rounded-md px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent/40"
          placeholder="Date début"
          onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value }))}
        />
        <input
          type="date"
          className="bg-bg3 border border-border rounded-md px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent/40"
          placeholder="Date fin"
          onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value }))}
        />
        <select
          className="bg-bg3 border border-border rounded-md px-3 py-1.5 text-sm text-text focus:outline-none"
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
        >
          <option value="">Tous statuts</option>
          <option value="confirmed">Confirmé</option>
          <option value="cancelled">Annulé</option>
          <option value="modified">Modifié</option>
          <option value="pending">En attente</option>
        </select>
        <select
          className="bg-bg3 border border-border rounded-md px-3 py-1.5 text-sm text-text focus:outline-none"
          onChange={(e) => setFilters((f) => ({ ...f, workflow_step: e.target.value }))}
        >
          <option value="">Toutes étapes</option>
          {[0, 1, 2, 3].map((s) => (
            <option key={s} value={String(s)}>
              {WORKFLOW_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
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
                  {[
                    'Date reçue',
                    'Date excursion',
                    'Client',
                    'OTA',
                    'Réf OTA',
                    'Excursion',
                    'Statut',
                    'Pax',
                    'Prix vente',
                    'Commission',
                    'Prix net',
                    'Hôtel',
                    'Heure pickup',
                    'Chauffeur',
                    'Guide',
                    'Étape',
                  ].map((h) => (
                    <th key={h} className="text-left px-3 py-3 font-medium whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {reservations.length === 0 ? (
                  <tr>
                    <td colSpan={16} className="text-center py-12 text-text/30">
                      Aucune réservation
                    </td>
                  </tr>
                ) : (
                  reservations.map((r: Record<string, unknown>) => (
                    <tr
                      key={String(r.id)}
                      onClick={() => setSelectedId(String(r.id))}
                      className="hover:bg-bg3/50 cursor-pointer transition-colors"
                    >
                      <td className="px-3 py-2.5 tabular-nums text-text/60 whitespace-nowrap">
                        {r.received_date as string}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">
                        {r.excursion_date as string}
                      </td>
                      <td className="px-3 py-2.5 font-medium whitespace-nowrap">{r.client_name as string}</td>
                      <td className="px-3 py-2.5 text-text/60">{r.ota_name as string}</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-text/50">
                        {r.ota_ref as string}
                      </td>
                      <td className="px-3 py-2.5 text-text/70">{r.excursion_name as string}</td>
                      <td className="px-3 py-2.5">
                        <Badge
                          variant={
                            (r.status as 'confirmed' | 'cancelled' | 'modified' | 'pending') ??
                            'pending'
                          }
                        />
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-center">{r.pax as number}</td>
                      <td className="px-3 py-2.5 tabular-nums text-accent">
                        {r.sale_price_tnd as string}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-text/60">
                        {r.commission as string}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-success">
                        {r.net_price as string}
                      </td>
                      <td className="px-3 py-2.5 text-text/60">{r.hotel as string}</td>
                      <td className="px-3 py-2.5 tabular-nums text-text/60">
                        {r.pickup_time as string}
                      </td>
                      <td className="px-3 py-2.5 text-text/60">{r.driver as string}</td>
                      <td className="px-3 py-2.5 text-text/60">{r.guide as string}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                            WORKFLOW_COLORS[Number(r.workflow_step ?? 0)]
                          }`}
                        >
                          {WORKFLOW_LABELS[Number(r.workflow_step ?? 0)]}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit modal */}
      <Modal
        isOpen={!!selectedId}
        onClose={() => setSelectedId(null)}
        title="Modifier la réservation"
        size="xl"
      >
        {selected && (
          <form onSubmit={editForm.handleSubmit(handleUpdate)} className="grid grid-cols-2 gap-4">
            <Input
              label="Client"
              defaultValue={selected.client_name as string}
              {...editForm.register('client_name')}
            />
            <Input
              label="Email client"
              defaultValue={selected.client_email as string}
              {...editForm.register('client_email')}
            />
            <Input
              label="Téléphone"
              defaultValue={selected.client_phone as string}
              {...editForm.register('client_phone')}
            />
            <Input
              label="Date excursion"
              type="date"
              defaultValue={selected.excursion_date as string}
              {...editForm.register('excursion_date')}
            />
            <Select
              label="Statut"
              defaultValue={selected.status as string}
              options={[
                { value: 'pending', label: 'En attente' },
                { value: 'confirmed', label: 'Confirmé' },
                { value: 'modified', label: 'Modifié' },
                { value: 'cancelled', label: 'Annulé' },
              ]}
              {...editForm.register('status')}
            />
            <Input
              label="Nombre de pax"
              type="number"
              defaultValue={selected.pax as number}
              {...editForm.register('pax')}
            />
            <Input
              label="Hôtel"
              defaultValue={selected.hotel as string}
              {...editForm.register('hotel')}
            />
            <Input
              label="Heure pickup"
              type="time"
              defaultValue={selected.pickup_time as string}
              {...editForm.register('pickup_time')}
            />
            <Input
              label="Réf OTA"
              defaultValue={selected.ota_ref as string}
              {...editForm.register('ota_ref')}
            />
            <Input
              label="Prix vente (TND)"
              type="number"
              step="0.001"
              defaultValue={selected.sale_price_tnd as number}
              {...editForm.register('sale_price_tnd')}
            />
            <Input
              label="Notes"
              defaultValue={selected.notes as string}
              {...editForm.register('notes')}
              className="col-span-2"
            />
            <div className="col-span-2 flex justify-end gap-2 mt-2 pt-4 border-t border-border">
              <Button variant="ghost" type="button" onClick={() => setSelectedId(null)}>
                Annuler
              </Button>
              <Button type="submit" loading={updateReservation.isPending}>
                Enregistrer
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Create modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Nouvelle réservation"
        size="xl"
      >
        <form onSubmit={createForm.handleSubmit(handleCreate)} className="grid grid-cols-2 gap-4">
          <Input label="Nom client" {...createForm.register('client_name', { required: true })} />
          <Input label="Email client" type="email" {...createForm.register('client_email')} />
          <Input label="Téléphone" {...createForm.register('client_phone')} />
          <Input
            label="Date excursion"
            type="date"
            {...createForm.register('excursion_date', { required: true })}
          />
          <Select
            label="Excursion"
            options={excursionOptions}
            placeholder="Choisir une excursion"
            {...createForm.register('excursion_id', { required: true })}
          />
          <Select
            label="OTA"
            options={otaOptions}
            placeholder="Choisir une OTA"
            {...createForm.register('ota_id')}
          />
          <Input label="Réf OTA" {...createForm.register('ota_ref')} />
          <Input label="Nombre de pax" type="number" defaultValue={1} {...createForm.register('pax')} />
          <Input label="Hôtel" {...createForm.register('hotel')} />
          <Input label="Heure pickup" type="time" {...createForm.register('pickup_time')} />
          <Input
            label="Prix vente (TND)"
            type="number"
            step="0.001"
            {...createForm.register('sale_price_tnd')}
          />
          <Select
            label="Statut"
            defaultValue="pending"
            options={[
              { value: 'pending', label: 'En attente' },
              { value: 'confirmed', label: 'Confirmé' },
            ]}
            {...createForm.register('status')}
          />
          <Input
            label="Notes"
            {...createForm.register('notes')}
            className="col-span-2"
          />
          <div className="col-span-2 flex justify-end gap-2 mt-2 pt-4 border-t border-border">
            <Button variant="ghost" type="button" onClick={() => setShowCreate(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={createReservation.isPending}>
              Créer
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
