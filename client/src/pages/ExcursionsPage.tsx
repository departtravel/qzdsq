import { useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  useExcursions,
  useCreateExcursion,
  useUpdateExcursion,
  useCostBreakdown,
} from '../api/hooks'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import Spinner from '../components/ui/Spinner'

interface Excursion {
  id: string
  name: string
  code: string
  min_pax: number
  max_pax: number
  duration_hours: number
  meal_cost: number
  accommodation_cost: number
  extras_cost: number
  activity_cost: number
  child_price: number
  guide_cost: number
  transport_cost: number
  camp_cost: number
  other_cost: number
  description?: string
}

function CostCalculator({ excursion }: { excursion: Excursion }) {
  const [pax, setPax] = useState(excursion.min_pax || 1)
  const { data: breakdown, isFetching } = useCostBreakdown(excursion.id, pax)

  const perPersonCosts = [
    { label: 'Repas', key: 'meal_cost' },
    { label: 'Hébergement', key: 'accommodation_cost' },
    { label: 'Extras', key: 'extras_cost' },
    { label: 'Activité', key: 'activity_cost' },
  ]

  const sharedCosts = [
    { label: 'Guide', key: 'guide_cost' },
    { label: 'Transport', key: 'transport_cost' },
    { label: 'Camp', key: 'camp_cost' },
    { label: 'Autres', key: 'other_cost' },
  ]

  const totalPerPerson = breakdown?.cost_per_person ?? 0
  const totalCost = breakdown?.total_cost ?? 0

  return (
    <div className="space-y-6">
      {/* Cost breakdown table */}
      <div>
        <h3 className="text-xs font-semibold text-text/40 uppercase tracking-wide mb-3">
          Coûts par personne
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {perPersonCosts.map((c) => (
            <div key={c.key} className="bg-bg3 rounded-md px-3 py-2 flex justify-between text-sm">
              <span className="text-text/60">{c.label}</span>
              <span className="tabular-nums text-text">
                {(excursion[c.key as keyof Excursion] as number)?.toFixed(3)} TND
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold text-text/40 uppercase tracking-wide mb-3">
          Coûts partagés
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {sharedCosts.map((c) => (
            <div key={c.key} className="bg-bg3 rounded-md px-3 py-2 flex justify-between text-sm">
              <span className="text-text/60">{c.label}</span>
              <span className="tabular-nums text-text">
                {(excursion[c.key as keyof Excursion] as number)?.toFixed(3)} TND
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Calculator */}
      <div className="bg-accent/10 border border-accent/20 rounded-xl p-4">
        <h3 className="text-xs font-semibold text-accent uppercase tracking-wide mb-3">
          Calculateur de coût
        </h3>
        <div className="flex items-center gap-3 mb-4">
          <label className="text-sm text-text/60">Nombre de pax :</label>
          <input
            type="number"
            value={pax}
            onChange={(e) => setPax(Number(e.target.value))}
            min={1}
            max={100}
            className="w-24 bg-bg3 border border-border rounded-md px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
          {isFetching && <Spinner size="sm" />}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-bg2 rounded-lg p-3">
            <div className="text-xs text-text/40 uppercase tracking-wide">Coût / personne</div>
            <div className="text-xl font-bold text-accent tabular-nums mt-1">
              {totalPerPerson.toFixed(3)} TND
            </div>
          </div>
          <div className="bg-bg2 rounded-lg p-3">
            <div className="text-xs text-text/40 uppercase tracking-wide">Coût total</div>
            <div className="text-xl font-bold text-success tabular-nums mt-1">
              {totalCost.toFixed(3)} TND
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ExcursionsPage() {
  const { data: excursions = [], isLoading } = useExcursions()
  const createExcursion = useCreateExcursion()
  const updateExcursion = useUpdateExcursion()

  const [selected, setSelected] = useState<Excursion | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editMode, setEditMode] = useState(false)

  const createForm = useForm<Excursion>()
  const editForm = useForm<Excursion>()

  function handleCreate(data: Excursion) {
    createExcursion.mutate(data as unknown as Record<string, unknown>, {
      onSuccess: () => { setShowCreate(false); createForm.reset() },
    })
  }

  function handleUpdate(data: Excursion) {
    if (!selected) return
    updateExcursion.mutate(
      { id: selected.id, ...(data as unknown as Record<string, unknown>) },
      { onSuccess: () => { setEditMode(false); setSelected(null) } },
    )
  }

  const fields = [
    { key: 'meal_cost', label: 'Repas (TND/pers)' },
    { key: 'accommodation_cost', label: 'Hébergement (TND/pers)' },
    { key: 'extras_cost', label: 'Extras (TND/pers)' },
    { key: 'activity_cost', label: 'Activité (TND/pers)' },
    { key: 'child_price', label: 'Prix enfant (TND)' },
    { key: 'guide_cost', label: 'Guide (TND)' },
    { key: 'transport_cost', label: 'Transport (TND)' },
    { key: 'camp_cost', label: 'Camp (TND)' },
    { key: 'other_cost', label: 'Autres (TND)' },
  ]

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text">Excursions</h1>
          <p className="text-text/40 text-sm mt-0.5">Catalogue et structure tarifaire</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          + Nouvelle excursion
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {excursions.map((exc: Excursion) => (
            <div
              key={exc.id}
              onClick={() => { setSelected(exc); setEditMode(false) }}
              className="bg-bg2 border border-border rounded-xl p-4 cursor-pointer hover:border-accent/40 transition-colors group"
            >
              <div className="flex items-start justify-between mb-2">
                <span className="font-mono text-xs bg-accent/15 text-accent px-2 py-0.5 rounded">
                  {exc.code}
                </span>
                <span className="text-xs text-text/40">{exc.duration_hours}h</span>
              </div>
              <div className="font-semibold text-text text-sm leading-snug group-hover:text-accent transition-colors">
                {exc.name}
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs text-text/40">
                <span>
                  {exc.min_pax}–{exc.max_pax} pax
                </span>
              </div>
            </div>
          ))}
          {excursions.length === 0 && (
            <div className="col-span-full text-center py-16 text-text/30">
              Aucune excursion configurée.
            </div>
          )}
        </div>
      )}

      {/* Detail modal */}
      <Modal
        isOpen={!!selected}
        onClose={() => { setSelected(null); setEditMode(false) }}
        title={selected?.name ?? ''}
        size="xl"
      >
        {selected && (
          <div>
            {editMode ? (
              <form onSubmit={editForm.handleSubmit(handleUpdate)} className="grid grid-cols-2 gap-4">
                <Input label="Nom" defaultValue={selected.name} {...editForm.register('name')} />
                <Input label="Code" defaultValue={selected.code} {...editForm.register('code')} />
                <Input label="Pax min" type="number" defaultValue={selected.min_pax} {...editForm.register('min_pax')} />
                <Input label="Pax max" type="number" defaultValue={selected.max_pax} {...editForm.register('max_pax')} />
                <Input label="Durée (h)" type="number" defaultValue={selected.duration_hours} {...editForm.register('duration_hours')} />
                {fields.map((f) => (
                  <Input
                    key={f.key}
                    label={f.label}
                    type="number"
                    step="0.001"
                    defaultValue={selected[f.key as keyof Excursion] as number}
                    {...editForm.register(f.key as keyof Excursion)}
                  />
                ))}
                <div className="col-span-2 flex justify-end gap-2 pt-3 border-t border-border">
                  <Button variant="ghost" type="button" onClick={() => setEditMode(false)}>Annuler</Button>
                  <Button type="submit" loading={updateExcursion.isPending}>Enregistrer</Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <Button size="sm" variant="ghost" onClick={() => setEditMode(true)}>
                    Modifier
                  </Button>
                </div>
                <CostCalculator excursion={selected} />
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Create modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Nouvelle excursion"
        size="xl"
      >
        <form onSubmit={createForm.handleSubmit(handleCreate)} className="grid grid-cols-2 gap-4">
          <Input label="Nom" {...createForm.register('name', { required: true })} />
          <Input label="Code" {...createForm.register('code', { required: true })} />
          <Input label="Pax min" type="number" defaultValue={1} {...createForm.register('min_pax')} />
          <Input label="Pax max" type="number" defaultValue={20} {...createForm.register('max_pax')} />
          <Input label="Durée (heures)" type="number" defaultValue={8} {...createForm.register('duration_hours')} />
          {fields.map((f) => (
            <Input
              key={f.key}
              label={f.label}
              type="number"
              step="0.001"
              defaultValue={0}
              {...createForm.register(f.key as keyof Excursion)}
            />
          ))}
          <div className="col-span-2 flex justify-end gap-2 pt-3 border-t border-border">
            <Button variant="ghost" type="button" onClick={() => setShowCreate(false)}>Annuler</Button>
            <Button type="submit" loading={createExcursion.isPending}>Créer</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
