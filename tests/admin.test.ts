import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import {
  resetMockDb,
  mockDb,
  mockUsers,
  mockOrders,
  mockReports,
  mockAuditLogs,
  mockReportRevisions,
} from './setup';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env';

describe('Phase 7: Admin APIs & Management Suite', () => {
  let adminUser: any;
  let regularUser: any;
  let adminToken: string;
  let userToken: string;
  let assessment: any;
  let freeProduct: any;
  let paidProduct: any;
  let attempt: any;
  let paidOrder: any;
  let freeOrder: any;
  let reportPending: any;

  beforeEach(async () => {
    resetMockDb();

    // 1. Create Users
    adminUser = await mockDb.user.create({
      data: {
        name: 'Super Admin',
        email: 'superadmin@example.com',
        passwordHash: 'hash',
        role: 'ADMIN',
        preferredLanguage: 'EN',
      },
    });

    regularUser = await mockDb.user.create({
      data: {
        name: 'Regular Candidate',
        email: 'candidate@example.com',
        passwordHash: 'hash',
        role: 'USER',
        preferredLanguage: 'HI',
      },
    });

    adminToken = jwt.sign(
      { sub: adminUser.id, email: adminUser.email, role: 'ADMIN' },
      env.JWT_ACCESS_SECRET
    );

    userToken = jwt.sign(
      { sub: regularUser.id, email: regularUser.email, role: 'USER' },
      env.JWT_ACCESS_SECRET
    );

    // 2. Create Assessment & Products
    assessment = await mockDb.assessment.create({
      data: {
        slug: 'fullstack-eval',
        title: { en: 'Fullstack Engineering', hi: 'फुलस्टैक इंजीनियरिंग' },
        description: { en: 'Technical assessment' },
        kind: 'MIXED',
      },
    });

    freeProduct = await mockDb.product.create({
      data: {
        slug: 'free-eval-product',
        name: { en: 'Free Diagnostic', hi: 'मुफ्त निदान' },
        description: { en: 'Free report' },
        priceInPaise: 0,
        autoRelease: false,
        assessmentId: assessment.id,
      },
    });

    paidProduct = await mockDb.product.create({
      data: {
        slug: 'paid-eval-product',
        name: { en: 'Comprehensive Report', hi: 'विस्तृत रिपोर्ट' },
        description: { en: 'Paid report' },
        priceInPaise: 99900, // 999 INR
        autoRelease: false,
        assessmentId: assessment.id,
      },
    });

    // 3. Create Attempt & Responses
    attempt = await mockDb.attempt.create({
      data: {
        userId: regularUser.id,
        productId: paidProduct.id,
        assessmentId: assessment.id,
        language: 'HI',
        status: 'SUBMITTED',
        scoreSummary: {
          totalScore: 85,
          maxPossibleScore: 100,
          percentage: 85,
        },
        snapshot: {
          questions: [
            {
              id: 'q-101',
              order: 1,
              section: 'Core Architecture',
              type: 'SINGLE_CHOICE',
              text: { en: 'Choose primary db pattern', hi: 'मुख्य डेटाबेस पैटर्न चुनें' },
              options: [
                { id: 'opt-a', label: { en: 'Read Replicas', hi: 'रीड रेप्लिका' } },
                { id: 'opt-b', label: { en: 'Sharding', hi: 'शार्डिंग' } },
              ],
            },
          ],
        },
      },
    });

    await mockDb.response.upsert({
      where: { attemptId_questionId: { attemptId: attempt.id, questionId: 'q-101' } },
      create: {
        attemptId: attempt.id,
        questionId: 'q-101',
        selectedOptionIds: ['opt-a'],
        textAnswer: null,
      },
      update: {},
    });

    // 4. Create Orders & Payments
    paidOrder = await mockDb.order.create({
      data: {
        userId: regularUser.id,
        productId: paidProduct.id,
        attemptId: attempt.id,
        amountInPaise: 99900,
        status: 'PAID',
        razorpayOrderId: 'order_test_999',
      },
    });

    await mockDb.payment.upsert({
      where: { razorpayPaymentId: 'pay_test_001' },
      create: {
        orderId: paidOrder.id,
        razorpayPaymentId: 'pay_test_001',
        amountInPaise: 99900,
        status: 'captured',
      },
      update: {},
    });

    freeOrder = await mockDb.order.create({
      data: {
        userId: regularUser.id,
        productId: freeProduct.id,
        attemptId: 'attempt-free-dummy',
        amountInPaise: 0,
        status: 'PAID',
      },
    });

    // 5. Create Report for Review
    reportPending = await mockDb.report.create({
      data: {
        orderId: paidOrder.id,
        status: 'PENDING_REVIEW',
        language: 'HI',
        templateVersion: 1,
        content: {
          executiveSummary: 'Initial generated summary for candidate.',
          sections: [
            { title: 'Core Competency', content: 'Strong database foundations.' },
          ],
        },
      },
    });
  });

  // -------------------------------------------------------------
  // 1. RBAC SECURITY ON EVERY ROUTE
  // -------------------------------------------------------------
  describe('RBAC Security Tests', () => {
    const adminEndpoints = [
      { method: 'get', url: '/api/v1/admin/users' },
      { method: 'get', url: '/api/v1/admin/orders' },
      { method: 'get', url: '/api/v1/admin/attempts' },
      { method: 'get', url: '/api/v1/admin/reports' },
      { method: 'get', url: '/api/v1/admin/dashboard/summary' },
      { method: 'get', url: '/api/v1/admin/audit-logs' },
      { method: 'get', url: '/api/v1/admin/system/status' },
    ];

    it('rejects anonymous requests with 401 Unauthorized', async () => {
      for (const ep of adminEndpoints) {
        const res = await (request(app) as any)[ep.method](ep.url);
        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
      }
    });

    it('rejects non-admin (USER role) requests with 403 Forbidden', async () => {
      for (const ep of adminEndpoints) {
        const res = await (request(app) as any)[ep.method](ep.url)
          .set('Authorization', `Bearer ${userToken}`);
        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('FORBIDDEN');
      }
    });
  });

  // -------------------------------------------------------------
  // 2. USERS MANAGEMENT
  // -------------------------------------------------------------
  describe('Admin Users Management', () => {
    it('lists users with pagination and search filter', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users?search=Candidate')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].email).toBe('candidate@example.com');
      // Password hash must never leak in DTO
      expect(res.body.data.items[0].passwordHash).toBeUndefined();
    });

    it('fetches user detail with order & attempt history', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/users/${regularUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.id).toBe(regularUser.id);
      expect(res.body.data.user.orders).toBeDefined();
      expect(res.body.data.user.attempts).toBeDefined();
    });

    it('activates and deactivates a user and records an audit log', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${regularUser.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.isActive).toBe(false);

      const latestAudit = mockAuditLogs[mockAuditLogs.length - 1];
      expect(latestAudit.action).toBe('USER_DEACTIVATED');
      expect(latestAudit.entityId).toBe(regularUser.id);
      expect(latestAudit.actorId).toBe(adminUser.id);
    });

    it('blocks admin from deactivating their own account with 400', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${adminUser.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CANNOT_DEACTIVATE_SELF');
    });
  });

  // -------------------------------------------------------------
  // 3. ORDERS & CSV EXPORT
  // -------------------------------------------------------------
  describe('Admin Orders & CSV Export', () => {
    it('lists orders with filters', async () => {
      const res = await request(app)
        .get('/api/v1/admin/orders?status=PAID')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    });

    it('gets order detail including payments history', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/orders/${paidOrder.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.order.id).toBe(paidOrder.id);
      expect(res.body.data.order.payments.length).toBe(1);
    });

    it('exports orders as CSV with formula-injection cell sanitization', async () => {
      // Inject potentially malicious product name with formula injection chars
      await mockDb.product.create({
        data: {
          slug: 'dangerous-formula-product',
          name: { en: '=cmd|\'/C calc\'!A0', hi: '+9199999999' },
          description: { en: 'Test formula injection' },
          priceInPaise: 100,
          autoRelease: false,
          assessmentId: assessment.id,
        },
      });

      const res = await request(app)
        .get('/api/v1/admin/orders/export')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('orders-export.csv');

      const csvContent = res.text;
      expect(csvContent).toContain('Order ID,Date,User Name,User Email,Product');
      // Verify formula injection characters are escaped with leading single quote
      if (csvContent.includes('=cmd')) {
        expect(csvContent).toContain("'=cmd");
      }
    });
  });

  // -------------------------------------------------------------
  // 4. ATTEMPTS SUPPORT REVIEW
  // -------------------------------------------------------------
  describe('Admin Attempts Support Review', () => {
    it('fetches attempt detail with readable question and option labels in target language', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/attempts/${attempt.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.attempt.id).toBe(attempt.id);

      const readableResponses = res.body.data.attempt.responses;
      expect(readableResponses.length).toBe(1);
      expect(readableResponses[0].questionText).toBe('मुख्य डेटाबेस पैटर्न चुनें'); // Hindi translation
      expect(readableResponses[0].selectedOptionLabels).toContain('रीड रेप्लिका'); // Hindi option label
    });
  });

  // -------------------------------------------------------------
  // 5. REPORTS REVIEW WORKFLOW & AUDIT
  // -------------------------------------------------------------
  describe('Admin Reports Review Workflow', () => {
    it('lists reports with PENDING_REVIEW filter', async () => {
      const res = await request(app)
        .get('/api/v1/admin/reports?status=PENDING_REVIEW')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBe(1);
    });

    it('manually edits report content, snapshots revision, and records audit', async () => {
      const newContent = {
        executiveSummary: 'Updated executive summary by senior reviewer.',
        sections: [{ title: 'Updated Section', content: 'Manual review corrections.' }],
      };

      const res = await request(app)
        .patch(`/api/v1/admin/reports/${reportPending.id}/content`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          content: newContent,
          reason: 'Corrected assessment terminology for clarity',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.report.content.executiveSummary).toBe(newContent.executiveSummary);

      // Verify revision was preserved
      const revisions = Array.from(mockReportRevisions.values()).filter(
        (rev) => rev.reportId === reportPending.id
      );
      expect(revisions.length).toBe(1);
      expect(revisions[0].reason).toBe('Corrected assessment terminology for clarity');

      // Verify audit log
      const audit = mockAuditLogs.find((l) => l.action === 'REPORT_CONTENT_EDITED');
      expect(audit).toBeDefined();
      expect(audit?.entityId).toBe(reportPending.id);
      expect(audit?.actorId).toBe(adminUser.id);
    });

    it('rejects a report with reason and records audit', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/reports/${reportPending.id}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Incomplete candidate data' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.report.status).toBe('REJECTED');

      const audit = mockAuditLogs.find((l) => l.action === 'REPORT_REJECTED');
      expect(audit).toBeDefined();
      expect(audit?.after.failureReason).toBe('Incomplete candidate data');
    });

    it('triggers report regeneration, archives history, and audits', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/reports/${reportPending.id}/regenerate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Re-evaluating with updated scoring' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.report.status).toBe('QUEUED');

      const audit = mockAuditLogs.find((l) => l.action === 'REPORT_REGENERATED');
      expect(audit).toBeDefined();
    });
  });

  // -------------------------------------------------------------
  // 6. DASHBOARD SUMMARY & CACHING
  // -------------------------------------------------------------
  describe('Admin Dashboard Summary', () => {
    it('aggregates total revenue in paise and reports counts correctly', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(data.totalRevenue).toBe(99900); // 99900 paise from paidOrder
      expect(data.ordersCount).toBe(2); // 1 paid + 1 free
      expect(data.paidOrdersCount).toBe(2);
      expect(data.freeReportsCount).toBe(0); // Only 1 report created so far (attached to paidOrder)
      expect(data.paidReportsCount).toBe(1);
      expect(data.reportsPendingReview).toBe(1);
      expect(data.revenuePerProduct).toBeDefined();
    });
  });

  // -------------------------------------------------------------
  // 7. AUDIT LOGS & SYSTEM STATUS
  // -------------------------------------------------------------
  describe('Audit Logs and System Status', () => {
    it('lists audit logs with pagination and filters', async () => {
      const res = await request(app)
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toBeDefined();
    });

    it('returns system health status and queue backlog', async () => {
      const res = await request(app)
        .get('/api/v1/admin/system/status')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('healthy');
      expect(res.body.data.system.uptimeSeconds).toBeGreaterThanOrEqual(0);
      expect(res.body.data.queue).toBeDefined();
    });
  });

  // -------------------------------------------------------------
  // 8. OPENAPI SPECIFICATION
  // -------------------------------------------------------------
  describe('OpenAPI / Swagger Spec', () => {
    it('serves OpenAPI specification JSON at /api/docs.json', async () => {
      const res = await request(app).get('/api/docs.json');

      expect(res.status).toBe(200);
      expect(res.body.openapi).toBe('3.0.3');
      expect(res.body.info.title).toContain('Assessment Platform');
      expect(res.body.paths['/admin/dashboard/summary']).toBeDefined();
      expect(res.body.paths['/admin/users']).toBeDefined();
      expect(res.body.paths['/admin/orders/export']).toBeDefined();
    });
  });
});

