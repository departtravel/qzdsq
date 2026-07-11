// ============================================================
//  DTS OPERATION ERP — Rôles & permissions (côté interface)
//  Miroir de supabase/rbac.sql : l'UI masque/désactive les
//  actions non autorisées ; la base les REFUSE de toute façon.
// ============================================================
import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export type ErpRole =
  | 'ADMIN' | 'COMPTABLE' | 'RESERVATION' | 'CONFIRMATION'
  | 'OPERATIONS' | 'LOGISTIQUE' | 'LECTURE' | 'ANALYSE'

// Pipeline en 8 étapes (cf. supabase/workflow_9etapes.sql)
export type BookingStatut =
  | 'NOUVELLE'        // 1 Hiba   : créée + au planning
  | 'AFFECTEE'        // 2 Khalil : transport + guide + heure
  | 'CLIENT_INFORME'  // 3 Farah  : mail au client
  | 'PARTENAIRES_OK'  // 4 Karima : réservations partenaires
  | 'VERIFIEE'        // 5 Hiba   : vérifie que tout est bon
  | 'COMPTA_OK'       // 6 Karima : vérifie la comptabilité
  | 'CONTROLEE'       // 7 Hiba / Amine / Aymen : contrôle
  | 'CLOTUREE'        // 8 Mohamed : bénéfice/déficit (résumé)
  | 'ANNULEE'

export const ROLE_LABEL: Record<ErpRole, string> = {
  ADMIN: 'Administrateur (Direction)',
  RESERVATION: 'Réservation (Hiba)',
  CONFIRMATION: 'Confirmation (Farah)',
  OPERATIONS: 'Opérations (Khalil)',
  LOGISTIQUE: 'Logistique (Karima)',
  COMPTABLE: 'Comptabilité',
  ANALYSE: 'Vérification budget (Mohamed)',
  LECTURE: 'Contrôle / Lecture (Amine, Aymen)',
}

/** Rôle requis pour franchir une transition de statut de réservation. */
export function rolesPourTransition(from: BookingStatut, to: BookingStatut): ErpRole[] {
  if (from === 'NOUVELLE' && to === 'AFFECTEE') return ['ADMIN', 'OPERATIONS']
  if (from === 'AFFECTEE' && to === 'CLIENT_INFORME') return ['ADMIN', 'CONFIRMATION']
  if (from === 'CLIENT_INFORME' && to === 'PARTENAIRES_OK') return ['ADMIN', 'LOGISTIQUE']
  if (from === 'PARTENAIRES_OK' && to === 'VERIFIEE') return ['ADMIN', 'RESERVATION']
  if (from === 'VERIFIEE' && to === 'COMPTA_OK') return ['ADMIN', 'LOGISTIQUE']
  if (from === 'COMPTA_OK' && to === 'CONTROLEE') return ['ADMIN', 'LECTURE', 'RESERVATION']
  if (from === 'CONTROLEE' && to === 'CLOTUREE') return ['ADMIN', 'ANALYSE']
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
    case 'OPERATIONS': // Khalil
      return ['planning', 'ordremission', 'fichereservation', 'reservations']
    case 'LOGISTIQUE': // Karima
      return ['planning', 'fichereservation', 'referentiels', 'relevepartenaire', 'ordremission', 'flotte', 'comptabilite', 'reservations']
    case 'COMPTABLE':
      return ['comptabilite', 'relevepartenaire', 'chargesfixes', 'caisse', 'dashboard', 'reservations']
    case 'ANALYSE': // Mohamed — vérification budget / rentabilité
      return ['reservations', 'planning', 'dashboard', 'ia']
    case 'LECTURE': // Amine / Aymen
    default:
      return ['dashboard', 'ia', 'excursions', 'reservations']
  }
}

/**
 * Workflow en cascade : chaque rôle ne VOIT une réservation que lorsqu'elle
 * est arrivée à son étape. Tant que l'étape précédente n'a pas validé, la
 * personne suivante ne voit rien.
 *   NOUVELLE       -> créée par Hiba, à affecter par Khalil (transport/guide/heure)
 *   AFFECTEE       -> à informer le client par Farah
 *   CLIENT_INFORME -> réservations partenaires par Karima
 *   PARTENAIRES_OK -> vérification par Hiba
 *   VERIFIEE       -> vérification comptabilité par Karima
 *   COMPTA_OK      -> contrôle par Hiba / Amine / Aymen
 *   CONTROLEE      -> clôture bénéfice/déficit par Mohamed
 * 'ALL' = voit tout (ADMIN, LECTURE).
 */
export function statutsVisibles(role: ErpRole): 'ALL' | BookingStatut[] {
  switch (role) {
    case 'ADMIN':
      return 'ALL'
    case 'RESERVATION': // Hiba : crée (NOUVELLE), vérifie (PARTENAIRES_OK), contrôle (COMPTA_OK)
      return ['NOUVELLE', 'PARTENAIRES_OK', 'COMPTA_OK']
    case 'OPERATIONS': // Khalil : affecte transport/guide/heure
      return ['NOUVELLE']
    case 'CONFIRMATION': // Farah : informe le client
      return ['AFFECTEE']
    case 'LOGISTIQUE': // Karima : réservations partenaires puis vérif compta
      return ['CLIENT_INFORME', 'VERIFIEE']
    case 'COMPTABLE': // Comptabilité : suit les sorties à facturer
      return ['COMPTA_OK', 'CONTROLEE', 'CLOTUREE']
    case 'ANALYSE': // Mohamed : contrôle terminé -> clôture (bénéfice/déficit)
      return ['CONTROLEE', 'CLOTUREE']
    case 'LECTURE': // Amine / Aymen : contrôlent
      return ['COMPTA_OK']
    default:
      return 'ALL'
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
