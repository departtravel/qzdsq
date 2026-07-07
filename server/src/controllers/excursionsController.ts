import { Request, Response, NextFunction } from 'express';
import { db } from '../db/database';
import { Excursion } from '../types';
import { createError } from '../middleware/errorHandler';

export function list(req: Request, res: Response, next: NextFunction): void {
  try {
    const active = req.query.active !== 'false';
    const rows = db.prepare(`SELECT * FROM excursions ${active ? 'WHERE is_active = 1' : ''} ORDER BY code`).all();
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

export function getOne(req: Request, res: Response, next: NextFunction): void {
  try {
    const row = db.prepare('SELECT * FROM excursions WHERE id = ?').get(req.params.id);
    if (!row) { next(createError('Excursion not found', 404)); return; }
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
}

export function create(req: Request, res: Response, next: NextFunction): void {
  try {
    const b = req.body;
    const result = db.prepare(`
      INSERT INTO excursions (code, name, description, cost_meal_pp, cost_accommodation_pp,
        cost_extras_pp, cost_activity_pp, cost_child_pp, child_age_max,
        cost_guide_shared, cost_transport_shared, cost_camp_shared, cost_other_shared,
        min_pax, max_pax, duration_days, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      b.code, b.name, b.description || null,
      b.cost_meal_pp ?? 0, b.cost_accommodation_pp ?? 0,
      b.cost_extras_pp ?? 0, b.cost_activity_pp ?? 0,
      b.cost_child_pp ?? 0, b.child_age_max ?? 12,
      b.cost_guide_shared ?? 0, b.cost_transport_shared ?? 0,
      b.cost_camp_shared ?? 0, b.cost_other_shared ?? 0,
      b.min_pax ?? 1, b.max_pax ?? 20,
      b.duration_days ?? 1, b.is_active ?? 1
    );
    const created = db.prepare('SELECT * FROM excursions WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
}

export function update(req: Request, res: Response, next: NextFunction): void {
  try {
    const existing = db.prepare('SELECT * FROM excursions WHERE id = ?').get(req.params.id) as Excursion | undefined;
    if (!existing) { next(createError('Excursion not found', 404)); return; }

    const allowed = [
      'code', 'name', 'description', 'cost_meal_pp', 'cost_accommodation_pp',
      'cost_extras_pp', 'cost_activity_pp', 'cost_child_pp', 'child_age_max',
      'cost_guide_shared', 'cost_transport_shared', 'cost_camp_shared', 'cost_other_shared',
      'min_pax', 'max_pax', 'duration_days', 'is_active',
    ];
    const fields: string[] = [];
    const values: unknown[] = [];
    for (const key of allowed) {
      if (key in req.body) { fields.push(`${key} = ?`); values.push(req.body[key]); }
    }
    if (fields.length === 0) { res.json({ success: true, data: existing }); return; }
    values.push(req.params.id);
    db.prepare(`UPDATE excursions SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    res.json({ success: true, data: db.prepare('SELECT * FROM excursions WHERE id = ?').get(req.params.id) });
  } catch (err) {
    next(err);
  }
}

export function remove(req: Request, res: Response, next: NextFunction): void {
  try {
    if (!db.prepare('SELECT id FROM excursions WHERE id = ?').get(req.params.id)) {
      next(createError('Excursion not found', 404)); return;
    }
    db.prepare('UPDATE excursions SET is_active = 0 WHERE id = ?').run(req.params.id);
    res.json({ success: true, data: { message: 'Excursion deactivated' } });
  } catch (err) {
    next(err);
  }
}

export function costBreakdown(req: Request, res: Response, next: NextFunction): void {
  try {
    const exc = db.prepare('SELECT * FROM excursions WHERE id = ?').get(req.params.id) as Excursion | undefined;
    if (!exc) { next(createError('Excursion not found', 404)); return; }

    const pax_adults = Number(req.query.pax_adults) || 2;
    const pax_children = Number(req.query.pax_children) || 0;
    const totalPax = pax_adults + pax_children;

    const per_pax_cost = exc.cost_meal_pp + exc.cost_accommodation_pp + exc.cost_extras_pp + exc.cost_activity_pp;
    const children_cost = pax_children * exc.cost_child_pp;
    const adults_cost = pax_adults * per_pax_cost;

    const shared_costs = exc.cost_guide_shared + exc.cost_transport_shared + exc.cost_camp_shared + exc.cost_other_shared;
    const shared_per_pax = totalPax > 0 ? shared_costs / totalPax : 0;

    const total_cost = adults_cost + children_cost + shared_costs;
    const cost_per_adult = per_pax_cost + shared_per_pax;

    res.json({
      success: true,
      data: {
        excursion: { id: exc.id, code: exc.code, name: exc.name },
        pax: { adults: pax_adults, children: pax_children, total: totalPax },
        breakdown: {
          cost_meal_pp: exc.cost_meal_pp,
          cost_accommodation_pp: exc.cost_accommodation_pp,
          cost_extras_pp: exc.cost_extras_pp,
          cost_activity_pp: exc.cost_activity_pp,
          cost_child_pp: exc.cost_child_pp,
          per_pax_variable: per_pax_cost,
          adults_variable_total: adults_cost,
          children_total: children_cost,
          shared_guide: exc.cost_guide_shared,
          shared_transport: exc.cost_transport_shared,
          shared_camp: exc.cost_camp_shared,
          shared_other: exc.cost_other_shared,
          shared_total: shared_costs,
          shared_per_pax: Math.round(shared_per_pax * 100) / 100,
        },
        totals: {
          total_cost: Math.round(total_cost * 100) / 100,
          cost_per_adult: Math.round(cost_per_adult * 100) / 100,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}
