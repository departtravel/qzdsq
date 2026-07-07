import { Request, Response, NextFunction } from 'express';
import { db } from '../db/database';
import { OTA } from '../types';
import { createError } from '../middleware/errorHandler';

export function list(_req: Request, res: Response, next: NextFunction): void {
  try {
    res.json({ success: true, data: db.prepare('SELECT * FROM otas ORDER BY name').all() });
  } catch (err) { next(err); }
}

export function getOne(req: Request, res: Response, next: NextFunction): void {
  try {
    const row = db.prepare('SELECT * FROM otas WHERE id = ?').get(req.params.id);
    if (!row) { next(createError('OTA not found', 404)); return; }
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
}

export function create(req: Request, res: Response, next: NextFunction): void {
  try {
    const b = req.body;
    if (!b.name) { next(createError('name is required', 400)); return; }
    const result = db.prepare(`
      INSERT INTO otas (name, commission_pct, default_currency, contact_email, is_active)
      VALUES (?, ?, ?, ?, ?)
    `).run(b.name, b.commission_pct ?? 0, b.default_currency || 'EUR', b.contact_email || null, b.is_active ?? 1);
    res.status(201).json({ success: true, data: db.prepare('SELECT * FROM otas WHERE id = ?').get(result.lastInsertRowid) });
  } catch (err) { next(err); }
}

export function update(req: Request, res: Response, next: NextFunction): void {
  try {
    const existing = db.prepare('SELECT * FROM otas WHERE id = ?').get(req.params.id) as OTA | undefined;
    if (!existing) { next(createError('OTA not found', 404)); return; }
    const allowed = ['name', 'commission_pct', 'default_currency', 'contact_email', 'is_active'];
    const fields: string[] = [];
    const values: unknown[] = [];
    for (const key of allowed) {
      if (key in req.body) { fields.push(`${key} = ?`); values.push(req.body[key]); }
    }
    if (!fields.length) { res.json({ success: true, data: existing }); return; }
    values.push(req.params.id);
    db.prepare(`UPDATE otas SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    res.json({ success: true, data: db.prepare('SELECT * FROM otas WHERE id = ?').get(req.params.id) });
  } catch (err) { next(err); }
}

export function remove(req: Request, res: Response, next: NextFunction): void {
  try {
    if (!db.prepare('SELECT id FROM otas WHERE id = ?').get(req.params.id)) {
      next(createError('OTA not found', 404)); return;
    }
    db.prepare('UPDATE otas SET is_active = 0 WHERE id = ?').run(req.params.id);
    res.json({ success: true, data: { message: 'OTA deactivated' } });
  } catch (err) { next(err); }
}

export function monthlySheet(req: Request, res: Response, next: NextFunction): void {
  try {
    const { id, month } = req.params;
    const ota = db.prepare('SELECT * FROM otas WHERE id = ?').get(id) as OTA | undefined;
    if (!ota) { next(createError('OTA not found', 404)); return; }

    const reservations = db.prepare(`
      SELECT r.*, e.name AS excursion_name, e.code AS excursion_code
      FROM reservations r
      LEFT JOIN excursions e ON e.id = r.excursion_id
      WHERE r.ota_id = ?
        AND strftime('%Y-%m', COALESCE(r.excursion_date, r.date_received)) = ?
        AND r.status != 'cancelled'
      ORDER BY r.excursion_date
    `).all(id, month);

    const grossRevenue = (reservations as { sale_price: number }[]).reduce((s, r) => s + r.sale_price, 0);
    const commissionAmount = grossRevenue * (ota.commission_pct / 100);
    const netRevenue = grossRevenue - commissionAmount;

    // Upsert monthly sheet
    db.prepare(`INSERT OR REPLACE INTO ota_monthly_sheets
      (ota_id, month, gross_revenue, commission_amount, net_revenue, currency)
      VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, month, grossRevenue, commissionAmount, netRevenue, ota.default_currency);

    res.json({
      success: true,
      data: {
        ota,
        month,
        reservations,
        summary: {
          gross_revenue: Math.round(grossRevenue * 100) / 100,
          commission_pct: ota.commission_pct,
          commission_amount: Math.round(commissionAmount * 100) / 100,
          net_revenue: Math.round(netRevenue * 100) / 100,
          currency: ota.default_currency,
          count: reservations.length,
        },
      },
    });
  } catch (err) { next(err); }
}
