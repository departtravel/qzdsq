import { Request, Response, NextFunction } from 'express';
import { db } from '../db/database';
import { Reservation } from '../types';
import { createError } from '../middleware/errorHandler';

export function board(_req: Request, res: Response, next: NextFunction): void {
  try {
    const steps = [0, 1, 2, 3];
    const result: Record<number, unknown[]> = {};

    for (const step of steps) {
      const rows = db.prepare(`
        SELECT r.*,
          e.name AS excursion_name, e.code AS excursion_code,
          o.name AS ota_name,
          d.name AS driver_name,
          g.name AS guide_name,
          (SELECT COUNT(*) FROM tasks t WHERE t.reservation_id = r.id AND t.status != 'done') AS pending_tasks
        FROM reservations r
        LEFT JOIN excursions e ON e.id = r.excursion_id
        LEFT JOIN otas o ON o.id = r.ota_id
        LEFT JOIN drivers d ON d.id = r.driver_id
        LEFT JOIN guides g ON g.id = r.guide_id
        WHERE r.workflow_step = ? AND r.status != 'cancelled'
        ORDER BY r.excursion_date ASC, r.id ASC
      `).all(step);
      result[step] = rows;
    }

    res.json({
      success: true,
      data: {
        step_0: result[0],
        step_1: result[1],
        step_2: result[2],
        step_3: result[3],
        labels: {
          0: 'Nouvelle réservation',
          1: 'Assignation ressources',
          2: 'Réservations fournisseurs',
          3: 'Terminé',
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

export function assign(req: Request, res: Response, next: NextFunction): void {
  try {
    const reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id) as Reservation | undefined;
    if (!reservation) { next(createError('Reservation not found', 404)); return; }

    const { driver_id, guide_id, transporter_id } = req.body;

    db.prepare(`
      UPDATE reservations
      SET driver_id = ?, guide_id = ?, transporter_id = ?,
          workflow_step = CASE WHEN workflow_step < 1 THEN 1 ELSE workflow_step END,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      driver_id ?? reservation.driver_id,
      guide_id ?? reservation.guide_id,
      transporter_id ?? reservation.transporter_id,
      req.params.id
    );

    res.json({ success: true, data: db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id) });
  } catch (err) {
    next(err);
  }
}

export function book(req: Request, res: Response, next: NextFunction): void {
  try {
    const reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id) as Reservation | undefined;
    if (!reservation) { next(createError('Reservation not found', 404)); return; }
    if (reservation.workflow_step < 1) {
      next(createError('Must assign resources (step 1) before booking suppliers', 400)); return;
    }

    const { supplier_bookings } = req.body;

    const insertBooking = db.prepare(`
      INSERT INTO supplier_bookings (reservation_id, partner_id, service_type, date, amount, currency, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    if (Array.isArray(supplier_bookings)) {
      const insertAll = db.transaction(() => {
        for (const sb of supplier_bookings) {
          insertBooking.run(
            reservation.id,
            sb.partner_id || null,
            sb.service_type,
            sb.date || reservation.excursion_date,
            sb.amount ?? 0,
            sb.currency || 'TND',
            'confirmed',
            sb.notes || null
          );
        }
      });
      insertAll();
    }

    db.prepare(`
      UPDATE reservations
      SET workflow_step = CASE WHEN workflow_step < 2 THEN 2 ELSE workflow_step END,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(req.params.id);

    res.json({ success: true, data: db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id) });
  } catch (err) {
    next(err);
  }
}

export function complete(req: Request, res: Response, next: NextFunction): void {
  try {
    const reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id) as Reservation | undefined;
    if (!reservation) { next(createError('Reservation not found', 404)); return; }
    if (reservation.workflow_step < 2) {
      next(createError('Must confirm supplier bookings (step 2) before completing', 400)); return;
    }

    // Create or update mission order record
    const existingMo = db.prepare('SELECT id FROM mission_orders WHERE reservation_id = ?').get(req.params.id);
    if (!existingMo) {
      db.prepare(`INSERT INTO mission_orders (reservation_id) VALUES (?)`).run(req.params.id);
    }

    db.prepare(`
      UPDATE reservations
      SET workflow_step = 3, status = 'confirmed', updated_at = datetime('now')
      WHERE id = ?
    `).run(req.params.id);

    // Mark tasks as done
    db.prepare(`UPDATE tasks SET status = 'done', updated_at = datetime('now') WHERE reservation_id = ? AND type = 'reservation'`)
      .run(req.params.id);

    res.json({ success: true, data: db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id) });
  } catch (err) {
    next(err);
  }
}
