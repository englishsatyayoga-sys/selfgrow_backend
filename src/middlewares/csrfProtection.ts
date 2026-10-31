import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { isAllowedOrigin } from '../utils/origin';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Origin-based CSRF protection for cookie-authenticated state-changing requests.
 * Evaluates Origin / Referer against trusted CORS allowlist when ambient cookies are present.
 */
export function csrfProtection(req: Request, _res: Response, next: NextFunction): void {
  // 1. Safe methods bypass CSRF checks
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  // 2. Webhooks bypass CSRF (authenticated via cryptographic HMAC signatures)
  if (req.path.startsWith('/api/v1/webhooks')) {
    return next();
  }

  // 3. Only requests relying on ambient cookies need CSRF mitigation
  const hasAuthCookies = Boolean(
    req.cookies?.accessToken ||
    req.cookies?.refreshToken ||
    req.cookies?.refresh_token
  );

  if (!hasAuthCookies) {
    return next();
  }

  // 4. Verify Origin header
  const originHeader = req.headers.origin;
  if (originHeader) {
    if (isAllowedOrigin(originHeader)) {
      return next();
    }
    return next(
      ApiError.forbidden(
        'Cross-Site Request Forgery blocked: untrusted origin',
        'CSRF_ORIGIN_INVALID'
      )
    );
  }

  // 5. Fallback to Referer header if Origin is omitted
  const refererHeader = req.headers.referer;
  if (refererHeader) {
    try {
      const refererUrl = new URL(refererHeader);
      const refererOrigin = `${refererUrl.protocol}//${refererUrl.host}`.toLowerCase();
      if (isAllowedOrigin(refererOrigin)) {
        return next();
      }
    } catch {
      // Malformed referer falls through to error
    }
    return next(
      ApiError.forbidden(
        'Cross-Site Request Forgery blocked: untrusted referer',
        'CSRF_REFERER_INVALID'
      )
    );
  }

  // If both Origin and Referer are absent for a cookie-bearing state mutation in production/strict mode
  if (env.NODE_ENV === 'production') {
    return next(
      ApiError.forbidden(
        'Cross-Site Request Forgery blocked: missing origin headers',
        'CSRF_MISSING_ORIGIN'
      )
    );
  }

  return next();
}

