import { Router } from 'express';
import { register, login, refresh, logout, getMe } from './auth.controller';
import { registerSchema, loginSchema, refreshSchema } from './auth.schema';
import { validate } from '../../middlewares/validate';
import { authenticate } from '../../middlewares/authenticate';
import { authLimiter } from '../../middlewares/rateLimiter';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/refresh', authLimiter, validate(refreshSchema), refresh);
router.post('/logout', logout);
router.get('/me', authenticate, getMe);

export const authRoutes = router;

