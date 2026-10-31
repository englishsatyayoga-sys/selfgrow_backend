import { env } from '../config/env';

/**
 * Validates whether an incoming HTTP Origin or Referer is permitted by CORS / CSRF policies.
 * Automatically permits:
 * 1. Any explicitly configured origins in CORS_ORIGIN or APP_PUBLIC_URL (comma-delimited)
 * 2. Wildcard '*'
 * 3. Localhost development environments (http://localhost:* and http://127.0.0.1:*)
 * 4. Any Vercel deployment domain (*.vercel.app)
 */
export function isAllowedOrigin(origin: string | undefined | null): boolean {
  if (!origin) return true;

  const originClean = origin.trim().toLowerCase();
  const configuredOrigins = [
    ...env.CORS_ORIGIN.split(',').map((o) => o.trim().toLowerCase()),
    env.APP_PUBLIC_URL ? env.APP_PUBLIC_URL.trim().toLowerCase() : '',
  ].filter(Boolean);

  // Allow wildcard
  if (configuredOrigins.includes('*') || configuredOrigins.includes('all')) {
    return true;
  }

  // Match configured origins
  if (configuredOrigins.includes(originClean)) {
    return true;
  }

  // Allow localhost / local loopback ports
  if (
    originClean.startsWith('http://localhost') ||
    originClean.startsWith('http://127.0.0.1')
  ) {
    return true;
  }

  // Allow any Vercel preview or production deployment (*.vercel.app)
  try {
    const url = new URL(originClean);
    if (url.hostname.endsWith('.vercel.app') || url.hostname === 'vercel.app') {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}
