import { Request, Response, NextFunction } from 'express';
import { db } from '../db/database';
import { Reservation, OTA } from '../types';
import { createError } from '../middleware/errorHandler';

export function list(req: Request, res: Response, next: NextFunction): void {
  try {
    const { date_from, date_to, status, ota_id, workflow_step, limit = '50', offset = '0' } = req.query;

    let query = `
      SELECT r.*,
        e.name AS excursion_name, e.code AS excursion_code,
        o.name AS ota_name,
        d.name AS driver_name,
        g.name AS guide_name,
        p.name AS transporter_name
      FROM reservations r
      LEFT JOIN excursions e ON e.id = r.excursion_id
      LEFT JOIN otas o ON o.id = r.ota_id
      LEFT JOIN drivers d ON d.id = r.driver_id
      LEFT JOIN guides g ON g.id = r.guide_id
      LEFT JOIN partners p ON p.id = r.transporter_id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (date_from) { query += ' AND r.excursion_date >= ?'; params.push(String(date_from)); }
    if (date_to) { query += ' AND r.excursion_date <= ?'; params.push(String(date_to)); }
    if (status) { query += ' AND r.status = ?'; params.push(String(status)); }
    if (ota_id) { query += ' AND r.ota_id = ?'; params.push(Number(ota_id)); }
    if (workflow_step !== undefined) { query += ' AND r.workflow_step = ?'; params.push(Number(workflow_step)); }

    query += ' ORDER BY r.excursion_date DESC, r.id DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const rows = db.prepare(query).all(...params);
    const total = (db.prepare(`SELECT COUNT(*) as count FROM reservations WHERE 1=1`).get() as { count: number }).count;

    res.json({ success: true, data: rows, meta: { total } });
  } catch (err) {
    next(err);
  }
}

export function getOne(req: Request, res: Response, next: NextFunction): void {
  try {
    const row = db.prepare(`
      SELECT r.*,
        e.name AS excursion_name, e.code AS excursion_code, e.duration_days,
        o.name AS ota_name, o.commission_pct AS ota_commission_pct,
        d.name AS driver_name, d.phone AS driver_phone,
        g.name AS guide_name, g.phone AS guide_phone,
        p.name AS transporter_name
      FROM reservations r
      LEFT JOIN excursions e ON e.id = r.excursion_id
      LEFT JOIN otas o ON o.id = r.ota_id
      LEFT JOIN drivers d ON d.id = r.driver_id
      LEFT JOIN guides g ON g.id = r.guide_id
      LEFT JOIN partners p ON p.id = r.transporter_id
      WHERE r.id = ?
    `).get(req.params.id);

    if (!row) { next(createError('Reservation not found', 404)); return; }
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
}

export function create(req: Request, res: Response, next: NextFunction): void {
  try {
    const body = req.body;

    // Auto-fill commission from OTA
    let commission_pct = body.commission_pct ?? 0;
    if (body.ota_id && !body.commission_pct) {
      const ota = db.prepare('SELECT commission_pct FROM otas WHERE id = ?').get(body.ota_id) as OTA | undefined;
      if (ota) commission_pct = ota.commission_pct;
    }

    const result = db.prepare(`
      INSERT INTO reservations
        (date_received, excursion_id, ota_id, ota_ref, status, excursion_date,
         pax_adults, pax_children, sale_price, sale_currency, commission_pct,
         client_hotel, client_name, pickup_time, phone, remarks,
         driver_id, guide_id, transporter_id, workflow_step,
         acompte_amount, payment_status, voucher_sent, raw_email)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      body.date_received || new Date().toISOString().split('T')[0],
      body.excursion_id || null,
      body.ota_id || null,
      body.ota_ref || null,
      body.status || 'pending',
      body.excursion_date || null,
      body.pax_adults ?? 1,
      body.pax_children ?? 0,
      body.sale_price ?? 0,
      body.sale_currency || 'EUR',
      commission_pct,
      body.client_hotel || null,
      body.client_name || null,
      body.pickup_time || null,
      body.phone || null,
      body.remarks || null,
      body.driver_id || null,
      body.guide_id || null,
      body.transporter_id || null,
      body.workflow_step ?? 0,
      body.acompte_amount ?? 0,
      body.payment_status || 'pending',
      body.voucher_sent ? 1 : 0,
      body.raw_email || null
    );

    const newId = result.lastInsertRowid as number;

    // Auto-create a task for this reservation
    db.prepare(`
      INSERT INTO tasks (title, type, reservation_id, assigned_by, priority, status, due_date)
      VALUES (?, 'reservation', ?, ?, 'normal', 'todo', ?)
    `).run(
      `Traiter réservation #${newId} - ${body.client_name || 'Nouveau client'}`,
      newId,
      req.user?.userId || null,
      body.excursion_date || null
    );

    const created = db.prepare('SELECT * FROM reservations WHERE id = ?').get(newId);
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
}

export function update(req: Request, res: Response, next: NextFunction): void {
  try {
    const existing = db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id) as Reservation | undefined;
    if (!existing) { next(createError('Reservation not found', 404)); return; }

    const body = req.body;
    const fields: string[] = [];
    const values: unknown[] = [];

    const allowed = [
      'date_received', 'excursion_id', 'ota_id', 'ota_ref', 'status', 'excursion_date',
      'pax_adults', 'pax_children', 'sale_price', 'sale_currency', 'commission_pct',
      'client_hotel', 'client_name', 'pickup_time', 'phone', 'remarks',
      'driver_id', 'guide_id', 'transporter_id', 'workflow_step',
      'acompte_amount', 'payment_status', 'voucher_sent', 'raw_email',
    ];

    for (const key of allowed) {
      if (key in body) {
        fields.push(`${key} = ?`);
        values.push(body[key]);
      }
    }

    if (fields.length === 0) { res.json({ success: true, data: existing }); return; }

    fields.push(`updated_at = datetime('now')`);
    values.push(req.params.id);

    db.prepare(`UPDATE reservations SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    const updated = db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export function remove(req: Request, res: Response, next: NextFunction): void {
  try {
    const existing = db.prepare('SELECT id FROM reservations WHERE id = ?').get(req.params.id);
    if (!existing) { next(createError('Reservation not found', 404)); return; }
    db.prepare('DELETE FROM reservations WHERE id = ?').run(req.params.id);
    res.json({ success: true, data: { message: 'Reservation deleted' } });
  } catch (err) {
    next(err);
  }
}

export function advanceWorkflow(req: Request, res: Response, next: NextFunction): void {
  try {
    const reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id) as Reservation | undefined;
    if (!reservation) { next(createError('Reservation not found', 404)); return; }

    const currentStep = reservation.workflow_step;
    if (currentStep >= 3) {
      next(createError('Reservation is already at final workflow step', 400));
      return;
    }

    const nextStep = (currentStep + 1) as 0 | 1 | 2 | 3;
    db.prepare(`UPDATE reservations SET workflow_step = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(nextStep, req.params.id);

    const updated = db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export function getNetPrice(req: Request, res: Response, next: NextFunction): void {
  try {
    const reservation = db.prepare('SELECT sale_price, commission_pct, sale_currency FROM reservations WHERE id = ?')
      .get(req.params.id) as Pick<Reservation, 'sale_price' | 'commission_pct' | 'sale_currency'> | undefined;
    if (!reservation) { next(createError('Reservation not found', 404)); return; }

    const net = reservation.sale_price * (1 - reservation.commission_pct / 100);
    res.json({
      success: true,
      data: {
        sale_price: reservation.sale_price,
        commission_pct: reservation.commission_pct,
        net_price: Math.round(net * 100) / 100,
        currency: reservation.sale_currency,
      },
    });
  } catch (err) {
    next(err);
  }
}
