import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { Role } from '@prisma/client';

interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}

export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  const token =
    req.cookies?.accessToken ||
    req.cookies?.access_token ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : undefined);

  if (!token) {
    return next(ApiError.unauthorized('Authentication token is required', 'UNAUTHORIZED'));
  }

  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
    };
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(ApiError.unauthorized('Access token has expired', 'TOKEN_EXPIRED'));
    }
    return next(ApiError.unauthorized('Invalid access token', 'INVALID_TOKEN'));
  }
};
