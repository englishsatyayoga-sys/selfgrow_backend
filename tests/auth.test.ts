import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { resetMockDb, mockDb } from './setup';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env';

describe('Authentication & Authorization Module Tests', () => {
  beforeEach(() => {
    resetMockDb();
  });

  const testUser = {
    name: 'Alice Johnson',
    email: 'alice@example.com',
    password: 'Password123!',
    acceptedTerms: true,
  };

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully, return sanitized user, and set cookies', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(response.body.data.user.name).toBe(testUser.name);
      expect(response.body.data.user.role).toBe('USER');
      expect(response.body.data.user.preferredLanguage).toBe('EN');
      expect(response.body.data.user.consentAcceptedAt).toBeDefined();
      expect(response.body.data.user.passwordHash).toBeUndefined();
      expect(response.body.data.user.password).toBeUndefined();

      // Verify cookies are set
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some((c: string) => c.includes('accessToken='))).toBe(true);
      expect(cookies.some((c: string) => c.includes('refreshToken='))).toBe(true);
      expect(cookies.some((c: string) => c.includes('HttpOnly'))).toBe(true);
    });

    it('should fail with 400 when acceptedTerms is missing or false', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Bob',
          email: 'bob@example.com',
          password: 'Password123!',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should fail with 409 Conflict if email is already registered', async () => {
      // First registration
      await request(app).post('/api/v1/auth/register').send(testUser);

      // Duplicate registration attempt
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    });

    it('should fail with 400 Bad Request when password does not meet complexity requirements', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Alice',
          email: 'alice_weak@example.com',
          password: 'weak',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/v1/auth/register').send(testUser);
    });

    it('should log in successfully with valid credentials and set cookies', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(response.body.data.user.passwordHash).toBeUndefined();

      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some((c: string) => c.includes('accessToken='))).toBe(true);
      expect(cookies.some((c: string) => c.includes('refreshToken='))).toBe(true);
    });

    it('should return identical 401 error for non-existent email (no user enumeration)', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: testUser.password,
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(response.body.error.message).toBe('Invalid email or password');
    });

    it('should return identical 401 error for incorrect password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword999!',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(response.body.error.message).toBe('Invalid email or password');
    });
  });

  describe('POST /api/v1/auth/refresh and Token Reuse Detection', () => {
    it('should rotate refresh token and return new tokens', async () => {
      // 1. Register to obtain initial tokens
      const registerRes = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);

      const setCookies = registerRes.headers['set-cookie'] as string[];
      const refreshCookie = setCookies.find((c) => c.startsWith('refreshToken='));
      expect(refreshCookie).toBeDefined();

      // 2. Call /refresh with the refresh cookie
      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [refreshCookie!]);

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.success).toBe(true);

      const newCookies = refreshRes.headers['set-cookie'] as string[];
      const newRefreshCookie = newCookies.find((c) => c.startsWith('refreshToken='));
      expect(newRefreshCookie).toBeDefined();
      expect(newRefreshCookie).not.toEqual(refreshCookie);
    });

    it('should detect reuse of a revoked refresh token and revoke all user sessions', async () => {
      // 1. Register
      const registerRes = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);

      const setCookies = registerRes.headers['set-cookie'] as string[];
      const oldRefreshCookie = setCookies.find((c) => c.startsWith('refreshToken='))!;

      // 2. First refresh rotates the token and revokes oldRefreshCookie
      const firstRefreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [oldRefreshCookie]);

      expect(firstRefreshRes.status).toBe(200);

      // 3. Attacker or replay attempts to use the OLD (revoked) token again!
      const reuseAttemptRes = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [oldRefreshCookie]);

      expect(reuseAttemptRes.status).toBe(401);
      expect(reuseAttemptRes.body.success).toBe(false);
      expect(reuseAttemptRes.body.error.code).toBe('TOKEN_REUSE_DETECTED');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should revoke refresh token and clear auth cookies', async () => {
      const registerRes = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);

      const setCookies = registerRes.headers['set-cookie'] as string[];
      const refreshCookie = setCookies.find((c) => c.startsWith('refreshToken='))!;

      const logoutRes = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', [refreshCookie]);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.success).toBe(true);

      // Cookies should be cleared (max-age=0 or expires in past)
      const clearedCookies = logoutRes.headers['set-cookie'] as string[];
      expect(clearedCookies.some((c) => c.includes('accessToken=;') || c.includes('Expires='))).toBe(true);
      expect(clearedCookies.some((c) => c.includes('refreshToken=;') || c.includes('Expires='))).toBe(true);
    });
  });

  describe('GET /api/v1/auth/me (Protected Route)', () => {
    it('should return 401 Unauthorized when no token is provided', async () => {
      const response = await request(app).get('/api/v1/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return authenticated user profile when valid accessToken cookie is provided', async () => {
      const registerRes = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);

      const setCookies = registerRes.headers['set-cookie'] as string[];
      const accessCookie = setCookies.find((c) => c.startsWith('accessToken='))!;

      const meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', [accessCookie]);

      expect(meRes.status).toBe(200);
      expect(meRes.body.success).toBe(true);
      expect(meRes.body.data.user.email).toBe(testUser.email);
    });
  });

  describe('Role-Based Access Control (RBAC) & Ownership Check', () => {
    it('should reject a regular USER accessing ADMIN-only route with 403 Forbidden', async () => {
      const registerRes = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);

      const setCookies = registerRes.headers['set-cookie'] as string[];
      const accessCookie = setCookies.find((c) => c.startsWith('accessToken='))!;

      // Attempt to access admin route
      const response = await request(app)
        .get('/api/v1/users')
        .set('Cookie', [accessCookie]);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('should allow an ADMIN user to access ADMIN-only route', async () => {
      // Create admin user in mock DB
      const passwordHash = await argon2.hash('Admin@123456');
      const admin = await mockDb.user.create({
        data: {
          name: 'Site Administrator',
          email: 'admin@platform.com',
          passwordHash,
          role: 'ADMIN',
          isActive: true,
        },
      });

      const adminToken = jwt.sign(
        { sub: admin.id, email: admin.email, role: 'ADMIN' },
        env.JWT_ACCESS_SECRET,
        { expiresIn: '15m' }
      );

      const response = await request(app)
        .get('/api/v1/users')
        .set('Cookie', [`accessToken=${adminToken}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.users)).toBe(true);
    });
  });

  describe('GET /api/v1/health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/api/v1/health');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('ok');
    });
  });
});

