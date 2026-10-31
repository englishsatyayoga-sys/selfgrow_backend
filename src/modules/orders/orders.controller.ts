import { Request, Response } from 'express';
import { ordersService } from './orders.service';
import { sendSuccess } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';

export const createOrder = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw ApiError.unauthorized('Authentication required', 'UNAUTHORIZED');
  }

  const result = await ordersService.createOrder(req.body, req.user.id);
  sendSuccess(res, result, 201);
});

export const verifyPayment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw ApiError.unauthorized('Authentication required', 'UNAUTHORIZED');
  }

  const result = await ordersService.verifyPayment(req.params.id, req.body, req.user.id);
  sendSuccess(res, result);
});

export const listMyOrders = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw ApiError.unauthorized('Authentication required', 'UNAUTHORIZED');
  }

  const result = await ordersService.listMyOrders(req.query as any, req.user.id);
  sendSuccess(res, result);
});

export const getOrderById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw ApiError.unauthorized('Authentication required', 'UNAUTHORIZED');
  }

  const order = await ordersService.getOrderById(req.params.id, req.user.id);
  sendSuccess(res, { order });
});

