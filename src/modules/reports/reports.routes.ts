import { Router } from 'express';
import {
  listMyReports,
  getReportById,
  regenerateReport,
  releaseReport,
  downloadReport,
  adminListReports,
  adminGetReport,
  adminUpdateContent,
  adminRejectReport,
} from './reports.controller';
import {
  reportIdParamSchema,
  listMyReportsQuerySchema,
  regenerateReportSchema,
  adminListReportsQuerySchema,
  updateReportContentSchema,
  rejectReportSchema,
} from './reports.schema';
import { validate } from '../../middlewares/validate';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { Role } from '@prisma/client';

// User Router (/api/v1/reports)
const userRouter = Router();
userRouter.use(authenticate);
userRouter.get('/', validate(listMyReportsQuerySchema), listMyReports);
userRouter.get('/:id/download', validate(reportIdParamSchema), downloadReport);
userRouter.get('/:id', validate(reportIdParamSchema), getReportById);

// Admin Router (/api/v1/admin/reports)
const adminRouter = Router();
adminRouter.use(authenticate, authorize(Role.ADMIN));
adminRouter.get('/', validate(adminListReportsQuerySchema), adminListReports);
adminRouter.get('/:id', validate(reportIdParamSchema), adminGetReport);
adminRouter.patch('/:id/content', validate(updateReportContentSchema), adminUpdateContent);
adminRouter.post('/:id/regenerate', validate(regenerateReportSchema), regenerateReport);
adminRouter.post('/:id/release', validate(reportIdParamSchema), releaseReport);
adminRouter.post('/:id/reject', validate(rejectReportSchema), adminRejectReport);

export const reportsRoutes = userRouter;
export const adminReportsRoutes = adminRouter;

