import { Request, Response, NextFunction } from 'express';
import { db } from '../db/database';

export function getAll(_req: Request, res: Response, next: NextFunction): void {
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    res.json({ success: true, data: settings });
  } catch (err) { next(err); }
}

export function updateSettings(req: Request, res: Response, next: NextFunction): void {
  try {
    const updates = req.body as Record<string, string>;
    const upsert = db.prepare(`INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))`);
    const updateAll = db.transaction(() => {
      for (const [key, value] of Object.entries(updates)) {
        upsert.run(key, String(value));
      }
    });
    updateAll();
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    res.json({ success: true, data: Object.fromEntries(rows.map((r) => [r.key, r.value])) });
  } catch (err) { next(err); }
}

export function getExchangeRates(_req: Request, res: Response, next: NextFunction): void {
  try {
    const rates = db.prepare('SELECT * FROM exchange_rates ORDER BY from_currency, to_currency').all();
    res.json({ success: true, data: rates });
  } catch (err) { next(err); }
}

export function updateExchangeRates(req: Request, res: Response, next: NextFunction): void {
  try {
    const rates = req.body as Array<{ from_currency: string; to_currency: string; rate: number }>;
    if (!Array.isArray(rates)) { res.status(400).json({ success: false, error: 'Expected array of rates' }); return; }
    const upsert = db.prepare(`
      INSERT OR REPLACE INTO exchange_rates (from_currency, to_currency, rate, updated_at)
      VALUES (?, ?, ?, datetime('now'))
    `);
    const updateAll = db.transaction(() => {
      for (const r of rates) {
        upsert.run(r.from_currency, r.to_currency, r.rate);
      }
    });
    updateAll();
    res.json({ success: true, data: db.prepare('SELECT * FROM exchange_rates ORDER BY from_currency, to_currency').all() });
  } catch (err) { next(err); }
}
