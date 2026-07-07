import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db/database';
import { User, JwtPayload } from '../types';
import { createError } from '../middleware/errorHandler';

export function login(req: Request, res: Response, next: NextFunction): void {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      next(createError('Email and password are required', 400));
      return;
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined;

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      next(createError('Invalid credentials', 401));
      return;
    }

    const secret = process.env.JWT_SECRET || 'change_me_in_production';
    const payload: JwtPayload = { userId: user.id, email: user.email, role: user.role };
    const token = jwt.sign(payload, secret, { expiresIn: '8h' });

    res.json({
      success: true,
      data: {
        token,
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
      },
    });
  } catch (err) {
    next(err);
  }
}

export function me(req: Request, res: Response, next: NextFunction): void {
  try {
    const user = db.prepare('SELECT id, email, name, role, created_at FROM users WHERE id = ?')
      .get(req.user!.userId) as Omit<User, 'password_hash'> | undefined;

    if (!user) {
      next(createError('User not found', 404));
      return;
    }

    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

export function logout(_req: Request, res: Response): void {
  res.json({ success: true, data: { message: 'Logged out successfully' } });
}
