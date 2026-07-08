import { useEffect, useState } from 'react'
import { useErpRole } from '../../lib/roles'
import { loadSettings, saveSetting, type AppSettings } from '../../lib/settings'

// ============================================================
//  PARAMÈTRES — logo & coordonnées de l'agence (super admin)
//  Le logo est enregistré en base et apparaît sur les documents
//  imprimés (ordre de mission, fiche de réservation).
// ============================================================
export function Parametres() {
  const { role, ready } = useErpRole()
  const superAdmin = role === 'ADMIN'

  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (superAdmin) loadSettings().then(setSettings)
  }, [superAdmin])

  async function onLogoFile(file: File) {
    setError(null)
    if (file.size > 500 * 1024) {
      setError('Logo trop lourd (max 500 Ko). Réduis l’image.')
      return
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
    await save('logo', dataUrl)
  }

  async function save(key: keyof AppSettings, value: string) {
    const { error } = await saveSetting(key, value)
    if (error) setError(error.message)
    else {
      setSettings((s) => (s ? { ...s, [key]: value } : s))
      setMsg('Enregistré.')
      setTimeout(() => setMsg(null), 1500)
    }
  }

  if (!ready) return <p className="text-slate-500">Chargement…</p>
  if (!superAdmin)
    return (
      <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        🔒 Les paramètres sont réservés au <strong>super administrateur</strong>.
      </div>
    )
  if (!settings) return <p className="text-slate-500">Chargement…</p>

  return (
    <div className="max-w-2xl">
      <h2 className="mb-4 text-lg font-semibold">Paramètres de l'agence</h2>

      {msg && <div className="mb-3 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{msg}</div>}
      {error && <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="space-y-4 rounded-lg bg-white p-5 shadow">
        <div>
          <span className="mb-1 block text-sm text-slate-500">Logo (affiché sur les documents imprimés)</span>
          <div className="flex items-center gap-4">
            <div className="flex h-24 w-40 items-center justify-center rounded border bg-slate-50">
              {settings.logo
                ? <img src={settings.logo} alt="logo" className="max-h-full max-w-full" />
                : <span className="text-xs text-slate-300">Aucun logo</span>}
            </div>
            <div className="space-y-2">
              <input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                onChange={(e) => e.target.files?.[0] && onLogoFile(e.target.files[0])}
                className="text-sm"
              />
              {settings.logo && (
                <button onClick={() => save('logo', '')} className="block text-xs text-red-600 hover:underline">
                  Retirer le logo
                </button>
              )}
              <p className="text-xs text-slate-400">PNG, JPG ou SVG · max 500 Ko.</p>
            </div>
          </div>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block text-slate-500">Nom de l'agence</span>
          <input
            type="text"
            defaultValue={settings.company_name}
            onBlur={(e) => save('company_name', e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-slate-500">Coordonnées (adresse, téléphone, e-mail — sur les documents)</span>
          <textarea
            defaultValue={settings.company_info}
            onBlur={(e) => save('company_info', e.target.value)}
            rows={3}
            className="w-full rounded border border-slate-300 px-2 py-1"
          />
        </label>

        <p className="text-xs text-slate-400">Les changements sont enregistrés automatiquement.</p>
      </div>
    </div>
  )
}
