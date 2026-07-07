import { Request, Response, NextFunction } from 'express';
import { db } from '../db/database';
import { parseEmail } from '../agents/voyageAgent';
import { checkAlerts, generateAccountingEntry } from '../agents/erpAgent';
import { Reservation } from '../types';
import { createError } from '../middleware/errorHandler';

export async function parseEmailHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { raw_email } = req.body;
    if (!raw_email) { res.status(400).json({ success: false, error: 'raw_email is required' }); return; }
    const result = await parseEmail(raw_email);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

export function alertsHandler(_req: Request, res: Response, next: NextFunction): void {
  try {
    const alerts = checkAlerts();
    res.json({ success: true, data: alerts, meta: { count: alerts.length } });
  } catch (err) { next(err); }
}

export function accountingEntry(req: Request, res: Response, next: NextFunction): void {
  try {
    const { reservation_id } = req.body;
    let reservation: Reservation | undefined;

    if (reservation_id) {
      reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(reservation_id) as Reservation | undefined;
      if (!reservation) { next(createError('Reservation not found', 404)); return; }
    } else if (req.body.reservation) {
      reservation = req.body.reservation as Reservation;
    } else {
      next(createError('reservation_id or reservation object required', 400)); return;
    }

    const entries = generateAccountingEntry(reservation);
    res.json({ success: true, data: entries });
  } catch (err) { next(err); }
}

export function listLogs(req: Request, res: Response, next: NextFunction): void {
  try {
    const { limit = '20', offset = '0', agent_type } = req.query;
    let query = 'SELECT * FROM agent_logs WHERE 1=1';
    const params: unknown[] = [];
    if (agent_type) { query += ' AND agent_type = ?'; params.push(agent_type); }
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));
    const logs = db.prepare(query).all(...params);
    const total = (db.prepare('SELECT COUNT(*) as c FROM agent_logs').get() as { c: number }).c;
    res.json({ success: true, data: logs, meta: { total } });
  } catch (err) { next(err); }
}
