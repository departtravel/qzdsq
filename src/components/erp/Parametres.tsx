import { useEffect, useState } from 'react'
import { useErpRole } from '../../lib/roles'
import { supabase } from '../../lib/supabase'
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
  // Remise à zéro (« vider le cash »)
  const [resetPwd, setResetPwd] = useState('')
  const [resetting, setResetting] = useState(false)

  async function viderLeCash() {
    setError(null); setMsg(null)
    if (!resetPwd) { setError('Entre ton mot de passe pour confirmer.'); return }
    if (!confirm('⚠️ Cette action efface TOUTES les réservations, sorties, factures et la compta (le catalogue et les charges fixes sont conservés). Continuer ?')) return
    setResetting(true)
    // Vérifie le mot de passe en ré-authentifiant l'utilisateur courant.
    const { data: u } = await supabase.auth.getUser()
    const email = u.user?.email
    if (!email) { setError('Session introuvable.'); setResetting(false); return }
    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password: resetPwd })
    if (authErr) { setError('Mot de passe incorrect.'); setResetting(false); return }
    const { error: rpcErr } = await supabase.rpc('reset_cash')
    if (rpcErr) setError(rpcErr.message)
    else setMsg('Cash remis à zéro : réservations, sorties, factures et compta effacées.')
    setResetPwd('')
    setResetting(false)
  }

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

        <label className="block text-sm">
          <span className="mb-1 block text-slate-500">Taux de TVA (%) — les tarifs sont saisis TTC</span>
          <input
            type="number"
            min={0}
            step="0.5"
            defaultValue={settings.tva_taux}
            onBlur={(e) => save('tva_taux', e.target.value)}
            className="w-32 rounded border border-slate-300 px-2 py-1"
          />
        </label>

        <p className="text-xs text-slate-400">Les changements sont enregistrés automatiquement.</p>
      </div>

      {/* Zone dangereuse : vider le cash */}
      <div className="mt-6 rounded-lg border-2 border-red-200 bg-red-50 p-5">
        <h3 className="mb-1 font-semibold text-red-800">🧹 Vider le cash (remise à zéro)</h3>
        <p className="mb-3 text-sm text-red-700">
          Efface <strong>toutes les réservations, sorties, factures et la comptabilité</strong> pour
          repartir de zéro. Le catalogue, les référentiels et les charges fixes sont <strong>conservés</strong>.
          Action irréversible — confirme avec ton mot de passe.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Mot de passe</span>
            <input
              type="password"
              value={resetPwd}
              onChange={(e) => setResetPwd(e.target.value)}
              className="w-56 rounded border border-red-300 px-2 py-1"
            />
          </label>
          <button
            disabled={resetting}
            onClick={viderLeCash}
            className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {resetting ? 'Suppression…' : 'Vider le cash'}
          </button>
        </div>
      </div>
    </div>
  )
}
