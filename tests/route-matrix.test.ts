import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { openApiSpec } from '../src/docs/openapi';
import {
  resetMockDb,
  mockDb,
} from './setup';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env';

describe('Security Hardening: OpenAPI Authorization Route Matrix Test', () => {
  let adminUser: any;
  let userA: any;
  let userB: any;
  let adminToken: string;
  let userAToken: string;
  let userBToken: string;

  let userAAttempt: any;
  let userAOrder: any;
  let userAReport: any;

  beforeEach(async () => {
    resetMockDb();

    adminUser = await mockDb.user.create({
      data: {
        name: 'Matrix Admin',
        email: 'admin@matrix.local',
        passwordHash: 'hash',
        role: 'ADMIN',
        preferredLanguage: 'EN',
      },
    });

    userA = await mockDb.user.create({
      data: {
        name: 'Candidate A',
        email: 'userA@matrix.local',
        passwordHash: 'hash',
        role: 'USER',
        preferredLanguage: 'EN',
      },
    });

    userB = await mockDb.user.create({
      data: {
        name: 'Candidate B',
        email: 'userB@matrix.local',
        passwordHash: 'hash',
        role: 'USER',
        preferredLanguage: 'EN',
      },
    });

    adminToken = jwt.sign(
      { sub: adminUser.id, email: adminUser.email, role: 'ADMIN' },
      env.JWT_ACCESS_SECRET
    );

    userAToken = jwt.sign(
      { sub: userA.id, email: userA.email, role: 'USER' },
      env.JWT_ACCESS_SECRET
    );

    userBToken = jwt.sign(
      { sub: userB.id, email: userB.email, role: 'USER' },
      env.JWT_ACCESS_SECRET
    );

    // Create an assessment & product for User A
    const assessment = await mockDb.assessment.create({
      data: {
        slug: 'test-matrix-assessment',
        title: { en: 'Matrix Test' },
        description: { en: 'Desc' },
        timeLimitSeconds: 1800,
      },
    });

    const product = await mockDb.product.create({
      data: {
        slug: 'matrix-product',
        name: { en: 'Matrix Product' },
        description: { en: 'Desc' },
        priceInPaise: 49900,
        assessmentId: assessment.id,
        reportTemplateId: 'tmpl_1',
      },
    });

    userAAttempt = await mockDb.attempt.create({
      data: {
        userId: userA.id,
        productId: product.id,
        assessmentId: assessment.id,
        language: 'EN',
        status: 'SUBMITTED',
      },
    });

    userAOrder = await mockDb.order.create({
      data: {
        userId: userA.id,
        productId: product.id,
        attemptId: userAAttempt.id,
        amountInPaise: 49900,
        currency: 'INR',
        status: 'PAID',
      },
    });

    userAReport = await mockDb.report.create({
      data: {
        orderId: userAOrder.id,
        status: 'RELEASED',
        content: { summary: 'Candidate A evaluation' },
      },
    });
  });

  const allPaths = Object.keys(openApiSpec.paths);

  // Group paths
  const adminPaths = allPaths.filter((p) => p.startsWith('/admin'));
  const publicPaths = [
    '/health',
    '/products',
    '/products/{slug}',
    '/auth/register',
    '/auth/login',
    '/auth/refresh',
    '/auth/logout',
    '/storage/download',
  ];
  const protectedUserPaths = allPaths.filter(
    (p) => !adminPaths.includes(p) && !publicPaths.includes(p)
  );

  describe('1. Admin Routes Protection Matrix', () => {
    adminPaths.forEach((path) => {
      it(`proves Anonymous=401 and Regular User=403 on admin route: ${path}`, async () => {
        const testUrl = `/api/v1${path.replace(/\{id\}/g, 'some-id')}`;

        // 1. Anonymous Request -> 401
        const anonRes = await request(app).get(testUrl);
        expect(anonRes.status).toBe(401);

        // 2. Regular User Request -> 403 Forbidden
        const userRes = await request(app)
          .get(testUrl)
          .set('Authorization', `Bearer ${userAToken}`);
        expect(userRes.status).toBe(403);

        // 3. Admin Request -> Not 401 and not 403
        const adminRes = await request(app)
          .get(testUrl)
          .set('Authorization', `Bearer ${adminToken}`);
        expect(adminRes.status).not.toBe(401);
        expect(adminRes.status).not.toBe(403);
      });
    });
  });

  describe('2. Protected Candidate Routes Matrix', () => {
    protectedUserPaths.forEach((path) => {
      it(`proves Anonymous=401 on protected candidate route: ${path}`, async () => {
        const testUrl = `/api/v1${path.replace(/\{id\}/g, userAAttempt.id)}`;
        const specPath = openApiSpec.paths[path as keyof typeof openApiSpec.paths] as any;
        const method = specPath?.post ? 'post' : specPath?.patch ? 'patch' : 'get';

        const reqBuilder = (request(app) as any)[method](testUrl);
        const anonRes = await reqBuilder;
        expect(anonRes.status).toBe(401);
      });
    });
  });

  describe('3. Cross-User Isolation Matrix (Data Leakage & ID Enumeration Prevention)', () => {
    it('proves User B receives 404 when attempting to access User A attempt', async () => {
      const res = await request(app)
        .get(`/api/v1/attempts/${userAAttempt.id}`)
        .set('Authorization', `Bearer ${userBToken}`);
      expect(res.status).toBe(404);
      expect(res.body.error?.code).toBe('ATTEMPT_NOT_FOUND');
    });

    it('proves User B receives 404 when attempting to access User A order', async () => {
      const res = await request(app)
        .get(`/api/v1/orders/${userAOrder.id}`)
        .set('Authorization', `Bearer ${userBToken}`);
      expect(res.status).toBe(404);
      expect(res.body.error?.code).toBe('ORDER_NOT_FOUND');
    });

    it('proves User B receives 404 when attempting to access User A report', async () => {
      const res = await request(app)
        .get(`/api/v1/reports/${userAReport.id}`)
        .set('Authorization', `Bearer ${userBToken}`);
      expect(res.status).toBe(404);
      expect(res.body.error?.code).toBe('REPORT_NOT_FOUND');
    });

    it('proves User B receives 403 when attempting to access User A user record', async () => {
      const res = await request(app)
        .get(`/api/v1/users/${userA.id}`)
        .set('Authorization', `Bearer ${userBToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('4. DPDP Candidate Data Rights', () => {
    it('allows candidate to export their own personal data with timestamp', async () => {
      const res = await request(app)
        .get('/api/v1/users/me/export')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.profile.email.toLowerCase()).toBe('usera@matrix.local');
      expect(res.body.data.exportedAt).toBeDefined();
      expect(res.body.data.assessmentAttempts).toBeDefined();
    });

    it('anonymizes candidate personal data while preserving order accounting records', async () => {
      const res = await request(app)
        .post('/api/v1/users/me/anonymize')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          confirmation: true,
          reason: 'Exercising DPDP right to be forgotten',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify user record in DB is anonymized
      const updatedUser = await mockDb.user.findUnique({ where: { id: userA.id } });
      expect(updatedUser.name).toBe('Anonymized User');
      expect(updatedUser.email).toContain('@anonymized.local');
      expect(updatedUser.isActive).toBe(false);

      // Verify orders remain preserved
      const orders = await mockDb.order.findMany({ where: { userId: userA.id } });
      expect(orders.length).toBeGreaterThan(0);
    });
  });
});
