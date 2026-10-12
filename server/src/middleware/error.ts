import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { z, ZodError, type ZodSchema } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) { super(message); }
}

/** Wrap async handlers so rejections reach the error middleware */
export const ah = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => { fn(req, res, next).catch(next); };

export const validate = <S extends ZodSchema>(schema: S, data: unknown): z.output<S> => {
  const r = schema.safeParse(data);
  if (!r.success) throw new HttpError(400, 'Validation failed', r.error.flatten());
  return r.data;
};

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, details: err.details });
  if (err instanceof ZodError) return res.status(400).json({ error: 'Validation failed', details: err.flatten() });
  if ((err as any)?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File too large' });
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}
