import { Request, Response, NextFunction } from 'express';
import { db } from '../db/database';
import { Partner } from '../types';
import { createError } from '../middleware/errorHandler';

export function list(req: Request, res: Response, next: NextFunction): void {
  try {
    const { type, active = 'true' } = req.query;
    let query = 'SELECT * FROM partners WHERE 1=1';
    const params: unknown[] = [];
    if (active === 'true') { query += ' AND is_active = 1'; }
    if (type) { query += ' AND type = ?'; params.push(type); }
    query += ' ORDER BY name';
    res.json({ success: true, data: db.prepare(query).all(...params) });
  } catch (err) {
    next(err);
  }
}

export function getOne(req: Request, res: Response, next: NextFunction): void {
  try {
    const row = db.prepare('SELECT * FROM partners WHERE id = ?').get(req.params.id);
    if (!row) { next(createError('Partner not found', 404)); return; }
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
}

export function create(req: Request, res: Response, next: NextFunction): void {
  try {
    const b = req.body;
    if (!b.name || !b.type) { next(createError('name and type are required', 400)); return; }
    const result = db.prepare(`
      INSERT INTO partners (name, type, contact_name, phone, email, address, tva_number, rib, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(b.name, b.type, b.contact_name || null, b.phone || null, b.email || null,
           b.address || null, b.tva_number || null, b.rib || null, b.notes || null);
    res.status(201).json({ success: true, data: db.prepare('SELECT * FROM partners WHERE id = ?').get(result.lastInsertRowid) });
  } catch (err) {
    next(err);
  }
}

export function update(req: Request, res: Response, next: NextFunction): void {
  try {
    const existing = db.prepare('SELECT * FROM partners WHERE id = ?').get(req.params.id) as Partner | undefined;
    if (!existing) { next(createError('Partner not found', 404)); return; }

    const allowed = ['name', 'type', 'contact_name', 'phone', 'email', 'address', 'tva_number', 'rib', 'notes', 'is_active'];
    const fields: string[] = [];
    const values: unknown[] = [];
    for (const key of allowed) {
      if (key in req.body) { fields.push(`${key} = ?`); values.push(req.body[key]); }
    }
    if (fields.length === 0) { res.json({ success: true, data: existing }); return; }
    values.push(req.params.id);
    db.prepare(`UPDATE partners SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    res.json({ success: true, data: db.prepare('SELECT * FROM partners WHERE id = ?').get(req.params.id) });
  } catch (err) {
    next(err);
  }
}

export function remove(req: Request, res: Response, next: NextFunction): void {
  try {
    if (!db.prepare('SELECT id FROM partners WHERE id = ?').get(req.params.id)) {
      next(createError('Partner not found', 404)); return;
    }
    db.prepare('UPDATE partners SET is_active = 0 WHERE id = ?').run(req.params.id);
    res.json({ success: true, data: { message: 'Partner deactivated' } });
  } catch (err) {
    next(err);
  }
}

export function monthlySheet(req: Request, res: Response, next: NextFunction): void {
  try {
    const { id, month } = req.params;
    const partner = db.prepare('SELECT * FROM partners WHERE id = ?').get(id) as Partner | undefined;
    if (!partner) { next(createError('Partner not found', 404)); return; }

    const bookings = db.prepare(`
      SELECT sb.*, r.client_name, r.excursion_date, e.name AS excursion_name, e.code AS excursion_code
      FROM supplier_bookings sb
      LEFT JOIN reservations r ON r.id = sb.reservation_id
      LEFT JOIN excursions e ON e.id = r.excursion_id
      WHERE sb.partner_id = ?
        AND strftime('%Y-%m', COALESCE(sb.date, r.excursion_date)) = ?
        AND sb.status != 'cancelled'
      ORDER BY sb.date
    `).all(id, month);

    const totalHt = (bookings as { amount: number }[]).reduce((sum, b) => sum + b.amount, 0);
    const tvaRate = 0.19;
    const tvaAmount = totalHt * tvaRate;
    const fiscalStamp = 1;
    const totalTtc = totalHt + tvaAmount + fiscalStamp;

    // Upsert monthly sheet
    const existing = db.prepare('SELECT * FROM partner_monthly_sheets WHERE partner_id = ? AND month = ?').get(id, month);
    if (!existing) {
      db.prepare(`INSERT OR REPLACE INTO partner_monthly_sheets
        (partner_id, month, total_ht, tva_amount, fiscal_stamp, total_ttc)
        VALUES (?, ?, ?, ?, ?, ?)`
      ).run(id, month, totalHt, tvaAmount, fiscalStamp, totalTtc);
    }

    res.json({
      success: true,
      data: {
        partner,
        month,
        bookings,
        summary: {
          total_ht: Math.round(totalHt * 100) / 100,
          tva_amount: Math.round(tvaAmount * 100) / 100,
          fiscal_stamp: fiscalStamp,
          total_ttc: Math.round(totalTtc * 100) / 100,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}
