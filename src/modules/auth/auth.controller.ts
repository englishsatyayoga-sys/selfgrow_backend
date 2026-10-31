import { Request, Response } from 'express';
import { authService, ACCESS_TOKEN_EXPIRY_MS, REFRESH_TOKEN_EXPIRY_MS } from './auth.service';
import { sendSuccess } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { env } from '../../config/env';
import { ApiError } from '../../utils/ApiError';

const setAuthCookies = (res: Response, accessToken: string, refreshToken: string): void => {
  const isProduction = env.NODE_ENV === 'production';
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: ACCESS_TOKEN_EXPIRY_MS,
    path: '/',
  });
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: REFRESH_TOKEN_EXPIRY_MS,
    path: '/',
  });
};

const clearAuthCookies = (res: Response): void => {
  const isProduction = env.NODE_ENV === 'production';
  res.clearCookie('accessToken', {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
  });
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
  });
};

export const register = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const metadata = {
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.socket.remoteAddress,
  };

  const { user, tokens } = await authService.register(req.body, metadata);
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
  sendSuccess(res, { user }, 201);
});

export const login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const metadata = {
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.socket.remoteAddress,
  };

  const { user, tokens } = await authService.login(req.body, metadata);
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
  sendSuccess(res, { user });
});

export const refresh = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const rawRefreshToken = req.cookies?.refreshToken || req.cookies?.refresh_token;

  if (!rawRefreshToken) {
    throw ApiError.unauthorized('Refresh token is missing', 'UNAUTHORIZED');
  }

  const metadata = {
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.socket.remoteAddress,
  };

  const tokens = await authService.refresh(rawRefreshToken, metadata);
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
  sendSuccess(res, { message: 'Token rotated successfully' });
});

export const logout = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const rawRefreshToken = req.cookies?.refreshToken || req.cookies?.refresh_token;

  try {
    await authService.logout(rawRefreshToken);
  } catch {
    // Suppress db revocation errors during logout
  } finally {
    clearAuthCookies(res);
  }

  sendSuccess(res, { message: 'Logged out successfully' });
});

export const getMe = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw ApiError.unauthorized('Authentication required', 'UNAUTHORIZED');
  }

  const user = await authService.getCurrentUser(req.user.id);
  sendSuccess(res, { user });
});

