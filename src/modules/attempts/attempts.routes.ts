import { Router } from 'express';
import {
  startAttempt,
  getAttemptById,
  saveAnswers,
  submitAttempt,
  listMyAttempts,
} from './attempts.controller';
import {
  startAttemptSchema,
  saveAnswersSchema,
  attemptIdParamSchema,
  listMyAttemptsQuerySchema,
} from './attempts.schema';
import { validate } from '../../middlewares/validate';
import { authenticate } from '../../middlewares/authenticate';

const router = Router();

// All attempt routes require authenticated user
router.use(authenticate);

router.post('/', validate(startAttemptSchema), startAttempt);
router.get('/', validate(listMyAttemptsQuerySchema), listMyAttempts);
router.get('/:id', validate(attemptIdParamSchema), getAttemptById);
router.put('/:id/answers', validate(saveAnswersSchema), saveAnswers);
router.patch('/:id/answers', validate(saveAnswersSchema), saveAnswers);
router.patch('/:id/responses', validate(saveAnswersSchema), saveAnswers);
router.put('/:id/responses', validate(saveAnswersSchema), saveAnswers);
router.post('/:id/submit', validate(attemptIdParamSchema), submitAttempt);

export const attemptsRoutes = router;

