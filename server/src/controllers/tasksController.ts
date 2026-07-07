import { Request, Response, NextFunction } from 'express';
import { db } from '../db/database';
import { Task } from '../types';
import { createError } from '../middleware/errorHandler';

export function list(req: Request, res: Response, next: NextFunction): void {
  try {
    const { assigned_to, status, type, reservation_id, limit = '50', offset = '0' } = req.query;
    let query = `
      SELECT t.*,
        u1.name AS assigned_to_name,
        u2.name AS assigned_by_name,
        r.client_name AS reservation_client
      FROM tasks t
      LEFT JOIN users u1 ON u1.id = t.assigned_to
      LEFT JOIN users u2 ON u2.id = t.assigned_by
      LEFT JOIN reservations r ON r.id = t.reservation_id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (assigned_to) { query += ' AND t.assigned_to = ?'; params.push(Number(assigned_to)); }
    if (status) { query += ' AND t.status = ?'; params.push(status); }
    if (type) { query += ' AND t.type = ?'; params.push(type); }
    if (reservation_id) { query += ' AND t.reservation_id = ?'; params.push(Number(reservation_id)); }

    query += ' ORDER BY CASE t.priority WHEN \'urgent\' THEN 0 WHEN \'high\' THEN 1 ELSE 2 END, t.due_date ASC NULLS LAST, t.id DESC';
    query += ' LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    res.json({ success: true, data: db.prepare(query).all(...params) });
  } catch (err) {
    next(err);
  }
}

export function getOne(req: Request, res: Response, next: NextFunction): void {
  try {
    const row = db.prepare(`
      SELECT t.*, u1.name AS assigned_to_name, u2.name AS assigned_by_name
      FROM tasks t
      LEFT JOIN users u1 ON u1.id = t.assigned_to
      LEFT JOIN users u2 ON u2.id = t.assigned_by
      WHERE t.id = ?
    `).get(req.params.id);
    if (!row) { next(createError('Task not found', 404)); return; }
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
}

export function create(req: Request, res: Response, next: NextFunction): void {
  try {
    const b = req.body;
    if (!b.title) { next(createError('title is required', 400)); return; }
    const result = db.prepare(`
      INSERT INTO tasks (title, description, type, reservation_id, assigned_to, assigned_by, priority, due_date, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      b.title, b.description || null, b.type || 'free',
      b.reservation_id || null, b.assigned_to || null,
      req.user?.userId || null,
      b.priority || 'normal', b.due_date || null,
      b.status || 'todo', b.notes || null
    );
    res.status(201).json({ success: true, data: db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid) });
  } catch (err) {
    next(err);
  }
}

export function update(req: Request, res: Response, next: NextFunction): void {
  try {
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as Task | undefined;
    if (!existing) { next(createError('Task not found', 404)); return; }

    const allowed = ['title', 'description', 'type', 'reservation_id', 'assigned_to', 'priority', 'due_date', 'status', 'notes'];
    const fields: string[] = [];
    const values: unknown[] = [];
    for (const key of allowed) {
      if (key in req.body) { fields.push(`${key} = ?`); values.push(req.body[key]); }
    }
    fields.push(`updated_at = datetime('now')`);
    values.push(req.params.id);
    db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    res.json({ success: true, data: db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) });
  } catch (err) {
    next(err);
  }
}

export function remove(req: Request, res: Response, next: NextFunction): void {
  try {
    if (!db.prepare('SELECT id FROM tasks WHERE id = ?').get(req.params.id)) {
      next(createError('Task not found', 404)); return;
    }
    db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
    res.json({ success: true, data: { message: 'Task deleted' } });
  } catch (err) {
    next(err);
  }
}
