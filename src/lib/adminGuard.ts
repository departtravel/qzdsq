import { supabase } from './supabase'

// Mot de passe maître des actions sensibles (stocké dans admin_secrets,
// visible uniquement par les super admins). Demandé avant toute action
// sensible du super admin (suppression, annulation, remise à zéro…).

export async function getAdminPassword(): Promise<string | null> {
  const { data, error } = await supabase
    .from('admin_secrets')
    .select('value')
    .eq('key', 'admin_password')
    .maybeSingle()
  if (error) return null
  return (data as { value: string | null } | null)?.value ?? ''
}

export async function setAdminPassword(value: string): Promise<string | null> {
  const { error } = await supabase
    .from('admin_secrets')
    .upsert({ key: 'admin_password', value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  return error ? error.message : null
}

/**
 * Demande le mot de passe admin et le vérifie. Retourne true si OK.
 * Si aucun mot de passe n'est configuré, on demande simplement de confirmer.
 */
export async function confirmAdmin(action = 'cette action'): Promise<boolean> {
  const stored = await getAdminPassword()
  if (!stored) {
    // Pas de mot de passe maître défini : simple confirmation.
    return confirm(`Confirmer ${action} ? (aucun mot de passe admin n'est défini — configure-le dans Paramètres)`)
  }
  const saisi = prompt(`Mot de passe administrateur requis pour ${action} :`)
  if (saisi === null) return false
  if (saisi !== stored) {
    alert('Mot de passe incorrect.')
    return false
  }
  return true
}
