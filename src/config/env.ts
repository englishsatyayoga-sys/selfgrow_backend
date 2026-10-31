import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  ADMIN_EMAIL: z.string().email().optional().default('admin@example.com'),
  ADMIN_PASSWORD: z.string().min(8).optional().default('Admin@123456'),
  RAZORPAY_KEY_ID: z.string().default('rzp_test_placeholder_key_id'),
  RAZORPAY_KEY_SECRET: z.string().default('rzp_test_placeholder_key_secret'),
  RAZORPAY_WEBHOOK_SECRET: z.string().default('rzp_test_placeholder_webhook_secret'),
  OPENAI_API_KEY: z.string().default('sk-placeholder-mock-openai-key'),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  AI_MAX_RETRIES: z.coerce.number().default(3),
  AI_TIMEOUT_MS: z.coerce.number().default(60000),
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().default('assessment-reports'),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  EMAIL_PROVIDER: z.enum(['resend', 'ses', 'smtp', 'console']).default('console'),
  EMAIL_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('no-reply@assessment.platform'),
  APP_PUBLIC_URL: z.string().url().default('http://localhost:3000'),
  SENTRY_DSN: z.string().optional(),
});

const parseEnv = () => {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const errors = parsed.error.format();
    console.error('Environment validation failed:', JSON.stringify(errors, null, 2));
    throw new Error('Invalid environment configuration. Check logs for details.');
  }

  return parsed.data;
};

export const env = parseEnv();
export type Env = z.infer<typeof envSchema>;
