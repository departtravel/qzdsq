import { useCallback, useEffect, useState } from 'react'
import { supabase, makeSignupClient } from '../../lib/supabase'
import { useErpRole, ROLE_LABEL, type ErpRole } from '../../lib/roles'
import { confirmAdmin } from '../../lib/adminGuard'

// ============================================================
//  UTILISATEURS & RÔLES — réservé au SUPER ADMIN (Direction)
//  Permet de désigner / modifier le rôle ERP de chaque compte
//  et de promouvoir/révoquer le statut super administrateur.
// ============================================================

interface Profile {
  id: string
  email: string | null
  full_name: string | null
  role: string            // 'admin' (super admin) | 'viewer'
  erp_role: ErpRole
}

const ERP_ROLES: ErpRole[] = [
  'ADMIN', 'RESERVATION', 'CONFIRMATION', 'OPERATIONS', 'LOGISTIQUE', 'COMPTABLE', 'ANALYSE', 'LECTURE',
]

export function Utilisateurs() {
  const { role, ready } = useErpRole()
  const superAdmin = role === 'ADMIN'

  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)
  // Formulaire d'ajout d'utilisateur
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<ErpRole>('RESERVATION')
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, erp_role')
      .order('email')
    if (error) setError(error.message)
    setProfiles((data as Profile[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (superAdmin) load()
    else setLoading(false)
  }, [superAdmin, load])

  async function maj(p: Profile, patch: Partial<Profile>) {
    setError(null)
    const { error } = await supabase.from('profiles').update(patch).eq('id', p.id)
    if (error) {
      setError(error.message)
      return
    }
    setProfiles((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...patch } : x)))
    setSavedId(p.id)
    setTimeout(() => setSavedId((s) => (s === p.id ? null : s)), 1500)
  }

  async function ajouterUtilisateur() {
    setError(null)
    setMsg(null)
    if (!newEmail || !newPassword) {
      setError('Renseigne un email et un mot de passe.')
      return
    }
    if (newPassword.length < 6) {
      setError('Le mot de passe doit faire au moins 6 caractères.')
      return
    }
    setAdding(true)
    const signup = makeSignupClient()
    if (!signup) {
      setError('Configuration Supabase absente.')
      setAdding(false)
      return
    }
    // Crée le compte sans toucher à la session de l'admin (client isolé).
    const { data, error: e } = await signup.auth.signUp({
      email: newEmail.trim(),
      password: newPassword,
    })
    if (e) {
      setError(e.message)
      setAdding(false)
      return
    }
    const uid = data.user?.id
    if (uid) {
      // Crée/complète le profil avec le rôle choisi.
      await supabase.from('profiles').upsert(
        {
          id: uid,
          email: newEmail.trim(),
          full_name: newName.trim() || null,
          role: newRole === 'ADMIN' ? 'admin' : 'viewer',
          erp_role: newRole,
        },
        { onConflict: 'id' },
      )
    }
    setMsg(
      `Compte créé pour ${newEmail}. ` +
        `Si la confirmation par e-mail est activée dans Supabase, l'utilisateur doit confirmer avant de se connecter.`,
    )
    setNewName('')
    setNewEmail('')
    setNewPassword('')
    setNewRole('RESERVATION')
    setAdding(false)
    load()
  }

  async function retirerAcces(p: Profile) {
    if (!(await confirmAdmin(`le retrait de l'accès de ${p.email} (rôle ramené à Lecture seule)`))) return
    await maj(p, { role: 'viewer', erp_role: 'LECTURE' })
    setMsg(
      `Accès retiré pour ${p.email}. Pour supprimer définitivement le compte, va dans ` +
        `Supabase → Authentication → Users.`,
    )
  }

  if (!ready || loading) return <p className="text-slate-500">Chargement…</p>

  if (!superAdmin)
    return (
      <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        🔒 La gestion des rôles est réservée au <strong>super administrateur</strong> (Direction).
      </div>
    )

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold">Utilisateurs & rôles</h2>
      <p className="mb-4 text-sm text-slate-500">
        Désigne le rôle de chaque compte. Le rôle pilote ce que la personne peut faire
        (et est imposé par la base). Seul un super administrateur voit cet écran.
      </p>

      {error && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {msg && (
        <div className="mb-3 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {msg}
        </div>
      )}

      {/* Ajouter un utilisateur */}
      <div className="mb-4 rounded-lg bg-white p-4 shadow">
        <h3 className="mb-3 font-semibold">➕ Ajouter un utilisateur</h3>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-slate-500">Nom</span>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Prénom Nom"
              className="w-44 rounded border border-slate-300 px-2 py-1"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-500">Email</span>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="prenom@dts.com"
              className="w-56 rounded border border-slate-300 px-2 py-1"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-500">Mot de passe</span>
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="min. 6 caractères"
              className="w-44 rounded border border-slate-300 px-2 py-1"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-500">Rôle</span>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as ErpRole)}
              className="rounded border border-slate-300 px-2 py-1"
            >
              {ERP_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={adding}
            onClick={ajouterUtilisateur}
            className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {adding ? 'Création…' : 'Créer le compte'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-3 py-2">Nom</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Rôle ERP</th>
              <th className="px-3 py-2">Super admin</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="px-3 py-2">
                  <input
                    type="text"
                    defaultValue={p.full_name ?? ''}
                    onBlur={(e) => {
                      const v = e.target.value.trim()
                      if (v !== (p.full_name ?? '')) maj(p, { full_name: v || null })
                    }}
                    placeholder="Prénom Nom"
                    className="w-40 rounded border border-slate-300 px-2 py-1"
                  />
                </td>
                <td className="px-3 py-2">{p.email ?? <span className="text-slate-400">—</span>}</td>
                <td className="px-3 py-2">
                  <select
                    value={p.erp_role}
                    onChange={(e) => maj(p, { erp_role: e.target.value as ErpRole })}
                    className="rounded border border-slate-300 px-2 py-1"
                  >
                    {ERP_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={p.role === 'admin'}
                      onChange={(e) =>
                        maj(p, {
                          role: e.target.checked ? 'admin' : 'viewer',
                          // Un super admin est ADMIN en ERP ; sinon on repasse en LECTURE.
                          erp_role: e.target.checked ? 'ADMIN' : (p.erp_role === 'ADMIN' ? 'LECTURE' : p.erp_role),
                        })
                      }
                    />
                    <span className="text-xs text-slate-500">accès total</span>
                  </label>
                </td>
                <td className="px-3 py-2 text-right">
                  {savedId === p.id && <span className="mr-2 text-xs text-green-600">✓ enregistré</span>}
                  <button
                    onClick={() => retirerAcces(p)}
                    className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Retirer l'accès
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {profiles.length === 0 && (
        <p className="mt-4 text-sm text-slate-500">
          Aucun compte. Crée des utilisateurs dans Supabase → Authentication → Users.
        </p>
      )}

      <div className="mt-4 rounded border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        <p className="mb-1 font-medium">Rappel des rôles :</p>
        <ul className="list-disc space-y-0.5 pl-5">
          <li><strong>Réservation (Hiba)</strong> — crée la réservation, vérifie, contrôle.</li>
          <li><strong>Opérations (Khalil)</strong> — transport, guide, heure de prise en charge.</li>
          <li><strong>Confirmation (Farah)</strong> — informe le client (mail).</li>
          <li><strong>Logistique (Karima)</strong> — réservations partenaires, vérif comptabilité, référentiels.</li>
          <li><strong>Comptabilité</strong> — fournisseurs, factures, paiements.</li>
          <li><strong>Vérification budget (Mohamed)</strong> — bénéfice/déficit, clôture du départ.</li>
          <li><strong>Contrôle / Lecture (Amine, Aymen)</strong> — contrôle, analyse et rapports.</li>
          <li><strong>Administrateur</strong> — accès total (super admin).</li>
        </ul>
      </div>
    </div>
  )
}
