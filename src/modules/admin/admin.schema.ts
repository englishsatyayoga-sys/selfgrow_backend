import { z } from 'zod';
import { paginationQuerySchema } from '../../utils/pagination';

export const listUsersQuerySchema = z.object({
  query: paginationQuerySchema.extend({
    search: z.string().trim().optional(),
    role: z.enum(['USER', 'ADMIN']).optional(),
    isActive: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  }),
});

export const userIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid user ID'),
  }),
});

export const updateUserStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid user ID'),
  }),
  body: z.object({
    isActive: z.boolean({ required_error: 'isActive boolean flag is required' }),
  }),
});

export const listOrdersQuerySchema = z.object({
  query: paginationQuerySchema.extend({
    status: z.enum(['CREATED', 'PAID', 'FAILED', 'REFUNDED']).optional(),
    productId: z.string().uuid().optional(),
    search: z.string().trim().optional(),
    from: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
    to: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  }),
});

export const exportOrdersQuerySchema = z.object({
  query: z.object({
    status: z.enum(['CREATED', 'PAID', 'FAILED', 'REFUNDED']).optional(),
    productId: z.string().uuid().optional(),
    search: z.string().trim().optional(),
    from: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
    to: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  }),
});

export const orderIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid order ID'),
  }),
});

export const listAttemptsQuerySchema = z.object({
  query: paginationQuerySchema.extend({
    status: z.enum(['IN_PROGRESS', 'SUBMITTED', 'EXPIRED']).optional(),
    assessmentId: z.string().uuid().optional(),
    productId: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),
  }),
});

export const attemptIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid attempt ID'),
  }),
});

export const dashboardSummaryQuerySchema = z.object({
  query: z.object({
    from: z.string().optional(),
    to: z.string().optional(),
  }),
});

export const listAuditLogsQuerySchema = z.object({
  query: paginationQuerySchema.extend({
    actorId: z.string().uuid().optional(),
    entityType: z.string().trim().optional(),
    action: z.string().trim().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
  }),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>['query'];
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>['body'];
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>['query'];
export type ExportOrdersQuery = z.infer<typeof exportOrdersQuerySchema>['query'];
export type ListAttemptsQuery = z.infer<typeof listAttemptsQuerySchema>['query'];
export type DashboardSummaryQuery = z.infer<typeof dashboardSummaryQuerySchema>['query'];
export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>['query'];

