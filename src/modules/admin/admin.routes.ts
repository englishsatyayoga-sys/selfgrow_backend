import { Router } from 'express';
import {
  listUsers,
  getUserDetail,
  updateUserStatus,
  listOrders,
  getOrderDetail,
  exportOrders,
  listAttempts,
  getAttemptDetail,
  getDashboardSummary,
  listAuditLogs,
  getSystemStatus,
} from './admin.controller';
import {
  listUsersQuerySchema,
  userIdParamSchema,
  updateUserStatusSchema,
  listOrdersQuerySchema,
  exportOrdersQuerySchema,
  orderIdParamSchema,
  listAttemptsQuerySchema,
  attemptIdParamSchema,
  dashboardSummaryQuerySchema,
  listAuditLogsQuerySchema,
} from './admin.schema';
import { validate } from '../../middlewares/validate';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { Role } from '@prisma/client';

const router = Router();

// Non-negotiable: all routes require authenticate + authorize(Role.ADMIN)
router.use(authenticate, authorize(Role.ADMIN));

// -------------------------------------------------------------
// 1. USERS
// -------------------------------------------------------------
router.get('/users', validate(listUsersQuerySchema), listUsers);
router.get('/users/:id', validate(userIdParamSchema), getUserDetail);
router.patch('/users/:id/status', validate(updateUserStatusSchema), updateUserStatus);

// -------------------------------------------------------------
// 2. ORDERS & PAYMENTS
// -------------------------------------------------------------
router.get('/orders', validate(listOrdersQuerySchema), listOrders);
router.get('/orders/export', validate(exportOrdersQuerySchema), exportOrders);
router.get('/orders/:id', validate(orderIdParamSchema), getOrderDetail);

// -------------------------------------------------------------
// 3. ATTEMPTS
// -------------------------------------------------------------
router.get('/attempts', validate(listAttemptsQuerySchema), listAttempts);
router.get('/attempts/:id', validate(attemptIdParamSchema), getAttemptDetail);

// -------------------------------------------------------------
// 4. DASHBOARD
// -------------------------------------------------------------
router.get('/dashboard/summary', validate(dashboardSummaryQuerySchema), getDashboardSummary);

// -------------------------------------------------------------
// 5. AUDIT LOGS
// -------------------------------------------------------------
router.get('/audit-logs', validate(listAuditLogsQuerySchema), listAuditLogs);

// -------------------------------------------------------------
// 6. HEALTH / SYSTEM STATUS
// -------------------------------------------------------------
router.get('/system/status', getSystemStatus);

export const adminRoutes = router;

