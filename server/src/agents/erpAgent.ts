import { db } from '../db/database';
import { Reservation } from '../types';

export interface Alert {
  type: 'missing_driver' | 'missing_guide' | 'ota_payment_overdue' | 'task_overdue';
  message: string;
  severity: 'warning' | 'critical';
  reference_id?: number;
  reference_type?: string;
}

export function checkAlerts(): Alert[] {
  const alerts: Alert[] = [];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  // Reservations tomorrow without driver
  const noDriver = db.prepare(`
    SELECT id, client_name, excursion_date FROM reservations
    WHERE excursion_date = ?
      AND status IN ('confirmed', 'pending')
      AND driver_id IS NULL
      AND workflow_step < 3
  `).all(tomorrowStr) as { id: number; client_name: string; excursion_date: string }[];

  for (const r of noDriver) {
    alerts.push({
      type: 'missing_driver',
      message: `Réservation #${r.id} (${r.client_name || 'Inconnu'}) le ${r.excursion_date} sans chauffeur assigné`,
      severity: 'critical',
      reference_id: r.id,
      reference_type: 'reservation',
    });
  }

  // Reservations tomorrow without guide
  const noGuide = db.prepare(`
    SELECT id, client_name, excursion_date FROM reservations
    WHERE excursion_date = ?
      AND status IN ('confirmed', 'pending')
      AND guide_id IS NULL
      AND workflow_step < 3
  `).all(tomorrowStr) as { id: number; client_name: string; excursion_date: string }[];

  for (const r of noGuide) {
    alerts.push({
      type: 'missing_guide',
      message: `Réservation #${r.id} (${r.client_name || 'Inconnu'}) le ${r.excursion_date} sans guide assigné`,
      severity: 'warning',
      reference_id: r.id,
      reference_type: 'reservation',
    });
  }

  // OTA monthly sheets older than 30 days still pending
  const overdueOta = db.prepare(`
    SELECT oms.id, o.name, oms.month, oms.net_revenue, oms.currency
    FROM ota_monthly_sheets oms
    JOIN otas o ON o.id = oms.ota_id
    WHERE oms.payment_status = 'pending'
      AND oms.month < date('now', '-30 days', 'start of month')
  `).all() as { id: number; name: string; month: string; net_revenue: number; currency: string }[];

  for (const o of overdueOta) {
    alerts.push({
      type: 'ota_payment_overdue',
      message: `Paiement OTA ${o.name} pour ${o.month} en attente: ${o.net_revenue.toFixed(2)} ${o.currency}`,
      severity: 'warning',
      reference_id: o.id,
      reference_type: 'ota_monthly_sheet',
    });
  }

  // Overdue tasks
  const overdueTasks = db.prepare(`
    SELECT id, title, due_date, assigned_to FROM tasks
    WHERE status != 'done'
      AND due_date IS NOT NULL
      AND due_date < date('now')
  `).all() as { id: number; title: string; due_date: string; assigned_to: number | null }[];

  for (const t of overdueTasks) {
    alerts.push({
      type: 'task_overdue',
      message: `Tâche "${t.title}" en retard depuis le ${t.due_date}`,
      severity: 'warning',
      reference_id: t.id,
      reference_type: 'task',
    });
  }

  return alerts;
}

export interface AccountingEntry {
  date: string;
  journal: string;
  compte_debit: string;
  libelle_debit: string;
  compte_credit: string;
  libelle_credit: string;
  montant: number;
  currency: string;
  reference: string;
}

export function generateAccountingEntry(reservation: Reservation): AccountingEntry[] {
  const entries: AccountingEntry[] = [];
  const date = reservation.excursion_date || reservation.date_received;
  const ref = `RES-${reservation.id}`;
  const netPrice = reservation.sale_price * (1 - reservation.commission_pct / 100);
  const currency = reservation.sale_currency;
  const clientLabel = reservation.client_name || `Client #${reservation.id}`;

  // 1. Revenue entry: Client -> Chiffre d'affaires voyages
  entries.push({
    date,
    journal: 'VT',
    compte_debit: '411000',
    libelle_debit: `Client ${clientLabel}`,
    compte_credit: '706200',
    libelle_credit: `Ventes prestations voyages - ${ref}`,
    montant: netPrice,
    currency,
    reference: ref,
  });

  // 2. TVA collectée 19% (if TND)
  if (currency === 'TND') {
    const tvaAmount = netPrice * 0.19;
    entries.push({
      date,
      journal: 'VT',
      compte_debit: '411000',
      libelle_debit: `TVA Client ${clientLabel}`,
      compte_credit: '445500',
      libelle_credit: `TVA collectée 19% - ${ref}`,
      montant: tvaAmount,
      currency,
      reference: ref,
    });
  }

  // 3. Commission OTA (if applicable)
  if (reservation.commission_pct > 0) {
    const commissionAmount = reservation.sale_price * (reservation.commission_pct / 100);
    entries.push({
      date,
      journal: 'VT',
      compte_debit: '627100',
      libelle_debit: `Commission OTA - ${ref}`,
      compte_credit: '401000',
      libelle_credit: `OTA fournisseur - ${ref}`,
      montant: commissionAmount,
      currency,
      reference: ref,
    });
  }

  // 4. Acompte reçu (if any)
  if (reservation.acompte_amount > 0) {
    entries.push({
      date,
      journal: 'BQ',
      compte_debit: '512000',
      libelle_debit: `Banque - Acompte ${ref}`,
      compte_credit: '411000',
      libelle_credit: `Client ${clientLabel} - acompte`,
      montant: reservation.acompte_amount,
      currency,
      reference: ref,
    });
  }

  return entries;
}
