import { Request, Response } from 'express';
import { attemptsService } from './attempts.service';
import { sendSuccess } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';

export const startAttempt = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw ApiError.unauthorized('Authentication required', 'UNAUTHORIZED');
  }

  const attempt = await attemptsService.startAttempt(req.body, req.user.id);
  sendSuccess(res, { attempt }, 201);
});

export const getAttemptById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw ApiError.unauthorized('Authentication required', 'UNAUTHORIZED');
  }

  const attempt = await attemptsService.getAttemptById(req.params.id, req.user.id);
  sendSuccess(res, { attempt });
});

export const saveAnswers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw ApiError.unauthorized('Authentication required', 'UNAUTHORIZED');
  }

  const result = await attemptsService.saveAnswers(req.params.id, req.body, req.user.id);
  sendSuccess(res, result);
});

export const submitAttempt = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw ApiError.unauthorized('Authentication required', 'UNAUTHORIZED');
  }

  const result = await attemptsService.submitAttempt(req.params.id, req.user.id);
  sendSuccess(res, result);
});

export const listMyAttempts = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw ApiError.unauthorized('Authentication required', 'UNAUTHORIZED');
  }

  const result = await attemptsService.listMyAttempts(req.query as any, req.user.id);
  sendSuccess(res, result);
});

