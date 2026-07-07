import { Request, Response, NextFunction } from 'express';
import { db } from '../db/database';
import { checkAlerts } from '../agents/erpAgent';

export function stats(_req: Request, res: Response, next: NextFunction): void {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);

    const totalRevenueTnd = (db.prepare(`
      SELECT COALESCE(SUM(
        CASE sale_currency
          WHEN 'TND' THEN net_price
          WHEN 'EUR' THEN net_price * (SELECT rate FROM exchange_rates WHERE from_currency='EUR' AND to_currency='TND' LIMIT 1)
          WHEN 'USD' THEN net_price * (SELECT rate FROM exchange_rates WHERE from_currency='USD' AND to_currency='TND' LIMIT 1)
          ELSE net_price
        END
      ), 0) AS total
      FROM reservations
      WHERE status != 'cancelled'
        AND strftime('%Y-%m', COALESCE(excursion_date, date_received)) = ?
    `).get(currentMonth) as { total: number }).total;

    const totalReservations = (db.prepare(`
      SELECT COUNT(*) as count FROM reservations
      WHERE strftime('%Y-%m', COALESCE(excursion_date, date_received)) = ?
        AND status != 'cancelled'
    `).get(currentMonth) as { count: number }).count;

    const pendingWorkflow = (db.prepare(`
      SELECT COUNT(*) as count FROM reservations
      WHERE workflow_step < 3 AND status != 'cancelled'
    `).get() as { count: number }).count;

    const activePartners = (db.prepare(`
      SELECT COUNT(*) as count FROM partners WHERE is_active = 1
    `).get() as { count: number }).count;

    const alerts = checkAlerts();

    res.json({
      success: true,
      data: {
        total_revenue_tnd: Math.round(totalRevenueTnd * 100) / 100,
        total_reservations: totalReservations,
        pending_workflow: pendingWorkflow,
        active_partners: activePartners,
        alerts_count: alerts.length,
        month: currentMonth,
      },
    });
  } catch (err) {
    next(err);
  }
}

export function monthlyRevenue(_req: Request, res: Response, next: NextFunction): void {
  try {
    const rows = db.prepare(`
      WITH RECURSIVE months(m) AS (
        SELECT strftime('%Y-%m', date('now', '-11 months'))
        UNION ALL
        SELECT strftime('%Y-%m', m || '-01', '+1 month')
        FROM months WHERE m < strftime('%Y-%m', date('now'))
      )
      SELECT
        months.m AS month,
        COALESCE(SUM(
          CASE r.sale_currency
            WHEN 'TND' THEN r.net_price
            WHEN 'EUR' THEN r.net_price * (SELECT rate FROM exchange_rates WHERE from_currency='EUR' AND to_currency='TND' LIMIT 1)
            WHEN 'USD' THEN r.net_price * (SELECT rate FROM exchange_rates WHERE from_currency='USD' AND to_currency='TND' LIMIT 1)
            ELSE r.net_price
          END
        ), 0) AS revenue_tnd,
        COUNT(r.id) AS reservations_count
      FROM months
      LEFT JOIN reservations r
        ON strftime('%Y-%m', COALESCE(r.excursion_date, r.date_received)) = months.m
        AND r.status != 'cancelled'
      GROUP BY months.m
      ORDER BY months.m ASC
    `).all();

    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

export function otaBreakdown(_req: Request, res: Response, next: NextFunction): void {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);

    const rows = db.prepare(`
      SELECT
        o.id, o.name,
        COUNT(r.id) AS count,
        COALESCE(SUM(r.sale_price), 0) AS gross_revenue,
        COALESCE(SUM(r.net_price), 0) AS net_revenue,
        r.sale_currency AS currency
      FROM otas o
      LEFT JOIN reservations r ON r.ota_id = o.id
        AND strftime('%Y-%m', COALESCE(r.excursion_date, r.date_received)) = ?
        AND r.status != 'cancelled'
      GROUP BY o.id, o.name, r.sale_currency
      ORDER BY net_revenue DESC
    `).all(currentMonth);

    res.json({ success: true, data: rows, meta: { month: currentMonth } });
  } catch (err) {
    next(err);
  }
}
