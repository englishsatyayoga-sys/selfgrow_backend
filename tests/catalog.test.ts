import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { resetMockDb, mockDb, mockAuditLogs, mockAssessments } from './setup';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env';

describe('Phase 2: Content Catalog, Admin CRUD, and Audit Logging', () => {
  let adminToken: string;
  let userToken: string;

  beforeEach(async () => {
    resetMockDb();

    // Create admin user
    const admin = await mockDb.user.create({
      data: {
        name: 'System Admin',
        email: 'admin@platform.com',
        role: 'ADMIN',
        passwordHash: 'dummy_hash',
      },
    });

    adminToken = jwt.sign(
      { sub: admin.id, email: admin.email, role: 'ADMIN' },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    // Create regular user
    const user = await mockDb.user.create({
      data: {
        name: 'Regular User',
        email: 'user@platform.com',
        role: 'USER',
        passwordHash: 'dummy_hash',
      },
    });

    userToken = jwt.sign(
      { sub: user.id, email: user.email, role: 'USER' },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );
  });

  describe('Admin-Only Access Control', () => {
    it('should reject unauthenticated request to admin assessments with 401', async () => {
      const response = await request(app).get('/api/v1/admin/assessments');
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject regular USER with 403 Forbidden', async () => {
      const response = await request(app)
        .get('/api/v1/admin/assessments')
        .set('Cookie', [`accessToken=${userToken}`]);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('should allow ADMIN to list assessments', async () => {
      const response = await request(app)
        .get('/api/v1/admin/assessments')
        .set('Cookie', [`accessToken=${adminToken}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.items)).toBe(true);
    });
  });

  describe('Assessment CRUD & Audit Logging', () => {
    it('should create an assessment and record audit log inside transaction', async () => {
      const payload = {
        slug: 'critical-thinking-index',
        title: { en: 'Critical Thinking Index', hi: 'महत्वपूर्ण सोच सूचकांक' },
        description: { en: 'Evaluates critical reasoning.', hi: 'महत्वपूर्ण तर्क का मूल्यांकन।' },
        kind: 'OBJECTIVE',
        timeLimitSeconds: 1200,
      };

      const response = await request(app)
        .post('/api/v1/admin/assessments')
        .set('Cookie', [`accessToken=${adminToken}`])
        .send(payload);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.assessment.slug).toBe(payload.slug);
      expect(response.body.data.assessment.version).toBe(1);

      // Verify AuditLog was recorded
      expect(mockAuditLogs.length).toBeGreaterThan(0);
      const audit = mockAuditLogs.find(
        (log) => log.action === 'CREATE_ASSESSMENT' && log.entityId === response.body.data.assessment.id
      );
      expect(audit).toBeDefined();
      expect(audit.entityType).toBe('Assessment');
    });
  });

  describe('Question Validation & Assessment Version Bump', () => {
    let assessmentId: string;

    beforeEach(async () => {
      const assessment = await mockDb.assessment.create({
        data: {
          slug: 'test-assessment',
          title: { en: 'Test Title' },
          description: { en: 'Test Desc' },
          kind: 'MIXED',
          version: 1,
          isActive: true,
        },
      });
      assessmentId = assessment.id;
    });

    it('should fail validation when SINGLE_CHOICE question has fewer than 2 options', async () => {
      const response = await request(app)
        .post(`/api/v1/admin/assessments/${assessmentId}/questions`)
        .set('Cookie', [`accessToken=${adminToken}`])
        .send({
          order: 1,
          type: 'SINGLE_CHOICE',
          text: { en: 'Incomplete question?' },
          options: [{ order: 1, label: { en: 'Only One Option' }, score: 1 }],
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('at least 2 options');
    });

    it('should fail validation when TEXT question contains options', async () => {
      const response = await request(app)
        .post(`/api/v1/admin/assessments/${assessmentId}/questions`)
        .set('Cookie', [`accessToken=${adminToken}`])
        .send({
          order: 1,
          type: 'TEXT',
          text: { en: 'Explain your reasoning' },
          options: [{ order: 1, label: { en: 'Option should not be here' } }],
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('TEXT questions must not have options');
    });

    it('should create valid question, bump assessment version, and log audit', async () => {
      const response = await request(app)
        .post(`/api/v1/admin/assessments/${assessmentId}/questions`)
        .set('Cookie', [`accessToken=${adminToken}`])
        .send({
          order: 1,
          type: 'SINGLE_CHOICE',
          text: { en: 'Proper question with options?', hi: 'उचित प्रश्न?' },
          options: [
            { order: 1, label: { en: 'Option A', hi: 'विकल्प ए' }, score: 5 },
            { order: 2, label: { en: 'Option B', hi: 'विकल्प बी' }, score: 0 },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.question.options.length).toBe(2);

      // Verify version bump
      const updatedAssessment = mockAssessments.get(assessmentId);
      expect(updatedAssessment.version).toBe(2);

      // Verify AuditLog
      const audit = mockAuditLogs.find((log) => log.action === 'CREATE_QUESTION');
      expect(audit).toBeDefined();
    });
  });

  describe('Public Products API: Security & Locale Fallback', () => {
    let testProduct: any;

    beforeEach(async () => {
      const assessment = await mockDb.assessment.create({
        data: {
          slug: 'eng-assessment',
          title: { en: 'Engineering Logic', hi: 'इंजीनियरिंग तर्क' },
          description: { en: 'Logic test', hi: 'तर्क परीक्षण' },
          kind: 'OBJECTIVE',
          version: 1,
          isActive: true,
        },
      });

      // Add a question with option score
      const q = await mockDb.question.create({
        data: {
          assessmentId: assessment.id,
          order: 1,
          type: 'SINGLE_CHOICE',
          text: { en: 'Q1' },
          dimension: 'Internal Scoring Dimension Secret',
          isActive: true,
        },
      });

      await mockDb.option.create({
        data: {
          questionId: q.id,
          order: 1,
          label: { en: 'Opt 1' },
          score: 10, // Must NEVER leak to public!
          isActive: true,
        },
      });

      testProduct = await mockDb.product.create({
        data: {
          slug: 'engineering-logic-pro',
          name: { en: 'Engineering Logic Pro', hi: 'इंजीनियरिंग तर्क प्रो' },
          description: { en: 'Master logic test in English' }, // Hindi omitted to test fallback!
          assessmentId: assessment.id,
          priceInPaise: 49900,
          currency: 'INR',
          autoRelease: true,
          isActive: true,
        },
      });
    });

    it('should NEVER leak internal scoring data or option scores in public product responses', async () => {
      const response = await request(app).get(`/api/v1/products/${testProduct.slug}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const product = response.body.data.product;
      expect(product.slug).toBe(testProduct.slug);
      expect(product.priceInPaise).toBe(49900); // Integer paise

      // Check DTO sanitization
      expect(product.score).toBeUndefined();
      expect(product.options).toBeUndefined();
      expect(product.questions).toBeUndefined();
      if (product.assessment) {
        expect(product.assessment.score).toBeUndefined();
        expect(product.assessment.dimension).toBeUndefined();
      }
    });

    it('should return Hindi text when requested, and seamlessly fallback to English when Hindi is missing', async () => {
      const response = await request(app).get(`/api/v1/products/${testProduct.slug}?lang=hi`);

      expect(response.status).toBe(200);
      const product = response.body.data.product;

      // Name had Hindi -> returns Hindi translation
      expect(product.name).toBe('इंजीनियरिंग तर्क प्रो');

      // Description had NO Hindi -> falls back to English smoothly
      expect(product.description).toBe('Master logic test in English');
    });
  });
});

