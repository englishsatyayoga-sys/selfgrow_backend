import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incomingId = req.headers['x-request-id'];
  const id = typeof incomingId === 'string' && incomingId.trim() ? incomingId : crypto.randomUUID();
  (req as any).id = id;
  res.setHeader('X-Request-Id', id);
  next();
}

