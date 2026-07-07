import { useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  useWorkflowBoard,
  useAssignReservation,
  useBookSuppliers,
  useAdvanceWorkflow,
  useTasks,
  useCreateTask,
  usePartners,
} from '../api/hooks'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Spinner from '../components/ui/Spinner'
import apiClient from '../api/client'

const COLUMNS = [
  { step: 0, label: 'Nouvelles réservations', color: 'text-alert', dot: 'bg-alert' },
  { step: 1, label: 'Employé 1 — Assignation', color: 'text-warning', dot: 'bg-warning' },
  { step: 2, label: 'Employé 2 — Fournisseurs', color: 'text-accent2', dot: 'bg-accent2' },
  { step: 3, label: 'Impression ordre de mission', color: 'text-success', dot: 'bg-success' },
]

interface Reservation {
  id: string
  client_name: string
  excursion_name: string
  excursion_date: string
  pax: number
  status: string
  workflow_step: number
  driver?: string
  guide?: string
  transporter?: string
  task_count?: number
}

export default function WorkflowPage() {
  const { data: board, isLoading } = useWorkflowBoard()
  const { data: tasks = [] } = useTasks()
  const { data: partners = [] } = usePartners()

  const [selected, setSelected] = useState<Reservation | null>(null)
  const [showTaskModal, setShowTaskModal] = useState(false)

  const assignMutation = useAssignReservation()
  const bookMutation = useBookSuppliers()
  const advanceMutation = useAdvanceWorkflow()
  const createTask = useCreateTask()

  const assignForm = useForm()
  const bookForm = useForm()
  const taskForm = useForm()

  const partnerOptions = partners.map((p: Record<string, unknown>) => ({
    value: String(p.id),
    label: String(p.name),
  }))

  async function handlePrint(id: string) {
    try {
      const res = await apiClient.get(`/pdf/mission-order/${id}`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `ordre-mission-${id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert("Erreur lors de la génération du PDF.")
    }
  }

  function handleAssign(data: Record<string, unknown>) {
    if (!selected) return
    assignMutation.mutate(
      { id: selected.id, ...data },
      { onSuccess: () => setSelected(null) },
    )
  }

  function handleBook(data: Record<string, unknown>) {
    if (!selected) return
    bookMutation.mutate(
      { id: selected.id, ...data },
      { onSuccess: () => setSelected(null) },
    )
  }

  function handleCreateTask(data: Record<string, unknown>) {
    createTask.mutate(data, { onSuccess: () => { setShowTaskModal(false); taskForm.reset() } })
  }

  const freeTasks = tasks.filter((t: Record<string, unknown>) => !t.reservation_id)

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text">Workflow</h1>
          <p className="text-text/40 text-sm mt-0.5">Suivi des étapes de traitement</p>
        </div>
        <Button size="sm" onClick={() => setShowTaskModal(true)}>
          + Ajouter tâche
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
          {/* Kanban columns */}
          {COLUMNS.map((col) => {
            const cards: Reservation[] = board?.[col.step] ?? []
            return (
              <div key={col.step} className="bg-bg2 border border-border rounded-xl flex flex-col">
                <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                  <span className={`text-xs font-semibold uppercase tracking-wide ${col.color}`}>
                    {col.label}
                  </span>
                  <span className="ml-auto text-xs bg-bg3 text-text/40 rounded px-1.5 py-0.5">
                    {cards.length}
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {cards.length === 0 && (
                    <p className="text-text/20 text-xs text-center py-6">Vide</p>
                  )}
                  {cards.map((r) => (
                    <div
                      key={r.id}
                      onClick={() => setSelected(r)}
                      className="bg-bg3 border border-border rounded-lg p-3 cursor-pointer hover:border-accent/40 transition-colors"
                    >
                      <div className="font-medium text-sm text-text truncate">{r.client_name}</div>
                      <div className="text-xs text-text/50 truncate mt-0.5">{r.excursion_name}</div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-text/40 tabular-nums">
                          {r.excursion_date}
                        </span>
                        <span className="text-xs text-text/40">x{r.pax}</span>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <Badge
                          variant={(r.status as 'confirmed' | 'cancelled' | 'modified' | 'pending') ?? 'pending'}
                        />
                        {(r.task_count ?? 0) > 0 && (
                          <span className="text-xs bg-accent/15 text-accent rounded px-1.5 py-0.5">
                            {r.task_count} tâche{r.task_count !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {/* Free tasks column */}
          <div className="bg-bg2 border border-border rounded-xl flex flex-col">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent" />
              <span className="text-xs font-semibold uppercase tracking-wide text-accent">
                Tâches libres
              </span>
              <span className="ml-auto text-xs bg-bg3 text-text/40 rounded px-1.5 py-0.5">
                {freeTasks.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {freeTasks.length === 0 && (
                <p className="text-text/20 text-xs text-center py-6">Vide</p>
              )}
              {freeTasks.map((t: Record<string, unknown>) => (
                <div
                  key={String(t.id)}
                  className="bg-bg3 border border-border rounded-lg p-3"
                >
                  <div className="font-medium text-sm text-text">{t.title as string}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge
                      variant={(t.priority as 'normal' | 'high' | 'urgent') ?? 'normal'}
                      label={t.priority as string}
                    />
                    <Badge
                      variant={(t.status as 'todo' | 'in_progress' | 'done') ?? 'todo'}
                    />
                  </div>
                  {t.due_date != null && (
                    <div className="text-xs text-text/40 mt-1 tabular-nums">
                      Échéance : {String(t.due_date)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Side panel / detail modal */}
      <Modal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `${selected.client_name} — ${selected.excursion_name}` : ''}
        size="lg"
      >
        {selected && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-text/40 text-xs uppercase tracking-wide">Date</span>
                <div className="text-text">{selected.excursion_date}</div>
              </div>
              <div>
                <span className="text-text/40 text-xs uppercase tracking-wide">Pax</span>
                <div className="text-text">{selected.pax}</div>
              </div>
              <div>
                <span className="text-text/40 text-xs uppercase tracking-wide">Statut</span>
                <div>
                  <Badge variant={(selected.status as 'confirmed' | 'cancelled' | 'modified' | 'pending') ?? 'pending'} />
                </div>
              </div>
              <div>
                <span className="text-text/40 text-xs uppercase tracking-wide">Étape</span>
                <div className="text-text">{selected.workflow_step}</div>
              </div>
            </div>

            {/* Step 1: Assignment */}
            {selected.workflow_step <= 1 && (
              <div>
                <h3 className="text-sm font-semibold text-warning mb-3">
                  Étape 1 — Assignation
                </h3>
                <form onSubmit={assignForm.handleSubmit(handleAssign)} className="grid grid-cols-1 gap-3">
                  <Input
                    label="Chauffeur"
                    defaultValue={selected.driver}
                    {...assignForm.register('driver')}
                  />
                  <Input
                    label="Guide"
                    defaultValue={selected.guide}
                    {...assignForm.register('guide')}
                  />
                  <Input
                    label="Transporteur"
                    defaultValue={selected.transporter}
                    {...assignForm.register('transporter')}
                  />
                  <Button type="submit" size="sm" variant="secondary" loading={assignMutation.isPending}>
                    Sauvegarder assignation
                  </Button>
                </form>
              </div>
            )}

            {/* Step 2: Book suppliers */}
            {selected.workflow_step === 2 && (
              <div>
                <h3 className="text-sm font-semibold text-accent2 mb-3">
                  Étape 2 — Réservation fournisseurs
                </h3>
                <form onSubmit={bookForm.handleSubmit(handleBook)} className="grid grid-cols-2 gap-3">
                  <Select
                    label="Partenaire"
                    options={partnerOptions}
                    placeholder="Choisir un partenaire"
                    {...bookForm.register('partner_id')}
                  />
                  <Input
                    label="Montant (TND)"
                    type="number"
                    step="0.001"
                    {...bookForm.register('amount')}
                  />
                  <Input
                    label="Notes"
                    {...bookForm.register('notes')}
                    className="col-span-2"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    variant="secondary"
                    loading={bookMutation.isPending}
                    className="col-span-2"
                  >
                    Confirmer réservation fournisseur
                  </Button>
                </form>
              </div>
            )}

            {/* Step 3: Print */}
            {selected.workflow_step === 3 && (
              <div>
                <h3 className="text-sm font-semibold text-success mb-3">
                  Étape 3 — Impression ordre de mission
                </h3>
                <Button
                  variant="primary"
                  onClick={() => handlePrint(selected.id)}
                >
                  🖨️ Imprimer ordre de mission
                </Button>
              </div>
            )}

            {/* Advance workflow */}
            {selected.workflow_step < 3 && (
              <div className="pt-4 border-t border-border flex justify-between">
                <Button variant="ghost" onClick={() => setSelected(null)}>
                  Fermer
                </Button>
                <Button
                  variant="primary"
                  loading={advanceMutation.isPending}
                  onClick={() =>
                    advanceMutation.mutate(
                      { id: selected.id, step: selected.workflow_step + 1 },
                      { onSuccess: () => setSelected(null) },
                    )
                  }
                >
                  {'Passer à l\'étape suivante →'}
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Create task modal */}
      <Modal
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        title="Ajouter une tâche"
        size="md"
      >
        <form onSubmit={taskForm.handleSubmit(handleCreateTask)} className="space-y-4">
          <Input
            label="Titre"
            {...taskForm.register('title', { required: true })}
          />
          <Select
            label="Type"
            options={[
              { value: 'general', label: 'Général' },
              { value: 'booking', label: 'Réservation' },
              { value: 'admin', label: 'Administratif' },
              { value: 'accounting', label: 'Comptabilité' },
            ]}
            {...taskForm.register('type')}
          />
          <Select
            label="Priorité"
            options={[
              { value: 'normal', label: 'Normal' },
              { value: 'high', label: 'Haute' },
              { value: 'urgent', label: 'Urgent' },
            ]}
            {...taskForm.register('priority')}
          />
          <Input
            label="Échéance"
            type="date"
            {...taskForm.register('due_date')}
          />
          <Input
            label="Notes"
            {...taskForm.register('notes')}
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="ghost" type="button" onClick={() => setShowTaskModal(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={createTask.isPending}>
              Créer
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
