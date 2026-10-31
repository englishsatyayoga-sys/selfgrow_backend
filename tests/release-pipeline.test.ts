import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import {
  resetMockDb,
  mockDb,
  mockReports,
} from './setup';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env';
import { reportsService } from '../src/modules/reports/reports.service';
import { defaultPdfRenderer } from '../src/integrations/pdf';
import { renderReportHtml } from '../src/modules/reports/templates/reportCompiler';
import { StorageService } from '../src/integrations/storage';
import { ConsoleMailer } from '../src/integrations/email';

class MockStorage implements StorageService {
  public files = new Map<string, Buffer>();
  public putCount = 0;

  async put(key: string, body: Buffer, _contentType?: string): Promise<void> {
    this.putCount++;
    this.files.set(key, body);
  }

  async getSignedUrl(key: string, ttlSeconds: number): Promise<string> {
    return `https://storage.mock.local/${key}?token=mock-signed-token&ttl=${ttlSeconds}`;
  }

  async delete(key: string): Promise<void> {
    this.files.delete(key);
  }

  async getBuffer(key: string): Promise<Buffer> {
    const file = this.files.get(key);
    if (!file) throw new Error(`File ${key} not found`);
    return file;
  }
}

describe('Phase 6: PDF, Storage, Email Release Pipeline & Download Tests', () => {
  let mockStorage: MockStorage;
  let mockMailer: ConsoleMailer;
  let userA: any;
  let userB: any;
  let adminUser: any;
  let userToken: string;
  let userBToken: string;
  let assessment: any;
  let product: any;
  let attempt: any;
  let order: any;
  let report: any;

  beforeEach(async () => {
    resetMockDb();

    mockStorage = new MockStorage();
    mockMailer = new ConsoleMailer();

    reportsService.setStorageService(mockStorage);
    reportsService.setMailer(mockMailer);

    userA = await mockDb.user.create({
      data: {
        name: 'Priya Sharma',
        email: 'priya@example.com',
        passwordHash: 'hash',
        role: 'USER',
        preferredLanguage: 'HI',
      },
    });

    userB = await mockDb.user.create({
      data: {
        name: 'Rohan Verma',
        email: 'rohan@example.com',
        passwordHash: 'hash',
        role: 'USER',
        preferredLanguage: 'EN',
      },
    });

    adminUser = await mockDb.user.create({
      data: {
        name: 'Admin Boss',
        email: 'admin@platform.com',
        passwordHash: 'hash',
        role: 'ADMIN',
      },
    });

    userToken = jwt.sign(
      { sub: userA.id, email: userA.email, role: 'USER' },
      env.JWT_ACCESS_SECRET
    );
    userBToken = jwt.sign(
      { sub: userB.id, email: userB.email, role: 'USER' },
      env.JWT_ACCESS_SECRET
    );

    assessment = await mockDb.assessment.create({
      data: {
        slug: 'leadership-hi-test',
        title: { en: 'Leadership Assessment', hi: 'नेतृत्व मूल्यांकन' },
        description: { en: 'Leadership skills', hi: 'नेतृत्व कौशल' },
        kind: 'OBJECTIVE',
      },
    });

    product = await mockDb.product.create({
      data: {
        slug: 'leadership-report-product',
        name: { en: 'Leadership Report', hi: 'नेतृत्व रिपोर्ट' },
        description: { en: 'Complete report', hi: 'पूर्ण रिपोर्ट' },
        priceInPaise: 0,
        autoRelease: false,
        assessmentId: assessment.id,
      },
    });

    attempt = await mockDb.attempt.create({
      data: {
        userId: userA.id,
        productId: product.id,
        assessmentId: assessment.id,
        language: 'HI',
        status: 'SUBMITTED',
        scoreSummary: {
          totalScore: 45,
          maxPossibleScore: 50,
          percentage: 90,
          dimensionScores: {
            'निर्णय क्षमता (Decision Making)': { score: 25, max: 25, percentage: 100 },
            'संचार (Communication)': { score: 20, max: 25, percentage: 80 },
          },
        },
      },
    });

    order = await mockDb.order.create({
      data: {
        userId: userA.id,
        productId: product.id,
        attemptId: attempt.id,
        amountInPaise: 0,
        status: 'PAID',
      },
    });

    report = await mockDb.report.create({
      data: {
        orderId: order.id,
        status: 'PENDING_REVIEW',
        language: 'HI',
        templateVersion: 1,
        content: {
          executiveSummary: 'उम्मीदवार ने असाधारण रणनीतिक नेतृत्व कौशल प्रदर्शित किया। निर्णय लेने की गति और सटीकता उल्लेखनीय है।',
          sections: [
            {
              title: 'रणनीतिक दृष्टि और योजना',
              content: 'दीर्घकालिक लक्ष्यों के साथ संगठनात्मक संसाधनों को संरेखित करने की मजबूत क्षमता।',
              recommendations: ['अंतर-विभागीय सहयोग को और गहरा करें।'],
            },
          ],
        },
      },
    });
  });

  afterAll(async () => {
    await defaultPdfRenderer.close();
  });

  it('1. Hindi PDF smoke test: renders non-empty PDF with Hindi Devanagari script', async () => {
    const html = renderReportHtml({
      reportId: report.id,
      candidateName: userA.name,
      assessmentTitle: 'नेतृत्व मूल्यांकन',
      language: 'HI',
      generatedDate: '३० अक्टूबर २०२६',
      executiveSummary: 'उम्मीदवार ने असाधारण रणनीतिक नेतृत्व कौशल प्रदर्शित किया।',
      sections: [
        {
          title: 'रणनीतिक दृष्टि',
          content: 'दीर्घकालिक लक्ष्यों को प्राप्त करने की मजबूत क्षमता।',
          recommendations: ['सहयोग को गहरा करें।'],
        },
      ],
      scoreSummary: attempt.scoreSummary,
    });

    expect(html).toContain('नेतृत्व मूल्यांकन');
    expect(html).toContain('कार्यकारी सारांश');

    const pdfBuffer = await defaultPdfRenderer.render(html);
    expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    // Check standard PDF file header '%PDF-'
    expect(pdfBuffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('2. release is idempotent: multiple invocations do not duplicate PDFs or emails', async () => {
    // First execution
    await reportsService.processReleaseJob(report.id, adminUser.id);

    const releasedReport = mockReports.get(report.id);
    expect(releasedReport.status).toBe('RELEASED');
    expect(releasedReport.pdfKey).toBeTruthy();
    expect(releasedReport.pdfGeneratedAt).toBeTruthy();
    expect(releasedReport.emailSentAt).toBeTruthy();
    expect(releasedReport.emailStatus).toBe('SENT');
    expect(mockStorage.putCount).toBe(1);
    expect(mockMailer.sentMails.length).toBe(1);
    expect(mockMailer.sentMails[0].to).toBe(userA.email);

    // Second execution on same report
    await reportsService.processReleaseJob(report.id, adminUser.id);

    // Verify no additional uploads or email dispatches occurred
    expect(mockStorage.putCount).toBe(1);
    expect(mockMailer.sentMails.length).toBe(1);
  });

  it('3. download ownership enforced: wrong user receives 404', async () => {
    // Release the report first
    await reportsService.processReleaseJob(report.id);

    // User B attempts to access User A's report download
    const resForbidden = await request(app)
      .get(`/api/v1/reports/${report.id}/download`)
      .set('Authorization', `Bearer ${userBToken}`);

    expect(resForbidden.status).toBe(404);
    expect(resForbidden.body.success).toBe(false);
    expect(resForbidden.body.error.code).toBe('REPORT_NOT_FOUND');

    // User A accesses their own report
    const resSuccess = await request(app)
      .get(`/api/v1/reports/${report.id}/download`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(resSuccess.status).toBe(200);
    expect(resSuccess.body.success).toBe(true);
    expect(resSuccess.body.data.downloadUrl).toContain('https://storage.mock.local/');
  });

  it('4. not-released blocked: downloading unreleased report returns 400', async () => {
    // Report is currently PENDING_REVIEW (not RELEASED)
    const res = await request(app)
      .get(`/api/v1/reports/${report.id}/download`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('REPORT_NOT_RELEASED');
  });

  it('5. email failure retried without duplicate PDF', async () => {
    mockMailer.shouldFail = true;

    // First attempt fails during email delivery
    await expect(
      reportsService.processReleaseJob(report.id, adminUser.id)
    ).rejects.toThrow('Simulated mail delivery failure');

    const partiallyReleased = mockReports.get(report.id);
    expect(partiallyReleased.pdfKey).toBeTruthy();
    expect(partiallyReleased.emailSentAt).toBeNull();
    expect(partiallyReleased.emailStatus).toBe('FAILED');
    expect(mockStorage.putCount).toBe(1);
    expect(mockMailer.sentMails.length).toBe(0);

    // Recover email provider and retry release
    mockMailer.shouldFail = false;
    await reportsService.processReleaseJob(report.id, adminUser.id);

    const completedReport = mockReports.get(report.id);
    expect(completedReport.emailSentAt).toBeTruthy();
    expect(completedReport.emailStatus).toBe('SENT');
    // Crucial check: PDF was NOT re-uploaded, putCount remains 1
    expect(mockStorage.putCount).toBe(1);
    expect(mockMailer.sentMails.length).toBe(1);
  });

  it('6. local storage signed download: verifies HMAC signature and blocks tampering', async () => {
    const { LocalStorageDriver } = await import('../src/integrations/storage/local.storage');
    const localDriver = new LocalStorageDriver(undefined, env.JWT_ACCESS_SECRET);
    reportsService.setStorageService(localDriver);

    // Release report to generate PDF in local storage
    await reportsService.processReleaseJob(report.id, adminUser.id);
    const released = mockReports.get(report.id);
    expect(released.pdfKey).toBeTruthy();

    // Get signed URL
    const signedUrl = await localDriver.getSignedUrl(released.pdfKey, 3600);
    const parsedUrl = new URL(signedUrl);
    const key = parsedUrl.searchParams.get('key')!;
    const expires = parsedUrl.searchParams.get('expires')!;
    const signature = parsedUrl.searchParams.get('signature')!;

    // 1. Valid download request
    const validRes = await request(app)
      .get(`/api/v1/storage/download?key=${encodeURIComponent(key)}&expires=${expires}&signature=${signature}`);
    expect(validRes.status).toBe(200);
    expect(validRes.headers['content-type']).toBe('application/pdf');

    // 2. Tampered signature request
    const tamperedRes = await request(app)
      .get(`/api/v1/storage/download?key=${encodeURIComponent(key)}&expires=${expires}&signature=tampered_bad_sig`);
    expect(tamperedRes.status).toBe(403);
    expect(tamperedRes.body.success).toBe(false);
    expect(tamperedRes.body.error.code).toBe('EXPIRED_OR_INVALID_SIGNATURE');

    // Clean up local file created in test
    await localDriver.delete(released.pdfKey);
  });
});
