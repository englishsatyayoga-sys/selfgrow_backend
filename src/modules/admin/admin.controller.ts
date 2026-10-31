import { Request, Response } from 'express';
import { adminService } from './admin.service';
import { sendSuccess } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';

// -------------------------------------------------------------
// USERS
// -------------------------------------------------------------
export const listUsers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const result = await adminService.listUsers(req.query as any);
  sendSuccess(res, result);
});

export const getUserDetail = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = await adminService.getUserDetail(req.params.id);
  sendSuccess(res, { user });
});

export const updateUserStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw ApiError.unauthorized('Authentication required', 'UNAUTHORIZED');
  }

  const user = await adminService.updateUserStatus(
    req.params.id,
    req.body.isActive,
    req.user.id,
    req.ip
  );
  sendSuccess(res, { user });
});

// -------------------------------------------------------------
// ORDERS & PAYMENTS
// -------------------------------------------------------------
export const listOrders = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const result = await adminService.listOrders(req.query as any);
  sendSuccess(res, result);
});

export const getOrderDetail = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const order = await adminService.getOrderDetail(req.params.id);
  sendSuccess(res, { order });
});

export const exportOrders = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  await adminService.exportOrders(req.query as any, res);
});

// -------------------------------------------------------------
// ATTEMPTS
// -------------------------------------------------------------
export const listAttempts = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const result = await adminService.listAttempts(req.query as any);
  sendSuccess(res, result);
});

export const getAttemptDetail = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const attempt = await adminService.getAttemptDetail(req.params.id);
  sendSuccess(res, { attempt });
});

// -------------------------------------------------------------
// DASHBOARD
// -------------------------------------------------------------
export const getDashboardSummary = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const summary = await adminService.getDashboardSummary(
    req.query.from as string | undefined,
    req.query.to as string | undefined
  );
  sendSuccess(res, summary);
});

// -------------------------------------------------------------
// AUDIT LOGS
// -------------------------------------------------------------
export const listAuditLogs = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const result = await adminService.listAuditLogs(req.query as any);
  sendSuccess(res, result);
});

// -------------------------------------------------------------
// SYSTEM STATUS / HEALTH
// -------------------------------------------------------------
export const getSystemStatus = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const status = await adminService.getSystemStatus();
  sendSuccess(res, status);
});

