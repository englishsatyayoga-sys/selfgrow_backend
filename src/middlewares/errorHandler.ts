import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { ApiError } from '../utils/ApiError';
import { sendError } from '../utils/apiResponse';
import { logger } from '../config/logger';
import { env } from '../config/env';

export const errorHandler: ErrorRequestHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // 1. ApiError (Operational errors)
  if (err instanceof ApiError) {
    if (!err.isOperational) {
      logger.error({ err, path: req.path, method: req.method }, 'Non-operational ApiError occurred');
    }
    sendError(res, err.statusCode, err.code, err.message);
    return;
  }

  // 2. Zod Validation Errors
  if (err instanceof ZodError) {
    const issue = err.issues[0];
    const path = issue?.path.join('.') || 'body';
    const message = issue ? `${path}: ${issue.message}` : 'Validation error';
    sendError(res, 400, 'VALIDATION_ERROR', message);
    return;
  }

  // 3. Prisma Known Request Errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : 'field';
      sendError(res, 409, 'CONFLICT', `A record with this ${target} already exists`);
      return;
    }

    if (err.code === 'P2025') {
      sendError(res, 404, 'NOT_FOUND', 'Requested record was not found');
      return;
    }

    logger.error({ err, code: err.code, path: req.path }, 'Prisma known error');
    sendError(res, 400, 'DATABASE_ERROR', 'A database operation error occurred');
    return;
  }

  // 4. Prisma Initialization / Connection Errors
  if (err instanceof Prisma.PrismaClientInitializationError) {
    logger.error({ err, path: req.path }, 'Database connection error');
    sendError(res, 500, 'DATABASE_CONNECTION_ERROR', 'Unable to connect to the database');
    return;
  }

  // 5. JWT Errors
  if (err.name === 'JsonWebTokenError') {
    sendError(res, 401, 'INVALID_TOKEN', 'Invalid authentication token');
    return;
  }
  if (err.name === 'TokenExpiredError') {
    sendError(res, 401, 'TOKEN_EXPIRED', 'Authentication token has expired');
    return;
  }

  // 6. Unknown / Unhandled Errors
  logger.error(
    {
      err: {
        message: err.message,
        stack: err.stack,
      },
      path: req.path,
      method: req.method,
    },
    'Unhandled server error'
  );

  const message =
    env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message || 'Internal server error';

  sendError(res, 500, 'INTERNAL_SERVER_ERROR', message);
};

