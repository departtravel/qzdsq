import { Request, Response, NextFunction } from 'express';
import { db } from '../db/database';
import { parseEmail } from '../agents/voyageAgent';

export async function parseEmailHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { raw_email } = req.body;
    if (!raw_email) {
      res.status(400).json({ success: false, error: 'raw_email is required' });
      return;
    }

    const extracted = await parseEmail(raw_email);
    res.json({ success: true, data: extracted });
  } catch (err) {
    next(err);
  }
}

export function listLogs(req: Request, res: Response, next: NextFunction): void {
  try {
    const { limit = '20', offset = '0' } = req.query;
    const logs = db.prepare(`
      SELECT * FROM agent_logs
      WHERE agent_type = 'claude-haiku'
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(Number(limit), Number(offset));
    const total = (db.prepare("SELECT COUNT(*) as c FROM agent_logs WHERE agent_type = 'claude-haiku'").get() as { c: number }).c;
    res.json({ success: true, data: logs, meta: { total } });
  } catch (err) {
    next(err);
  }
}
