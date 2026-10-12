import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { HttpError } from './error.js';

export type Role = 'student' | 'teacher' | 'admin';
export interface AuthUser { id: string; role: Role; email: string; }

declare global {
  namespace Express { interface Request { user?: AuthUser } }
}

export function signToken(u: AuthUser) {
  return jwt.sign(u, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN as any });
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return next(new HttpError(401, 'Unauthenticated'));
  try {
    const p = jwt.verify(h.slice(7), config.JWT_SECRET) as AuthUser;
    req.user = { id: p.id, role: p.role, email: p.email };
    next();
  } catch {
    next(new HttpError(401, 'Invalid or expired token'));
  }
}

export const requireRole = (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) =>
    req.user && roles.includes(req.user.role) ? next() : next(new HttpError(403, 'Forbidden'));
