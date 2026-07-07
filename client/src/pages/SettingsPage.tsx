import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useSettings, useUpdateSettings, useExchangeRates } from '../api/hooks'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Spinner from '../components/ui/Spinner'
import apiClient from '../api/client'

const TABS = ['Agence', 'Taux de change', 'Utilisateurs', 'Général'] as const
type Tab = (typeof TABS)[number]

function AgenceTab() {
  const { data: settings, isLoading } = useSettings()
  const updateSettings = useUpdateSettings()
  const form = useForm({ defaultValues: settings ?? {} })

  if (isLoading) return <div className="flex justify-center py-8"><Spinner /></div>

  return (
    <form
      onSubmit={form.handleSubmit((data) => updateSettings.mutate(data))}
      className="space-y-4 max-w-xl"
    >
      <Input
        label="Nom de l'agence"
        defaultValue={settings?.agency_name}
        {...form.register('agency_name')}
      />
      <Input
        label="Adresse"
        defaultValue={settings?.address}
        {...form.register('address')}
      />
      <Input
        label="Numéro TVA"
        defaultValue={settings?.tva_number}
        {...form.register('tva_number')}
      />
      <Input
        label="RIB bancaire"
        defaultValue={settings?.rib}
        {...form.register('rib')}
      />
      <div>
        <label className="text-xs font-medium text-text/60 uppercase tracking-wide block mb-1">
          Logo
        </label>
        <input
          type="file"
          accept="image/*"
          className="text-sm text-text/50 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:bg-accent file:text-bg file:cursor-pointer hover:file:bg-accent/90"
        />
      </div>
      <div className="pt-2">
        <Button type="submit" loading={updateSettings.isPending}>
          Enregistrer
        </Button>
      </div>
    </form>
  )
}

function ExchangeRatesTab() {
  const { data: rates, isLoading } = useExchangeRates()
  const updateSettings = useUpdateSettings()
  const form = useForm({ defaultValues: rates ?? {} })

  if (isLoading) return <div className="flex justify-center py-8"><Spinner /></div>

  return (
    <form
      onSubmit={form.handleSubmit((data) => updateSettings.mutate({ exchange_rates: data }))}
      className="space-y-4 max-w-sm"
    >
      <div className="bg-bg3 border border-border rounded-lg p-4">
        <h3 className="text-sm font-semibold text-text/60 uppercase tracking-wide mb-4">
          Taux de change vers TND
        </h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="w-20 text-sm text-text/60">EUR → TND</span>
            <Input
              type="number"
              step="0.0001"
              defaultValue={rates?.eur_tnd}
              {...form.register('eur_tnd')}
              className="flex-1"
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="w-20 text-sm text-text/60">USD → TND</span>
            <Input
              type="number"
              step="0.0001"
              defaultValue={rates?.usd_tnd}
              {...form.register('usd_tnd')}
              className="flex-1"
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="w-20 text-sm text-text/60">GBP → TND</span>
            <Input
              type="number"
              step="0.0001"
              defaultValue={rates?.gbp_tnd}
              {...form.register('gbp_tnd')}
              className="flex-1"
            />
          </div>
        </div>
      </div>
      <Button type="submit" loading={updateSettings.isPending}>
        Mettre à jour les taux
      </Button>
    </form>
  )
}

interface User {
  id: string
  name: string
  email: string
  role: string
}

function UsersTab() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const form = useForm<User>()

  useState(() => {
    setLoading(true)
    apiClient.get('/users')
      .then((r) => setUsers(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  })

  if (loading) return <div className="flex justify-center py-8"><Spinner /></div>

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
          + Ajouter utilisateur
        </Button>
      </div>

      {showAdd && (
        <form
          onSubmit={form.handleSubmit(async (data) => {
            await apiClient.post('/users', data)
            setShowAdd(false)
            form.reset()
          })}
          className="bg-bg3 border border-border rounded-lg p-4 grid grid-cols-2 gap-3"
        >
          <Input label="Nom" {...form.register('name', { required: true })} />
          <Input label="Email" type="email" {...form.register('email', { required: true })} />
          <Input label="Mot de passe" type="password" {...form.register('password' as keyof User)} />
          <Select
            label="Rôle"
            options={[
              { value: 'admin', label: 'Administrateur' },
              { value: 'agent', label: 'Agent' },
              { value: 'comptable', label: 'Comptable' },
            ]}
            {...form.register('role')}
          />
          <div className="col-span-2 flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setShowAdd(false)}>Annuler</Button>
            <Button type="submit">Créer</Button>
          </div>
        </form>
      )}

      <div className="bg-bg2 border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg3 border-b border-border">
            <tr className="text-text/40 text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3 font-medium">Nom</th>
              <th className="text-left px-4 py-3 font-medium">Email</th>
              <th className="text-left px-4 py-3 font-medium">Rôle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {users.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center py-8 text-text/30">
                  Aucun utilisateur
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 font-medium text-text">{u.name}</td>
                  <td className="px-4 py-3 text-text/60">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-xs bg-accent/15 text-accent">
                      {u.role}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function GeneralTab() {
  const { data: settings, isLoading } = useSettings()
  const updateSettings = useUpdateSettings()
  const form = useForm({ defaultValues: settings ?? {} })

  if (isLoading) return <div className="flex justify-center py-8"><Spinner /></div>

  return (
    <form
      onSubmit={form.handleSubmit((data) => updateSettings.mutate(data))}
      className="space-y-4 max-w-sm"
    >
      <Select
        label="Fuseau horaire"
        defaultValue={settings?.timezone ?? 'Africa/Tunis'}
        options={[
          { value: 'Africa/Tunis', label: 'Africa/Tunis (UTC+1)' },
          { value: 'Europe/Paris', label: 'Europe/Paris (UTC+1/+2)' },
          { value: 'UTC', label: 'UTC' },
        ]}
        {...form.register('timezone')}
      />
      <Select
        label="Format de date"
        defaultValue={settings?.date_format ?? 'DD/MM/YYYY'}
        options={[
          { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
          { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
          { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
        ]}
        {...form.register('date_format')}
      />
      <div className="pt-2">
        <Button type="submit" loading={updateSettings.isPending}>
          Enregistrer
        </Button>
      </div>
    </form>
  )
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Agence')

  const tabContent: Record<Tab, React.ReactNode> = {
    'Agence': <AgenceTab />,
    'Taux de change': <ExchangeRatesTab />,
    'Utilisateurs': <UsersTab />,
    'Général': <GeneralTab />,
  }

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-text">Paramètres</h1>
        <p className="text-text/40 text-sm mt-0.5">Configuration de l'ERP</p>
      </div>

      <div className="flex gap-1 bg-bg2 border border-border rounded-lg p-1 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-accent text-bg'
                : 'text-text/50 hover:text-text hover:bg-bg3'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="bg-bg2 border border-border rounded-xl p-6">
        {tabContent[activeTab]}
      </div>
    </div>
  )
}
