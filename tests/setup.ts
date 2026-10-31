import { vi } from 'vitest';
import crypto from 'crypto';

process.env.NODE_ENV = 'test';
process.env.PORT = '5001';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.JWT_ACCESS_SECRET = 'test_access_secret_longer_than_32_characters_12345';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_longer_than_32_characters_12345';
process.env.ACCESS_TOKEN_TTL = '15m';
process.env.REFRESH_TOKEN_TTL = '7d';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.ADMIN_EMAIL = 'admin@example.com';
process.env.ADMIN_PASSWORD = 'Admin@123456';
process.env.RAZORPAY_KEY_ID = 'rzp_test_mock_key_id';
process.env.RAZORPAY_KEY_SECRET = 'rzp_test_mock_key_secret_1234567890';
process.env.RAZORPAY_WEBHOOK_SECRET = 'rzp_test_mock_webhook_secret_12345';
process.env.OPENAI_API_KEY = 'sk-mock-test-key';
process.env.OPENAI_MODEL = 'gpt-4o-mini';
process.env.AI_MAX_RETRIES = '3';
process.env.AI_TIMEOUT_MS = '60000';

// In-memory database simulation for tests
export const mockUsers = new Map<string, any>();
export const mockRefreshTokens = new Map<string, any>();
export const mockAssessments = new Map<string, any>();
export const mockQuestions = new Map<string, any>();
export const mockOptions = new Map<string, any>();
export const mockProducts = new Map<string, any>();
export const mockAttempts = new Map<string, any>();
export const mockResponses = new Map<string, any>();
export const mockOrders = new Map<string, any>();
export const mockPayments = new Map<string, any>();
export const mockWebhookEvents = new Map<string, any>();
export const mockReportTemplates = new Map<string, any>();
export const mockReports = new Map<string, any>();
export const mockReportRevisions = new Map<string, any>();
export const mockAuditLogs: any[] = [];

export const resetMockDb = () => {
  mockUsers.clear();
  mockRefreshTokens.clear();
  mockAssessments.clear();
  mockQuestions.clear();
  mockOptions.clear();
  mockProducts.clear();
  mockAttempts.clear();
  mockResponses.clear();
  mockOrders.clear();
  mockPayments.clear();
  mockWebhookEvents.clear();
  mockReportTemplates.clear();
  mockReports.clear();
  mockReportRevisions.clear();
  mockAuditLogs.length = 0;
};

export const mockDb: any = {
  user: {
    findUnique: vi.fn(async ({ where, select }: { where: { id?: string; email?: string }; select?: any }) => {
      for (const user of mockUsers.values()) {
        if ((where.id && user.id === where.id) || (where.email && user.email.toLowerCase() === where.email.toLowerCase())) {
          const res: any = { ...user };
          if (select?.orders) {
            res.orders = Array.from(mockOrders.values())
              .filter((o) => o.userId === user.id)
              .map((o) => ({
                ...o,
                product: mockProducts.get(o.productId),
              }));
          }
          if (select?.attempts) {
            res.attempts = Array.from(mockAttempts.values())
              .filter((a) => a.userId === user.id)
              .map((a) => ({
                ...a,
                assessment: mockAssessments.get(a.assessmentId),
              }));
          }
          if (select && !select.passwordHash) {
            delete res.passwordHash;
          }
          return res;
        }
      }
      return null;
    }),
    findMany: vi.fn(async ({ where, skip = 0, take = 50, select }: any = {}) => {
      let list = Array.from(mockUsers.values());
      if (where?.role) {
        list = list.filter((u) => u.role === where.role);
      }
      if (where?.isActive !== undefined) {
        list = list.filter((u) => u.isActive === where.isActive);
      }
      if (where?.OR) {
        list = list.filter((u) => {
          return where.OR.some((cond: any) => {
            if (cond.name?.contains) {
              return u.name.toLowerCase().includes(cond.name.contains.toLowerCase());
            }
            if (cond.email?.contains) {
              return u.email.toLowerCase().includes(cond.email.contains.toLowerCase());
            }
            return false;
          });
        });
      }
      list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return list.slice(skip, skip + take).map((u) => {
        const { passwordHash, ...safe } = u;
        return safe;
      });
    }),
    count: vi.fn(async ({ where }: any = {}) => {
      let list = Array.from(mockUsers.values());
      if (where?.role) {
        list = list.filter((u) => u.role === where.role);
      }
      if (where?.isActive !== undefined) {
        list = list.filter((u) => u.isActive === where.isActive);
      }
      return list.length;
    }),
    create: vi.fn(async ({ data }: { data: any }) => {
      const id = data.id || crypto.randomUUID();
      const user = {
        id,
        name: data.name,
        email: data.email.toLowerCase(),
        passwordHash: data.passwordHash,
        role: data.role || 'USER',
        preferredLanguage: data.preferredLanguage || 'EN',
        consentAcceptedAt: data.consentAcceptedAt || new Date(),
        isActive: data.isActive !== undefined ? data.isActive : true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockUsers.set(id, user);
      return { ...user };
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: any }) => {
      const existing = mockUsers.get(where.id);
      if (!existing) return null;
      const updated = { ...existing, ...data, updatedAt: new Date() };
      mockUsers.set(where.id, updated);
      return { ...updated };
    }),
    deleteMany: vi.fn(async () => {
      mockUsers.clear();
      return { count: 0 };
    }),
  },
  refreshToken: {
    findUnique: vi.fn(async ({ where, include }: { where: { tokenHash: string }; include?: any }) => {
      for (const token of mockRefreshTokens.values()) {
        if (token.tokenHash === where.tokenHash) {
          const res = { ...token };
          if (include?.user) {
            res.user = mockUsers.get(token.userId);
          }
          return res;
        }
      }
      return null;
    }),
    create: vi.fn(async ({ data }: { data: any }) => {
      const id = data.id || crypto.randomUUID();
      const token = {
        id,
        userId: data.userId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
        revokedAt: null,
        createdAt: new Date(),
        userAgent: data.userAgent || null,
        ip: data.ip || null,
      };
      mockRefreshTokens.set(id, token);
      return { ...token };
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: any }) => {
      const existing = mockRefreshTokens.get(where.id);
      if (!existing) return null;
      const updated = { ...existing, ...data };
      mockRefreshTokens.set(where.id, updated);
      return { ...updated };
    }),
    updateMany: vi.fn(async ({ where, data }: { where: any; data: any }) => {
      let count = 0;
      for (const [id, token] of mockRefreshTokens.entries()) {
        if (where.userId && token.userId === where.userId) {
          if (where.revokedAt === null && token.revokedAt !== null) {
            continue;
          }
          mockRefreshTokens.set(id, { ...token, ...data });
          count++;
        }
      }
      return { count };
    }),
    deleteMany: vi.fn(async () => {
      mockRefreshTokens.clear();
      return { count: 0 };
    }),
  },
  assessment: {
    findUnique: vi.fn(async ({ where, include }: { where: { id?: string; slug?: string }; include?: any }) => {
      for (const a of mockAssessments.values()) {
        if ((where.id && a.id === where.id) || (where.slug && a.slug === where.slug)) {
          const res = { ...a };
          if (include?.questions) {
            const qList = Array.from(mockQuestions.values())
              .filter((q) => q.assessmentId === a.id && (include.questions?.where?.isActive !== undefined ? q.isActive === include.questions.where.isActive : true))
              .sort((x, y) => x.order - y.order);

            if (include.questions?.include?.options) {
              res.questions = qList.map((q) => ({
                ...q,
                options: Array.from(mockOptions.values())
                  .filter((o) => o.questionId === q.id && (include.questions?.include?.options?.where?.isActive !== undefined ? o.isActive === include.questions.include.options.where.isActive : true))
                  .sort((x, y) => x.order - y.order),
              }));
            } else {
              res.questions = qList;
            }
          }
          return res;
        }
      }
      return null;
    }),
    findMany: vi.fn(async ({ where, skip = 0, take = 50 }: any = {}) => {
      let list = Array.from(mockAssessments.values());
      if (where?.isActive !== undefined) {
        list = list.filter((a) => a.isActive === where.isActive);
      }
      list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return list.slice(skip, skip + take).map((a) => ({ ...a }));
    }),
    count: vi.fn(async ({ where }: any = {}) => {
      let list = Array.from(mockAssessments.values());
      if (where?.isActive !== undefined) {
        list = list.filter((a) => a.isActive === where.isActive);
      }
      return list.length;
    }),
    create: vi.fn(async ({ data }: { data: any }) => {
      const id = data.id || crypto.randomUUID();
      const assessment = {
        id,
        slug: data.slug,
        title: data.title,
        description: data.description,
        kind: data.kind,
        timeLimitSeconds: data.timeLimitSeconds ?? null,
        version: data.version ?? 1,
        isActive: data.isActive !== undefined ? data.isActive : true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockAssessments.set(id, assessment);
      return { ...assessment };
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: any }) => {
      const existing = mockAssessments.get(where.id);
      if (!existing) return null;
      const updated = {
        ...existing,
        ...data,
        version: data.version?.increment ? existing.version + 1 : (data.version ?? existing.version),
        updatedAt: new Date(),
      };
      mockAssessments.set(where.id, updated);
      return { ...updated };
    }),
  },
  question: {
    findUnique: vi.fn(async ({ where, include }: { where: { id: string }; include?: any }) => {
      const q = mockQuestions.get(where.id);
      if (!q) return null;
      const res = { ...q };
      if (include?.options) {
        res.options = Array.from(mockOptions.values())
          .filter((o) => o.questionId === q.id && (include.options?.where?.isActive !== undefined ? o.isActive === include.options.where.isActive : true))
          .sort((x, y) => x.order - y.order);
      }
      return res;
    }),
    findMany: vi.fn(async ({ where }: any = {}) => {
      let list = Array.from(mockQuestions.values());
      if (where?.assessmentId) {
        list = list.filter((q) => q.assessmentId === where.assessmentId);
      }
      if (where?.isActive !== undefined) {
        list = list.filter((q) => q.isActive === where.isActive);
      }
      return list.sort((a, b) => a.order - b.order).map((q) => ({ ...q }));
    }),
    create: vi.fn(async ({ data }: { data: any }) => {
      const id = data.id || crypto.randomUUID();
      const question = {
        id,
        assessmentId: data.assessmentId,
        order: data.order,
        section: data.section || null,
        type: data.type,
        text: data.text,
        isRequired: data.isRequired !== undefined ? data.isRequired : true,
        maxLength: data.maxLength || null,
        dimension: data.dimension || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockQuestions.set(id, question);
      return { ...question };
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: any }) => {
      const existing = mockQuestions.get(where.id);
      if (!existing) return null;
      const updated = { ...existing, ...data, updatedAt: new Date() };
      mockQuestions.set(where.id, updated);
      return { ...updated };
    }),
  },
  option: {
    create: vi.fn(async ({ data }: { data: any }) => {
      const id = data.id || crypto.randomUUID();
      const option = {
        id,
        questionId: data.questionId,
        order: data.order,
        label: data.label,
        score: data.score !== undefined ? data.score : 0,
        isActive: data.isActive !== undefined ? data.isActive : true,
      };
      mockOptions.set(id, option);
      return { ...option };
    }),
    createMany: vi.fn(async ({ data }: { data: any[] }) => {
      for (const item of data) {
        const id = item.id || crypto.randomUUID();
        mockOptions.set(id, {
          id,
          questionId: item.questionId,
          order: item.order,
          label: item.label,
          score: item.score !== undefined ? item.score : 0,
          isActive: item.isActive !== undefined ? item.isActive : true,
        });
      }
      return { count: data.length };
    }),
    deleteMany: vi.fn(async ({ where }: { where: { questionId: string } }) => {
      let count = 0;
      for (const [id, opt] of mockOptions.entries()) {
        if (opt.questionId === where.questionId) {
          mockOptions.delete(id);
          count++;
        }
      }
      return { count };
    }),
  },
  product: {
    findUnique: vi.fn(async ({ where, include }: { where: { id?: string; slug?: string }; include?: any }) => {
      for (const p of mockProducts.values()) {
        if ((where.id && p.id === where.id) || (where.slug && p.slug === where.slug)) {
          const res = { ...p };
          if (include?.assessment) {
            const a = mockAssessments.get(p.assessmentId);
            if (a) {
              const aCopy = { ...a };
              if (include.assessment?.include?.questions) {
                const qList = Array.from(mockQuestions.values())
                  .filter((q) => q.assessmentId === a.id && q.isActive)
                  .sort((x, y) => x.order - y.order);
                aCopy.questions = qList.map((q) => ({
                  ...q,
                  options: Array.from(mockOptions.values())
                    .filter((o) => o.questionId === q.id && o.isActive)
                    .sort((x, y) => x.order - y.order),
                }));
              }
              res.assessment = aCopy;
            }
          }
          return res;
        }
      }
      return null;
    }),
    findMany: vi.fn(async ({ where, skip = 0, take = 50, include }: any = {}) => {
      let list = Array.from(mockProducts.values());
      if (where?.isActive !== undefined) {
        list = list.filter((p) => p.isActive === where.isActive);
      }
      list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return list.slice(skip, skip + take).map((p) => {
        const copy = { ...p };
        if (include?.assessment) {
          copy.assessment = mockAssessments.get(p.assessmentId);
        }
        return copy;
      });
    }),
    count: vi.fn(async ({ where }: any = {}) => {
      let list = Array.from(mockProducts.values());
      if (where?.isActive !== undefined) {
        list = list.filter((p) => p.isActive === where.isActive);
      }
      return list.length;
    }),
    create: vi.fn(async ({ data }: { data: any }) => {
      const id = data.id || crypto.randomUUID();
      const product = {
        id,
        slug: data.slug,
        name: data.name,
        description: data.description,
        assessmentId: data.assessmentId,
        reportTemplateId: data.reportTemplateId || null,
        priceInPaise: data.priceInPaise ?? 0,
        currency: data.currency || 'INR',
        autoRelease: data.autoRelease !== undefined ? data.autoRelease : true,
        isActive: data.isActive !== undefined ? data.isActive : true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockProducts.set(id, product);
      return { ...product };
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: any }) => {
      const existing = mockProducts.get(where.id);
      if (!existing) return null;
      const updated = { ...existing, ...data, updatedAt: new Date() };
      mockProducts.set(where.id, updated);
      return { ...updated };
    }),
  },
  attempt: {
    findUnique: vi.fn(async ({ where, include }: { where: { id: string }; include?: any }) => {
      const attempt = mockAttempts.get(where.id);
      if (!attempt) return null;
      const res = { ...attempt };
      if (include?.responses) {
        res.responses = Array.from(mockResponses.values()).filter((r) => r.attemptId === attempt.id);
      }
      if (include?.product) {
        res.product = mockProducts.get(attempt.productId);
      }
      if (include?.assessment) {
        res.assessment = mockAssessments.get(attempt.assessmentId);
      }
      if (include?.user) {
        res.user = mockUsers.get(attempt.userId);
      }
      if (include?.responses) {
        res.responses = Array.from(mockResponses.values()).filter((r) => r.attemptId === attempt.id);
      }
      return res;
    }),
    findFirst: vi.fn(async ({ where }: { where: { userId: string; productId: string; status: string } }) => {
      for (const a of mockAttempts.values()) {
        if (a.userId === where.userId && a.productId === where.productId && a.status === where.status) {
          return { ...a };
        }
      }
      return null;
    }),
    findMany: vi.fn(async ({ where, skip = 0, take = 50, include }: any = {}) => {
      let list = Array.from(mockAttempts.values());
      if (where?.userId) {
        list = list.filter((a) => a.userId === where.userId);
      }
      if (where?.status) {
        list = list.filter((a) => a.status === where.status);
      }
      list.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
      return list.slice(skip, skip + take).map((a) => {
        const copy = { ...a };
        if (include?.product) {
          copy.product = mockProducts.get(a.productId);
        }
        if (include?.assessment) {
          copy.assessment = mockAssessments.get(a.assessmentId);
        }
        if (include?.user) {
          copy.user = mockUsers.get(a.userId);
        }
        return copy;
      });
    }),
    count: vi.fn(async ({ where }: any = {}) => {
      let list = Array.from(mockAttempts.values());
      if (where?.userId) {
        list = list.filter((a) => a.userId === where.userId);
      }
      return list.length;
    }),
    create: vi.fn(async ({ data }: { data: any }) => {
      const id = data.id || crypto.randomUUID();
      const attempt = {
        id,
        userId: data.userId,
        productId: data.productId,
        assessmentId: data.assessmentId,
        assessmentVersion: data.assessmentVersion || 1,
        language: data.language || 'EN',
        status: data.status || 'IN_PROGRESS',
        startedAt: data.startedAt || new Date(),
        expiresAt: data.expiresAt || null,
        submittedAt: data.submittedAt || null,
        scoreSummary: data.scoreSummary || null,
        snapshot: data.snapshot || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockAttempts.set(id, attempt);
      return { ...attempt };
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: any }) => {
      const existing = mockAttempts.get(where.id);
      if (!existing) return null;
      const updated = { ...existing, ...data, updatedAt: new Date() };
      mockAttempts.set(where.id, updated);
      return { ...updated };
    }),
  },
  response: {
    findMany: vi.fn(async ({ where }: { where: { attemptId: string } }) => {
      return Array.from(mockResponses.values()).filter((r) => r.attemptId === where.attemptId);
    }),
    upsert: vi.fn(async ({ where, create, update }: any) => {
      const key = `${where.attemptId_questionId.attemptId}_${where.attemptId_questionId.questionId}`;
      const existing = mockResponses.get(key);
      if (existing) {
        const updated = { ...existing, ...update, answeredAt: update.answeredAt || new Date() };
        mockResponses.set(key, updated);
        return { ...updated };
      } else {
        const id = create.id || crypto.randomUUID();
        const created = { id, ...create, answeredAt: create.answeredAt || new Date() };
        mockResponses.set(key, created);
        return { ...created };
      }
    }),
  },
  order: {
    findUnique: vi.fn(async ({ where, include }: { where: { id?: string; attemptId?: string; razorpayOrderId?: string }; include?: any }) => {
      for (const o of mockOrders.values()) {
        if (
          (where.id && o.id === where.id) ||
          (where.attemptId && o.attemptId === where.attemptId) ||
          (where.razorpayOrderId && o.razorpayOrderId === where.razorpayOrderId)
        ) {
          const res = { ...o };
          if (include?.attempt) {
            const att = mockAttempts.get(o.attemptId);
            if (att) {
              const attCopy = { ...att };
              if (include.attempt.include?.product) {
                attCopy.product = mockProducts.get(att.productId);
              }
              if (include.attempt.include?.assessment) {
                attCopy.assessment = mockAssessments.get(att.assessmentId);
              }
              if (include.attempt.include?.responses) {
                attCopy.responses = Array.from(mockResponses.values()).filter((r) => r.attemptId === att.id);
              }
              res.attempt = attCopy;
            }
          }
          if (include?.product) {
            res.product = mockProducts.get(o.productId);
          }
          if (include?.payments) {
            res.payments = Array.from(mockPayments.values()).filter((p) => p.orderId === o.id);
          }
          return res;
        }
      }
      return null;
    }),
    findMany: vi.fn(async ({ where, skip = 0, take = 50, include }: any = {}) => {
      let list = Array.from(mockOrders.values());
      if (where?.userId) {
        list = list.filter((o) => o.userId === where.userId);
      }
      if (where?.status) {
        list = list.filter((o) => o.status === where.status);
      }
      list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return list.slice(skip, skip + take).map((o) => {
        const copy = { ...o };
        if (include?.product) {
          copy.product = mockProducts.get(o.productId);
        }
        if (include?.user) {
          copy.user = mockUsers.get(o.userId);
        }
        if (include?.payments) {
          copy.payments = Array.from(mockPayments.values()).filter((p) => p.orderId === o.id);
        }
        return copy;
      });
    }),
    aggregate: vi.fn(async ({ where }: any = {}) => {
      let list = Array.from(mockOrders.values());
      if (where?.status) {
        list = list.filter((o) => o.status === where.status);
      }
      const sumAmount = list.reduce((acc, o) => acc + (o.amountInPaise || 0), 0);
      return {
        _sum: { amountInPaise: sumAmount },
        _count: { id: list.length },
      };
    }),
    count: vi.fn(async ({ where }: any = {}) => {
      let list = Array.from(mockOrders.values());
      if (where?.userId) {
        list = list.filter((o) => o.userId === where.userId);
      }
      return list.length;
    }),
    create: vi.fn(async ({ data }: { data: any }) => {
      const id = data.id || crypto.randomUUID();
      const order = {
        id,
        userId: data.userId,
        productId: data.productId,
        attemptId: data.attemptId,
        amountInPaise: data.amountInPaise,
        currency: data.currency || 'INR',
        status: data.status || 'CREATED',
        razorpayOrderId: data.razorpayOrderId || null,
        createdAt: new Date(),
        paidAt: data.paidAt || null,
      };
      mockOrders.set(id, order);
      return { ...order };
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: any }) => {
      const existing = mockOrders.get(where.id);
      if (!existing) return null;
      const updated = { ...existing, ...data };
      mockOrders.set(where.id, updated);
      return { ...updated };
    }),
  },
  payment: {
    upsert: vi.fn(async ({ where, create, update }: any) => {
      const existing = mockPayments.get(where.razorpayPaymentId);
      if (existing) {
        const updated = { ...existing, ...update };
        mockPayments.set(where.razorpayPaymentId, updated);
        return { ...updated };
      } else {
        const id = create.id || crypto.randomUUID();
        const created = { id, ...create, createdAt: new Date() };
        mockPayments.set(where.razorpayPaymentId, created);
        return { ...created };
      }
    }),
  },
  webhookEvent: {
    findUnique: vi.fn(async ({ where }: { where: { eventId: string } }) => {
      return mockWebhookEvents.get(where.eventId) || null;
    }),
    create: vi.fn(async ({ data }: { data: any }) => {
      const id = data.id || crypto.randomUUID();
      const event = { id, ...data, processedAt: new Date() };
      mockWebhookEvents.set(data.eventId, event);
      return { ...event };
    }),
  },
  reportTemplate: {
    findFirst: vi.fn(async ({ where, orderBy }: any = {}) => {
      let list = Array.from(mockReportTemplates.values());
      if (where?.assessmentId) {
        list = list.filter((t) => t.assessmentId === where.assessmentId);
      }
      if (where?.isActive !== undefined) {
        list = list.filter((t) => t.isActive === where.isActive);
      }
      list.sort((a, b) => b.version - a.version);
      return list[0] || null;
    }),
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
      return mockReportTemplates.get(where.id) || null;
    }),
    findMany: vi.fn(async ({ where, skip = 0, take = 50 }: any = {}) => {
      let list = Array.from(mockReportTemplates.values());
      if (where?.assessmentId) {
        list = list.filter((t) => t.assessmentId === where.assessmentId);
      }
      if (where?.isActive !== undefined) {
        list = list.filter((t) => t.isActive === where.isActive);
      }
      list.sort((a, b) => b.version - a.version);
      return list.slice(skip, skip + take).map((t) => ({ ...t }));
    }),
    count: vi.fn(async ({ where }: any = {}) => {
      let list = Array.from(mockReportTemplates.values());
      if (where?.assessmentId) {
        list = list.filter((t) => t.assessmentId === where.assessmentId);
      }
      if (where?.isActive !== undefined) {
        list = list.filter((t) => t.isActive === where.isActive);
      }
      return list.length;
    }),
    create: vi.fn(async ({ data }: { data: any }) => {
      const id = data.id || crypto.randomUUID();
      const template = {
        id,
        name: data.name,
        assessmentId: data.assessmentId,
        version: data.version || 1,
        isActive: data.isActive !== undefined ? data.isActive : true,
        systemPrompt: data.systemPrompt,
        userPromptTemplate: data.userPromptTemplate,
        outputSchema: data.outputSchema,
        layout: data.layout,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockReportTemplates.set(id, template);
      return { ...template };
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: any }) => {
      const existing = mockReportTemplates.get(where.id);
      if (!existing) return null;
      const updated = { ...existing, ...data, updatedAt: new Date() };
      mockReportTemplates.set(where.id, updated);
      return { ...updated };
    }),
  },
  report: {
    findUnique: vi.fn(async ({ where, include }: { where: { id?: string; orderId?: string }; include?: any }) => {
      for (const r of mockReports.values()) {
        if ((where.id && r.id === where.id) || (where.orderId && r.orderId === where.orderId)) {
          const res = { ...r };
          if (include?.order) {
            const order = mockOrders.get(r.orderId);
            if (order) {
              const oCopy = { ...order };
              oCopy.user = mockUsers.get(order.userId);
              if (include.order.include?.attempt) {
                const att = mockAttempts.get(order.attemptId);
                if (att) {
                  const attCopy = { ...att };
                  if (include.order.include.attempt.include?.product) {
                    attCopy.product = mockProducts.get(att.productId);
                  }
                  if (include.order.include.attempt.include?.assessment) {
                    attCopy.assessment = mockAssessments.get(att.assessmentId);
                  }
                  if (include.order.include.attempt.include?.responses) {
                    attCopy.responses = Array.from(mockResponses.values()).filter((resp) => resp.attemptId === att.id);
                  }
                  oCopy.attempt = attCopy;
                }
              }
              if (include.order.include?.product) {
                oCopy.product = mockProducts.get(order.productId);
              }
              res.order = oCopy;
            }
          }
          return res;
        }
      }
      return null;
    }),
    findMany: vi.fn(async ({ where, skip = 0, take = 50, include }: any = {}) => {
      let list = Array.from(mockReports.values());
      if (where?.order?.userId) {
        list = list.filter((r) => {
          const order = mockOrders.get(r.orderId);
          return order && order.userId === where.order.userId;
        });
      }
      list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return list.slice(skip, skip + take).map((r) => {
        const copy: any = { ...r };
        const order = mockOrders.get(r.orderId);
        if (order) {
          const oCopy: any = { ...order };
          if (include?.order?.include?.product) {
            oCopy.product = mockProducts.get(order.productId);
          }
          if (include?.order?.include?.user) {
            oCopy.user = mockUsers.get(order.userId);
          }
          copy.order = oCopy;
        }
        return copy;
      });
    }),
    findFirst: vi.fn(async ({ where, orderBy }: any = {}) => {
      let list = Array.from(mockReports.values());
      if (where?.status) {
        if (typeof where.status === 'string') {
          list = list.filter((r) => r.status === where.status);
        } else if (where.status.in) {
          list = list.filter((r) => where.status.in.includes(r.status));
        }
      }
      if (orderBy?.releasedAt === 'desc') {
        list.sort((a, b) => (b.releasedAt?.getTime() || 0) - (a.releasedAt?.getTime() || 0));
      }
      return list[0] ? { ...list[0] } : null;
    }),
    count: vi.fn(async ({ where }: any = {}) => {
      let list = Array.from(mockReports.values());
      if (where?.order?.userId) {
        list = list.filter((r) => {
          const order = mockOrders.get(r.orderId);
          return order && order.userId === where.order.userId;
        });
      }
      if (where?.status) {
        if (typeof where.status === 'string') {
          list = list.filter((r) => r.status === where.status);
        } else if (where.status.in) {
          list = list.filter((r) => where.status.in.includes(r.status));
        }
      }
      return list.length;
    }),
    create: vi.fn(async ({ data }: { data: any }) => {
      const id = data.id || crypto.randomUUID();
      const report = {
        id,
        orderId: data.orderId,
        status: data.status || 'QUEUED',
        language: data.language || 'EN',
        content: data.content || null,
        templateVersion: data.templateVersion || 1,
        model: data.model || null,
        promptTokens: data.promptTokens || null,
        completionTokens: data.completionTokens || null,
        failureReason: data.failureReason || null,
        attemptCount: data.attemptCount || 0,
        generatedAt: data.generatedAt || null,
        releasedAt: data.releasedAt || null,
        releasedById: data.releasedById || null,
        pdfKey: data.pdfKey || null,
        pdfGeneratedAt: data.pdfGeneratedAt || null,
        emailSentAt: data.emailSentAt || null,
        emailStatus: data.emailStatus || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockReports.set(id, report);
      return { ...report };
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: any }) => {
      const existing = mockReports.get(where.id);
      if (!existing) return null;
      const attemptCount =
        data.attemptCount?.increment !== undefined
          ? existing.attemptCount + data.attemptCount.increment
          : (data.attemptCount ?? existing.attemptCount);
      const updated = {
        ...existing,
        ...data,
        attemptCount,
        updatedAt: new Date(),
      };
      mockReports.set(where.id, updated);
      return { ...updated };
    }),
  },
  reportRevision: {
    create: vi.fn(async ({ data }: { data: any }) => {
      const id = data.id || crypto.randomUUID();
      const rev = {
        id,
        reportId: data.reportId,
        content: data.content,
        createdById: data.createdById || null,
        reason: data.reason,
        createdAt: new Date(),
      };
      mockReportRevisions.set(id, rev);
      return { ...rev };
    }),
  },
  auditLog: {
    findMany: vi.fn(async ({ where, skip = 0, take = 50 }: any = {}) => {
      let list = [...mockAuditLogs];
      if (where?.actorId) {
        list = list.filter((l) => l.actorId === where.actorId);
      }
      if (where?.entityType?.contains) {
        list = list.filter((l) =>
          l.entityType.toLowerCase().includes(where.entityType.contains.toLowerCase())
        );
      }
      if (where?.action?.contains) {
        list = list.filter((l) =>
          l.action.toLowerCase().includes(where.action.contains.toLowerCase())
        );
      }
      list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return list.slice(skip, skip + take);
    }),
    count: vi.fn(async ({ where }: any = {}) => {
      let list = [...mockAuditLogs];
      if (where?.actorId) {
        list = list.filter((l) => l.actorId === where.actorId);
      }
      return list.length;
    }),
    create: vi.fn(async ({ data }: { data: any }) => {
      const id = data.id || crypto.randomUUID();
      const log = {
        id,
        actorId: data.actorId || null,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        before: data.before || null,
        after: data.after || null,
        ip: data.ip || null,
        createdAt: new Date(),
      };
      mockAuditLogs.push(log);
      return { ...log };
    }),
  },
  $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => {
    return cb(mockDb);
  }),
  $disconnect: vi.fn(async () => {}),
};

vi.mock('../src/config/db', () => ({
  db: mockDb,
}));
