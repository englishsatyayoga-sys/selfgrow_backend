import { z } from 'zod';
import { paginationQuerySchema } from '../../utils/pagination';

export const createOrderSchema = z.object({
  body: z.object({
    attemptId: z.string().min(1, 'Attempt ID is required'),
  }),
});

export const verifyPaymentSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Order ID is required'),
  }),
  body: z.object({
    razorpay_payment_id: z.string().min(1, 'razorpay_payment_id is required'),
    razorpay_signature: z.string().min(1, 'razorpay_signature is required'),
  }),
});

export const orderIdParamSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Order ID is required'),
  }),
});

export const listMyOrdersQuerySchema = z.object({
  query: paginationQuerySchema,
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>['body'];
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>['body'];
export type ListMyOrdersQuery = z.infer<typeof listMyOrdersQuerySchema>['query'];

