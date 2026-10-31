import { Request, Response } from 'express';
import { usersService } from './users.service';
import { sendSuccess } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';

export const getAllUsers = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const users = await usersService.getAllUsers();
  sendSuccess(res, { users });
});

export const getUserById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw ApiError.unauthorized('Authentication required', 'UNAUTHORIZED');
  }

  const user = await usersService.getUserById(req.params.id, req.user);
  sendSuccess(res, { user });
});

export const exportMyData = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw ApiError.unauthorized('Authentication required', 'UNAUTHORIZED');
  }

  const exportData = await usersService.exportUserData(req.user.id);
  sendSuccess(res, exportData);
});

export const anonymizeMyAccount = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw ApiError.unauthorized('Authentication required', 'UNAUTHORIZED');
  }

  const result = await usersService.anonymizeUser(
    req.user.id,
    req.user,
    req.body?.reason
  );

  // Clear auth cookies upon anonymization
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie('accessToken', { httpOnly: true, secure: isProduction, sameSite: 'lax', path: '/' });
  res.clearCookie('refreshToken', { httpOnly: true, secure: isProduction, sameSite: 'lax', path: '/' });

  sendSuccess(res, result);
});

