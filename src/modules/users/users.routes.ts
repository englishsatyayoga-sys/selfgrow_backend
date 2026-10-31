import { Router } from 'express';
import { getAllUsers, getUserById, exportMyData, anonymizeMyAccount } from './users.controller';
import { getUserByIdSchema, anonymizeUserSchema } from './users.schema';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { Role } from '@prisma/client';

const router = Router();

// Candidate DPDP privacy endpoints
router.get('/me/export', authenticate, exportMyData);
router.post('/me/anonymize', authenticate, validate(anonymizeUserSchema), anonymizeMyAccount);

router.get('/', authenticate, authorize(Role.ADMIN), getAllUsers);
router.get('/:id', authenticate, validate(getUserByIdSchema), getUserById);

export const usersRoutes = router;

