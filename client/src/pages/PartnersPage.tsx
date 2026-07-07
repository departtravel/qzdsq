import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { usePartners, useCreatePartner, useUpdatePartner, usePartnerMonthlySheet } from '../api/hooks'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Spinner from '../components/ui/Spinner'
import apiClient from '../api/client'

const PARTNER_TYPES = [
  { value: 'hotel', label: 'Hôtel' },
  { value: 'transport', label: 'Transport' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'activity', label: 'Activité' },
  { value: 'guide', label: 'Guide' },
  { value: 'other', label: 'Autre' },
]

const TYPE_COLORS: Record<string, string> = {
  hotel: 'bg-accent2/20 text-accent2',
  transport: 'bg-success/20 text-success',
  restaurant: 'bg-warning/20 text-warning',
  activity: 'bg-accent/20 text-accent',
  guide: 'bg-border/40 text-text/60',
  other: 'bg-border/40 text-text/40',
}

interface Partner {
  id: string
  name: string
  type: string
  contact_name: string
  phone: string
  email: string
  address: string
  tva_number: string
  rib: string
}

function PartnerDetail({
  partner,
  onClose,
}: {
  partner: Partner
  onClose: () => void
}) {
  const currentMonth = new Date().toISOString().slice(0, 7)
  const [month, setMonth] = useState(currentMonth)
  const { data: sheet, isLoading: sheetLoading } = usePartnerMonthlySheet(partner.id, month)
  const updatePartner = useUpdatePartner()
  const form = useForm<Partner>({ defaultValues: partner })
  const [editMode, setEditMode] = useState(false)

  function handleUpdate(data: Partner) {
    updatePartner.mutate(
      { id: partner.id, ...(data as unknown as Record<string, unknown>) },
      { onSuccess: () => setEditMode(false) },
    )
  }

  async function handleGeneratePDF() {
    try {
      const res = await apiClient.get(`/pdf/partner-invoice/${partner.id}/${month}`, {
        responseType: 'blob',
      })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `facture-${partner.name}-${month}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Erreur lors de la génération du PDF.')
    }
  }

  const totalHT = sheet?.total_ht ?? 0
  const tva = totalHT * 0.19
  const timbre = (sheet?.rows?.length ?? 0) * 1
  const totalTTC = totalHT + tva + timbre

  return (
    <div className="space-y-6">
      {/* Info */}
      {editMode ? (
        <form onSubmit={form.handleSubmit(handleUpdate)} className="grid grid-cols-2 gap-3">
          <Input label="Nom" {...form.register('name')} />
          <Select label="Type" options={PARTNER_TYPES} {...form.register('type')} />
          <Input label="Contact" {...form.register('contact_name')} />
          <Input label="Téléphone" {...form.register('phone')} />
          <Input label="Email" type="email" {...form.register('email')} />
          <Input label="Adresse" {...form.register('address')} />
          <Input label="N° TVA" {...form.register('tva_number')} />
          <Input label="RIB" {...form.register('rib')} />
          <div className="col-span-2 flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="ghost" type="button" onClick={() => setEditMode(false)}>Annuler</Button>
            <Button type="submit" loading={updatePartner.isPending}>Enregistrer</Button>
          </div>
        </form>
      ) : (
        <div>
          <div className="flex justify-end mb-3">
            <Button size="sm" variant="ghost" onClick={() => setEditMode(true)}>Modifier</Button>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['Contact', partner.contact_name],
              ['Téléphone', partner.phone],
              ['Email', partner.email],
              ['Adresse', partner.address],
              ['N° TVA', partner.tva_number],
              ['RIB', partner.rib],
            ].map(([label, val]) => (
              <div key={label}>
                <div className="text-xs text-text/40 uppercase tracking-wide">{label}</div>
                <div className="text-text mt-0.5">{val || '—'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

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
              Générer facture PDF
            </Button>
          </div>
        </div>

        {sheetLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : sheet?.rows?.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-bg3 border-b border-border">
                  <tr className="text-text/40 text-xs uppercase tracking-wide">
                    <th className="text-left px-3 py-2 font-medium">Date</th>
                    <th className="text-left px-3 py-2 font-medium">Client</th>
                    <th className="text-left px-3 py-2 font-medium">Excursion</th>
                    <th className="text-right px-3 py-2 font-medium tabular-nums">Montant HT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {sheet.rows.map((row: Record<string, unknown>, i: number) => (
                    <tr key={i}>
                      <td className="px-3 py-2 text-text/60 tabular-nums">{row.date as string}</td>
                      <td className="px-3 py-2 text-text">{row.client_name as string}</td>
                      <td className="px-3 py-2 text-text/60">{row.excursion_name as string}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-accent">
                        {(row.amount_ht as number)?.toFixed(3)} TND
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 bg-bg3 rounded-lg p-4 text-sm space-y-1.5">
              <div className="flex justify-between">
                <span className="text-text/50">Total HT</span>
                <span className="tabular-nums">{totalHT.toFixed(3)} TND</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text/50">TVA 19%</span>
                <span className="tabular-nums">{tva.toFixed(3)} TND</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text/50">Timbre fiscal</span>
                <span className="tabular-nums">{timbre.toFixed(3)} TND</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-border font-semibold">
                <span className="text-text">Total TTC</span>
                <span className="tabular-nums text-accent">{totalTTC.toFixed(3)} TND</span>
              </div>
            </div>
          </>
        ) : (
          <p className="text-text/30 text-sm text-center py-6">
            Aucune donnée pour ce mois.
          </p>
        )}
      </div>
    </div>
  )
}

export default function PartnersPage() {
  const { data: partners = [], isLoading } = usePartners()
  const createPartner = useCreatePartner()
  const [selected, setSelected] = useState<Partner | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const createForm = useForm<Partner>()

  function handleCreate(data: Partner) {
    createPartner.mutate(data as unknown as Record<string, unknown>, {
      onSuccess: () => { setShowCreate(false); createForm.reset() },
    })
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text">Partenaires</h1>
          <p className="text-text/40 text-sm mt-0.5">Fournisseurs et prestataires</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          + Nouveau partenaire
        </Button>
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
                  <th className="text-left px-4 py-3 font-medium">Nom</th>
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-left px-4 py-3 font-medium">Contact</th>
                  <th className="text-left px-4 py-3 font-medium">Téléphone</th>
                  <th className="text-left px-4 py-3 font-medium">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {partners.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-text/30">
                      Aucun partenaire
                    </td>
                  </tr>
                ) : (
                  partners.map((p: Partner) => (
                    <tr
                      key={p.id}
                      onClick={() => setSelected(p)}
                      className="hover:bg-bg3/50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-text">{p.name}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                            TYPE_COLORS[p.type] ?? TYPE_COLORS['other']
                          }`}
                        >
                          {PARTNER_TYPES.find((t) => t.value === p.type)?.label ?? p.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text/60">{p.contact_name}</td>
                      <td className="px-4 py-3 text-text/60 tabular-nums">{p.phone}</td>
                      <td className="px-4 py-3 text-text/50">{p.email}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail modal */}
      <Modal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.name ?? ''}
        size="xl"
      >
        {selected && (
          <PartnerDetail partner={selected} onClose={() => setSelected(null)} />
        )}
      </Modal>

      {/* Create modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Nouveau partenaire"
        size="lg"
      >
        <form onSubmit={createForm.handleSubmit(handleCreate)} className="grid grid-cols-2 gap-4">
          <Input label="Nom" {...createForm.register('name', { required: true })} />
          <Select label="Type" options={PARTNER_TYPES} {...createForm.register('type')} />
          <Input label="Contact" {...createForm.register('contact_name')} />
          <Input label="Téléphone" {...createForm.register('phone')} />
          <Input label="Email" type="email" {...createForm.register('email')} />
          <Input label="Adresse" {...createForm.register('address')} />
          <Input label="N° TVA" {...createForm.register('tva_number')} />
          <Input label="RIB" {...createForm.register('rib')} />
          <div className="col-span-2 flex justify-end gap-2 pt-3 border-t border-border">
            <Button variant="ghost" type="button" onClick={() => setShowCreate(false)}>Annuler</Button>
            <Button type="submit" loading={createPartner.isPending}>Créer</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
