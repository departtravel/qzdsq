import { Request, Response, NextFunction } from 'express';
import { db } from '../db/database';
import { createError } from '../middleware/errorHandler';

export function list(req: Request, res: Response, next: NextFunction): void {
  try {
    const { reservation_id, partner_id, status } = req.query;
    let query = `
      SELECT sb.*, p.name AS partner_name, p.type AS partner_type,
        r.client_name, r.excursion_date
      FROM supplier_bookings sb
      LEFT JOIN partners p ON p.id = sb.partner_id
      LEFT JOIN reservations r ON r.id = sb.reservation_id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    if (reservation_id) { query += ' AND sb.reservation_id = ?'; params.push(Number(reservation_id)); }
    if (partner_id) { query += ' AND sb.partner_id = ?'; params.push(Number(partner_id)); }
    if (status) { query += ' AND sb.status = ?'; params.push(status); }
    query += ' ORDER BY sb.date DESC, sb.id DESC';
    res.json({ success: true, data: db.prepare(query).all(...params) });
  } catch (err) { next(err); }
}

export function getOne(req: Request, res: Response, next: NextFunction): void {
  try {
    const row = db.prepare(`
      SELECT sb.*, p.name AS partner_name, r.client_name, r.excursion_date
      FROM supplier_bookings sb
      LEFT JOIN partners p ON p.id = sb.partner_id
      LEFT JOIN reservations r ON r.id = sb.reservation_id
      WHERE sb.id = ?
    `).get(req.params.id);
    if (!row) { next(createError('Supplier booking not found', 404)); return; }
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
}

export function create(req: Request, res: Response, next: NextFunction): void {
  try {
    const b = req.body;
    if (!b.service_type) { next(createError('service_type is required', 400)); return; }
    const result = db.prepare(`
      INSERT INTO supplier_bookings (reservation_id, partner_id, service_type, date, amount, currency, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      b.reservation_id || null, b.partner_id || null, b.service_type,
      b.date || null, b.amount ?? 0, b.currency || 'TND',
      b.status || 'pending', b.notes || null
    );
    res.status(201).json({ success: true, data: db.prepare('SELECT * FROM supplier_bookings WHERE id = ?').get(result.lastInsertRowid) });
  } catch (err) { next(err); }
}

export function update(req: Request, res: Response, next: NextFunction): void {
  try {
    if (!db.prepare('SELECT id FROM supplier_bookings WHERE id = ?').get(req.params.id)) {
      next(createError('Supplier booking not found', 404)); return;
    }
    const allowed = ['reservation_id', 'partner_id', 'service_type', 'date', 'amount', 'currency', 'status', 'notes'];
    const fields: string[] = [];
    const values: unknown[] = [];
    for (const key of allowed) {
      if (key in req.body) { fields.push(`${key} = ?`); values.push(req.body[key]); }
    }
    if (!fields.length) { res.json({ success: true, data: db.prepare('SELECT * FROM supplier_bookings WHERE id = ?').get(req.params.id) }); return; }
    values.push(req.params.id);
    db.prepare(`UPDATE supplier_bookings SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    res.json({ success: true, data: db.prepare('SELECT * FROM supplier_bookings WHERE id = ?').get(req.params.id) });
  } catch (err) { next(err); }
}

export function remove(req: Request, res: Response, next: NextFunction): void {
  try {
    if (!db.prepare('SELECT id FROM supplier_bookings WHERE id = ?').get(req.params.id)) {
      next(createError('Supplier booking not found', 404)); return;
    }
    db.prepare('DELETE FROM supplier_bookings WHERE id = ?').run(req.params.id);
    res.json({ success: true, data: { message: 'Supplier booking deleted' } });
  } catch (err) { next(err); }
}
