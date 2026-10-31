import { Router } from 'express';
import {
  createQuestion,
  updateQuestion,
  reorderQuestions,
  deactivateQuestion,
} from './questions.controller';
import {
  createQuestionSchema,
  updateQuestionSchema,
  reorderQuestionsSchema,
  questionIdParamSchema,
} from './questions.schema';
import { validate } from '../../middlewares/validate';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { Role } from '@prisma/client';

// Router for routes under /api/v1/admin/assessments/:assessmentId/questions
const assessmentQuestionsRouter = Router({ mergeParams: true });
assessmentQuestionsRouter.use(authenticate, authorize(Role.ADMIN));
assessmentQuestionsRouter.post('/', validate(createQuestionSchema), createQuestion);
assessmentQuestionsRouter.patch('/reorder', validate(reorderQuestionsSchema), reorderQuestions);

// Router for routes under /api/v1/admin/questions
const individualQuestionsRouter = Router();
individualQuestionsRouter.use(authenticate, authorize(Role.ADMIN));
individualQuestionsRouter.patch('/:id', validate(updateQuestionSchema), updateQuestion);
individualQuestionsRouter.patch('/:id/deactivate', validate(questionIdParamSchema), deactivateQuestion);

export const assessmentQuestionsRoutes = assessmentQuestionsRouter;
export const questionsRoutes = individualQuestionsRouter;
