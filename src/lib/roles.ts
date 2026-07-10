// ============================================================
//  DTS OPERATION ERP — Rôles & permissions (côté interface)
//  Miroir de supabase/rbac.sql : l'UI masque/désactive les
//  actions non autorisées ; la base les REFUSE de toute façon.
// ============================================================
import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export type ErpRole =
  | 'ADMIN' | 'COMPTABLE' | 'RESERVATION' | 'CONFIRMATION'
  | 'OPERATIONS' | 'LOGISTIQUE' | 'LECTURE'

export type BookingStatut =
  | 'NOUVELLE' | 'CONFIRMEE' | 'EN_OPERATION' | 'TERMINEE' | 'ANNULEE'

export const ROLE_LABEL: Record<ErpRole, string> = {
  ADMIN: 'Administrateur (Direction)',
  RESERVATION: 'Réservation (Hiba)',
  CONFIRMATION: 'Confirmation (Farah)',
  OPERATIONS: 'Opérations (Hersi)',
  LOGISTIQUE: 'Logistique (Karima)',
  COMPTABLE: 'Comptabilité',
  LECTURE: 'Contrôle / Lecture (Amine, Aymen)',
}

/** Rôle requis pour franchir une transition de statut de réservation. */
export function rolesPourTransition(from: BookingStatut, to: BookingStatut): ErpRole[] {
  if (from === 'NOUVELLE' && to === 'CONFIRMEE') return ['ADMIN', 'CONFIRMATION']
  if (from === 'CONFIRMEE' && to === 'EN_OPERATION') return ['ADMIN', 'OPERATIONS']
  if (from === 'EN_OPERATION' && to === 'TERMINEE') return ['ADMIN', 'OPERATIONS', 'LOGISTIQUE']
  if (to === 'ANNULEE') return ['ADMIN', 'RESERVATION', 'CONFIRMATION']
  return ['ADMIN']
}

export const peutTransition = (role: ErpRole, from: BookingStatut, to: BookingStatut) =>
  rolesPourTransition(from, to).includes(role)

export const peutCreerReservation = (role: ErpRole) =>
  role === 'ADMIN' || role === 'RESERVATION'

export const peutAffecter = (role: ErpRole) =>
  role === 'ADMIN' || role === 'OPERATIONS'

/** Rôles autorisés à écrire dans chaque grande zone de l'ERP. */
export const peutEcrire = {
  reservations: (r: ErpRole) => r === 'ADMIN' || r === 'RESERVATION',
  planning: (r: ErpRole) => r === 'ADMIN' || r === 'OPERATIONS' || r === 'LOGISTIQUE',
  comptabilite: (r: ErpRole) => r === 'ADMIN' || r === 'COMPTABLE',
  referentiels: (r: ErpRole) => r === 'ADMIN' || r === 'LOGISTIQUE',
  catalogue: (r: ErpRole) => r === 'ADMIN',
}

/**
 * Onglets visibles selon le rôle (pour simplifier l'interface : chaque
 * collègue ne voit que ce qui le concerne). 'ALL' = tous les onglets.
 */
export function onglestsVisibles(role: ErpRole): 'ALL' | string[] {
  switch (role) {
    case 'ADMIN':
      return 'ALL'
    case 'RESERVATION': // Hiba
      return ['reservations', 'importota', 'planning']
    case 'CONFIRMATION': // Farah
      return ['reservations', 'planning']
    case 'OPERATIONS': // Hersi
      return ['planning', 'ordremission', 'fichereservation', 'reservations']
    case 'LOGISTIQUE': // Karima
      return ['planning', 'fichereservation', 'referentiels', 'relevepartenaire', 'ordremission', 'flotte']
    case 'COMPTABLE':
      return ['comptabilite', 'relevepartenaire', 'chargesfixes', 'caisse', 'dashboard']
    case 'LECTURE': // Amine / Aymen
    default:
      return ['dashboard', 'ia', 'excursions']
  }
}

/** Charge le rôle ERP de l'utilisateur connecté. Défaut : LECTURE. */
export function useErpRole(): { role: ErpRole; ready: boolean } {
  const [role, setRole] = useState<ErpRole>('LECTURE')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let annule = false
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id
      if (!uid) {
        if (!annule) setReady(true)
        return
      }
      supabase
        .from('profiles')
        .select('role, erp_role')
        .eq('id', uid)
        .single()
        .then(({ data }) => {
          if (annule) return
          const r = (data as { role?: string; erp_role?: ErpRole } | null)
          setRole(r?.role === 'admin' ? 'ADMIN' : (r?.erp_role ?? 'LECTURE'))
          setReady(true)
        })
    })
    return () => {
      annule = true
    }
  }, [])

  return { role, ready }
}
