import { Router } from 'express';
import {
  listAssessments,
  getAssessmentById,
  createAssessment,
  updateAssessment,
  toggleAssessmentActive,
} from './assessments.controller';
import {
  createAssessmentSchema,
  updateAssessmentSchema,
  getAssessmentParamsSchema,
  listAssessmentsQuerySchema,
} from './assessments.schema';
import { validate } from '../../middlewares/validate';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { Role } from '@prisma/client';

const router = Router();

// Admin-only middleware applied to all assessment management routes
router.use(authenticate, authorize(Role.ADMIN));

router.get('/', validate(listAssessmentsQuerySchema), listAssessments);
router.get('/:id', validate(getAssessmentParamsSchema), getAssessmentById);
router.post('/', validate(createAssessmentSchema), createAssessment);
router.patch('/:id', validate(updateAssessmentSchema), updateAssessment);
router.patch('/:id/toggle-active', validate(getAssessmentParamsSchema), toggleAssessmentActive);

export const assessmentsRoutes = router;

