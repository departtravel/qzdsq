import { Request, Response, NextFunction } from 'express';
import { db } from '../db/database';
import { CrmClient } from '../types';
import { createError } from '../middleware/errorHandler';

export function list(req: Request, res: Response, next: NextFunction): void {
  try {
    const { search, limit = '50', offset = '0' } = req.query;
    let query = 'SELECT * FROM crm_clients WHERE 1=1';
    const params: unknown[] = [];
    if (search) { query += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    query += ' ORDER BY total_bookings DESC, name ASC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));
    res.json({ success: true, data: db.prepare(query).all(...params) });
  } catch (err) { next(err); }
}

export function getOne(req: Request, res: Response, next: NextFunction): void {
  try {
    const row = db.prepare('SELECT * FROM crm_clients WHERE id = ?').get(req.params.id);
    if (!row) { next(createError('Client not found', 404)); return; }
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
}

export function create(req: Request, res: Response, next: NextFunction): void {
  try {
    const b = req.body;
    if (!b.name) { next(createError('name is required', 400)); return; }
    const result = db.prepare(`
      INSERT INTO crm_clients (name, email, phone, nationality, preferences, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(b.name, b.email || null, b.phone || null, b.nationality || null, b.preferences || null, b.notes || null);
    res.status(201).json({ success: true, data: db.prepare('SELECT * FROM crm_clients WHERE id = ?').get(result.lastInsertRowid) });
  } catch (err) { next(err); }
}

export function update(req: Request, res: Response, next: NextFunction): void {
  try {
    const existing = db.prepare('SELECT * FROM crm_clients WHERE id = ?').get(req.params.id) as CrmClient | undefined;
    if (!existing) { next(createError('Client not found', 404)); return; }
    const allowed = ['name', 'email', 'phone', 'nationality', 'preferences', 'notes', 'loyalty_points'];
    const fields: string[] = [];
    const values: unknown[] = [];
    for (const key of allowed) {
      if (key in req.body) { fields.push(`${key} = ?`); values.push(req.body[key]); }
    }
    if (!fields.length) { res.json({ success: true, data: existing }); return; }
    values.push(req.params.id);
    db.prepare(`UPDATE crm_clients SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    res.json({ success: true, data: db.prepare('SELECT * FROM crm_clients WHERE id = ?').get(req.params.id) });
  } catch (err) { next(err); }
}

export function remove(req: Request, res: Response, next: NextFunction): void {
  try {
    if (!db.prepare('SELECT id FROM crm_clients WHERE id = ?').get(req.params.id)) {
      next(createError('Client not found', 404)); return;
    }
    db.prepare('DELETE FROM crm_clients WHERE id = ?').run(req.params.id);
    res.json({ success: true, data: { message: 'Client deleted' } });
  } catch (err) { next(err); }
}

export function history(req: Request, res: Response, next: NextFunction): void {
  try {
    const client = db.prepare('SELECT * FROM crm_clients WHERE id = ?').get(req.params.id) as CrmClient | undefined;
    if (!client) { next(createError('Client not found', 404)); return; }

    // Match by phone or name
    const reservations = db.prepare(`
      SELECT r.*, e.name AS excursion_name, e.code AS excursion_code, o.name AS ota_name
      FROM reservations r
      LEFT JOIN excursions e ON e.id = r.excursion_id
      LEFT JOIN otas o ON o.id = r.ota_id
      WHERE r.client_name = ? OR r.phone = ?
      ORDER BY r.excursion_date DESC
    `).all(client.name, client.phone || '');

    const totalBookings = reservations.length;
    const totalSpentTnd = (reservations as { net_price: number; sale_currency: string }[]).reduce((sum, r) => {
      let amount = r.net_price || 0;
      const rate = r.sale_currency === 'EUR' ? 3.35 : r.sale_currency === 'USD' ? 3.10 : 1;
      return sum + amount * rate;
    }, 0);

    // Update stats
    db.prepare(`UPDATE crm_clients SET total_bookings = ?, total_spent_tnd = ? WHERE id = ?`)
      .run(totalBookings, Math.round(totalSpentTnd * 100) / 100, req.params.id);

    res.json({
      success: true,
      data: {
        client,
        reservations,
        stats: { total_bookings: totalBookings, total_spent_tnd: Math.round(totalSpentTnd * 100) / 100 },
      },
    });
  } catch (err) { next(err); }
}
