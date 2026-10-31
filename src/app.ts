import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { db } from './config/db';
import { requestId } from './middlewares/requestId';
import { csrfProtection } from './middlewares/csrfProtection';
import { generalLimiter } from './middlewares/rateLimiter';
import { errorHandler } from './middlewares/errorHandler';
import { ApiError } from './utils/ApiError';
import { sendSuccess, sendError } from './utils/apiResponse';
import { authRoutes } from './modules/auth/auth.routes';
import { usersRoutes } from './modules/users/users.routes';
import { productsRoutes, adminProductsRoutes } from './modules/products/products.routes';
import { assessmentsRoutes } from './modules/assessments/assessments.routes';
import {
  assessmentQuestionsRoutes,
  questionsRoutes,
} from './modules/questions/questions.routes';
import { attemptsRoutes } from './modules/attempts/attempts.routes';
import { ordersRoutes } from './modules/orders/orders.routes';
import { handleRazorpayWebhook } from './modules/webhooks/webhooks.controller';
import { handleStorageDownload } from './modules/storage/storage.controller';
import { reportsRoutes, adminReportsRoutes } from './modules/reports/reports.routes';
import { reportTemplatesRoutes } from './modules/report-templates/report-templates.routes';
import { adminRoutes } from './modules/admin/admin.routes';
import swaggerUi from 'swagger-ui-express';
import { openApiSpec } from './docs/openapi';

const app: Express = express();

// Assign Request ID to every request
app.use(requestId);

// Security HTTP headers
app.use(
  helmet({
    contentSecurityPolicy: false, // CSP is strictly enforced on frontend and reverse proxy
    crossOriginEmbedderPolicy: false,
  })
);

// CORS configuration
const allowedOrigins = env.CORS_ORIGIN.split(',').map((origin) => origin.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl or server-to-server)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('CORS request blocked by security policy'));
      }
    },
    credentials: true,
  })
);

// 1. Webhook Route with express.raw mounted BEFORE express.json()
app.post(
  '/api/v1/webhooks/razorpay',
  express.raw({ type: 'application/json' }),
  handleRazorpayWebhook
);

// 2. Body parser with 10kb limit for all other routes
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Cookie parser
app.use(cookieParser());

// CSRF protection for cookie-authenticated state mutations
app.use(csrfProtection);

// Global rate limiting for API routes
app.use('/api/v1', generalLimiter);

// Liveness health check endpoint
app.get('/api/v1/health', (_req: Request, res: Response) => {
  sendSuccess(res, {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: env.NODE_ENV,
  });
});

// Readiness probe (verifies database connectivity)
app.get('/api/v1/ready', async (_req: Request, res: Response) => {
  try {
    await db.$queryRaw`SELECT 1`;
    sendSuccess(res, {
      status: 'ready',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    sendError(res, 503, 'SERVICE_UNAVAILABLE', 'Database connection not ready');
  }
});

// OpenAPI / Swagger Documentation (disabled in production)
if (env.NODE_ENV !== 'production') {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
  app.get('/api/docs.json', (_req: Request, res: Response) => {
    res.json(openApiSpec);
  });
}

// Public Modular Routes
app.get('/api/v1/storage/download', handleStorageDownload);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/products', productsRoutes);
app.use('/api/v1/attempts', attemptsRoutes);
app.use('/api/v1/orders', ordersRoutes);
app.use('/api/v1/reports', reportsRoutes);

// Admin Routes (Under /api/v1/admin)
app.use('/api/v1/admin/assessments/:assessmentId/questions', assessmentQuestionsRoutes);
app.use('/api/v1/admin/assessments', assessmentsRoutes);
app.use('/api/v1/admin/questions', questionsRoutes);
app.use('/api/v1/admin/products', adminProductsRoutes);
app.use('/api/v1/admin/reports', adminReportsRoutes);
app.use('/api/v1/admin/report-templates', reportTemplatesRoutes);
app.use('/api/v1/admin', adminRoutes);

// 404 Route Handler
app.use((_req: Request, _res: Response, next: NextFunction) => {
  next(ApiError.notFound('The requested endpoint was not found', 'ROUTE_NOT_FOUND'));
});

// Central Error Handler (must be last)
app.use(errorHandler);

export default app;
