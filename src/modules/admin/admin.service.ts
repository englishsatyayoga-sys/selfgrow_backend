import { Response } from 'express';
import { db, isDbOnline } from '../../config/db';
import { ApiError } from '../../utils/ApiError';
import { getPaginationParams, createPaginatedResponse } from '../../utils/pagination';
import { recordAudit } from '../audit/audit.service';
import { pickLocale } from '../../utils/localized';
import { buildCsvRow } from '../../utils/csv';
import {
  ListUsersQuery,
  ListOrdersQuery,
  ExportOrdersQuery,
  ListAttemptsQuery,
  ListAuditLogsQuery,
} from './admin.schema';
import { OrderStatus, AttemptStatus, ReportStatus } from '@prisma/client';
import {
  mockUsersStore,
  mockOrdersStore,
  mockAttemptsStore,
  mockAuditLogsStore,
} from './admin.fallback';

export class AdminService {
  private dashboardCache = new Map<string, { data: any; expiresAt: number }>();
  private CACHE_TTL_MS = 15000; // 15 seconds cache

  // -------------------------------------------------------------
  // 1. USERS
  // -------------------------------------------------------------
  async listUsers(query: ListUsersQuery) {
    const { page, limit, skip, take } = getPaginationParams(query);

    if (!isDbOnline()) {
      let filtered = [...mockUsersStore];
      if (query.role) {
        filtered = filtered.filter((u) => u.role === query.role);
      }
      if (query.isActive !== undefined) {
        filtered = filtered.filter((u) => u.isActive === query.isActive);
      }
      if (query.search) {
        const s = query.search.toLowerCase();
        filtered = filtered.filter(
          (u) => u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s)
        );
      }
      const paginated = filtered.slice(skip, skip + take);
      return createPaginatedResponse(paginated, filtered.length, page, limit);
    }

    const where: any = {};

    if (query.role) {
      where.role = query.role;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      db.user.findMany({
        where,
        skip,
        take,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          preferredLanguage: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.user.count({ where }),
    ]);

    return createPaginatedResponse(items, total, page, limit);
  }

  async getUserDetail(userId: string) {
    if (!isDbOnline()) {
      const user = mockUsersStore.find((u) => u.id === userId);
      if (!user) {
        throw ApiError.notFound('User not found', 'USER_NOT_FOUND');
      }
      const userOrders = mockOrdersStore.filter((o) => o.userId === userId);
      const userAttempts = mockAttemptsStore.filter((a) => a.userId === userId);
      return {
        ...user,
        consentAcceptedAt: '2026-03-01T00:00:00.000Z',
        orders: userOrders,
        attempts: userAttempts,
      };
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        preferredLanguage: true,
        isActive: true,
        consentAcceptedAt: true,
        createdAt: true,
        updatedAt: true,
        orders: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            product: { select: { id: true, name: true, slug: true } },
          },
        },
        attempts: {
          take: 10,
          orderBy: { startedAt: 'desc' },
          include: {
            assessment: { select: { id: true, title: true, slug: true } },
          },
        },
      },
    });

    if (!user) {
      throw ApiError.notFound('User not found', 'USER_NOT_FOUND');
    }

    return user;
  }

  async updateUserStatus(
    userId: string,
    isActive: boolean,
    actorId: string,
    ip?: string | null
  ) {
    if (userId === actorId && !isActive) {
      throw ApiError.badRequest(
        'Admin cannot deactivate their own account',
        'CANNOT_DEACTIVATE_SELF'
      );
    }

    if (!isDbOnline()) {
      const user = mockUsersStore.find((u) => u.id === userId);
      if (!user) {
        throw ApiError.notFound('User not found', 'USER_NOT_FOUND');
      }
      user.isActive = isActive;
      user.updatedAt = new Date().toISOString();
      mockAuditLogsStore.unshift({
        id: `aud_${Date.now()}`,
        action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
        entityType: 'User',
        entityId: user.id,
        actorId,
        ipAddress: ip || '127.0.0.1',
        details: { isActive },
        createdAt: new Date().toISOString(),
      });
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        isActive: user.isActive,
      };
    }

    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw ApiError.notFound('User not found', 'USER_NOT_FOUND');
    }

    if (user.isActive === isActive) {
      return user;
    }

    return db.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: { isActive },
      });

      await recordAudit(tx, {
        actorId,
        action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
        entityType: 'User',
        entityId: user.id,
        before: { isActive: user.isActive },
        after: { isActive },
        ip,
      });

      return {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        isActive: updated.isActive,
      };
    });
  }

  // -------------------------------------------------------------
  // 2. ORDERS & PAYMENTS
  // -------------------------------------------------------------
  async listOrders(query: ListOrdersQuery) {
    const { page, limit, skip, take } = getPaginationParams(query);

    if (!isDbOnline()) {
      let filtered = [...mockOrdersStore];
      if (query.status) {
        filtered = filtered.filter((o) => o.status === query.status);
      }
      if (query.productId) {
        filtered = filtered.filter((o) => o.productId === query.productId);
      }
      if (query.search) {
        const s = query.search.toLowerCase();
        filtered = filtered.filter(
          (o) =>
            (o.razorpayOrderId && o.razorpayOrderId.toLowerCase().includes(s)) ||
            o.user.email.toLowerCase().includes(s) ||
            o.user.name.toLowerCase().includes(s)
        );
      }
      const mapped = filtered.slice(skip, skip + take).map((o) => ({
        id: o.id,
        amountInPaise: o.amountInPaise,
        currency: o.currency,
        status: o.status,
        razorpayOrderId: o.razorpayOrderId,
        createdAt: o.createdAt,
        paidAt: o.paidAt,
        user: o.user,
        product: o.product,
        report: o.report,
        paymentsCount: o.status === OrderStatus.PAID ? 1 : 0,
      }));
      return createPaginatedResponse(mapped, filtered.length, page, limit);
    }

    const where: any = {};

    if (query.status) {
      where.status = query.status as OrderStatus;
    }

    if (query.productId) {
      where.productId = query.productId;
    }

    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }

    if (query.search) {
      where.OR = [
        { razorpayOrderId: { contains: query.search, mode: 'insensitive' } },
        { user: { email: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      db.order.findMany({
        where,
        skip,
        take,
        include: {
          user: { select: { id: true, name: true, email: true } },
          product: { select: { id: true, name: true, slug: true, priceInPaise: true } },
          payments: { select: { id: true, status: true, amountInPaise: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.order.count({ where }),
    ]);

    const mapped = items.map((o) => ({
      id: o.id,
      amountInPaise: o.amountInPaise,
      currency: o.currency,
      status: o.status,
      razorpayOrderId: o.razorpayOrderId,
      createdAt: o.createdAt,
      paidAt: o.paidAt,
      user: o.user,
      product: o.product,
      paymentsCount: o.payments.length,
    }));

    return createPaginatedResponse(mapped, total, page, limit);
  }

  async getOrderDetail(orderId: string) {
    if (!isDbOnline()) {
      const order = mockOrdersStore.find((o) => o.id === orderId);
      if (!order) {
        throw ApiError.notFound('Order not found', 'ORDER_NOT_FOUND');
      }
      const attempt = mockAttemptsStore.find((a) => a.id === order.attemptId);
      return {
        ...order,
        attempt: attempt ? { ...attempt, assessment: attempt.assessment } : null,
        payments: order.status === OrderStatus.PAID ? [
          {
            id: `pay_${order.id}`,
            razorpayPaymentId: `pay_rp_${order.id}`,
            amountInPaise: order.amountInPaise,
            status: 'CAPTURED',
            method: 'upi',
            failureReason: null,
            createdAt: order.paidAt || order.createdAt,
          }
        ] : [],
        report: order.report ? { id: order.report.id, status: order.report.status, releasedAt: order.paidAt } : null,
      };
    }

    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        product: true,
        attempt: {
          include: {
            assessment: { select: { id: true, title: true, slug: true } },
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
        },
        report: {
          select: { id: true, status: true, pdfKey: true, releasedAt: true },
        },
      },
    });

    if (!order) {
      throw ApiError.notFound('Order not found', 'ORDER_NOT_FOUND');
    }

    return order;
  }

  async exportOrders(query: ExportOrdersQuery, res: Response) {
    const where: any = {};

    if (query.status) {
      where.status = query.status as OrderStatus;
    }

    if (query.productId) {
      where.productId = query.productId;
    }

    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }

    if (query.search) {
      where.OR = [
        { razorpayOrderId: { contains: query.search, mode: 'insensitive' } },
        { user: { email: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const orders = await db.order.findMany({
      where,
      include: {
        user: { select: { name: true, email: true } },
        product: { select: { name: true } },
        payments: { select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000, // Export up to 5000 records
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="orders-export.csv"');

    // Header row
    const headers = [
      'Order ID',
      'Date',
      'User Name',
      'User Email',
      'Product',
      'Amount (Paise)',
      'Currency',
      'Status',
      'Razorpay Order ID',
      'Payments Count',
    ];
    res.write(buildCsvRow(headers));

    // Data rows with formula injection safety
    for (const o of orders) {
      const productName = pickLocale(o.product.name as any, 'en');
      const row = [
        o.id,
        o.createdAt.toISOString(),
        o.user.name,
        o.user.email,
        productName,
        o.amountInPaise,
        o.currency,
        o.status,
        o.razorpayOrderId || '',
        o.payments.length,
      ];
      res.write(buildCsvRow(row));
    }

    res.end();
  }

  // -------------------------------------------------------------
  // 3. ATTEMPTS
  // -------------------------------------------------------------
  async listAttempts(query: ListAttemptsQuery) {
    const { page, limit, skip, take } = getPaginationParams(query);

    if (!isDbOnline()) {
      let filtered = [...mockAttemptsStore];
      if (query.status) {
        filtered = filtered.filter((a) => a.status === query.status);
      }
      if (query.assessmentId) {
        filtered = filtered.filter((a) => a.assessmentId === query.assessmentId);
      }
      if (query.productId) {
        filtered = filtered.filter((a) => a.productId === query.productId);
      }
      if (query.userId) {
        filtered = filtered.filter((a) => a.userId === query.userId);
      }
      const paginated = filtered.slice(skip, skip + take);
      return createPaginatedResponse(paginated, filtered.length, page, limit);
    }

    const where: any = {};

    if (query.status) {
      where.status = query.status as AttemptStatus;
    }
    if (query.assessmentId) {
      where.assessmentId = query.assessmentId;
    }
    if (query.productId) {
      where.productId = query.productId;
    }
    if (query.userId) {
      where.userId = query.userId;
    }

    const [items, total] = await Promise.all([
      db.attempt.findMany({
        where,
        skip,
        take,
        include: {
          user: { select: { id: true, name: true, email: true } },
          assessment: { select: { id: true, title: true, slug: true } },
          product: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { startedAt: 'desc' },
      }),
      db.attempt.count({ where }),
    ]);

    return createPaginatedResponse(items, total, page, limit);
  }

  async getAttemptDetail(attemptId: string) {
    if (!isDbOnline()) {
      const attempt = mockAttemptsStore.find((a) => a.id === attemptId);
      if (!attempt) {
        throw ApiError.notFound('Attempt not found', 'ATTEMPT_NOT_FOUND');
      }
      return {
        ...attempt,
        responses: [
          {
            questionId: 'q1',
            questionText: 'When facing an unexpected deadline shift, how do you typically respond?',
            sectionTitle: 'Behavioral Archetype',
            dimension: 'adaptability',
            questionType: 'SINGLE_CHOICE',
            selectedOptionIds: ['o1_1'],
            chosenOptions: [{ id: 'o1_1', label: 'Rapidly reorganize priorities and inform the team', score: 10 }],
            timeTakenMs: 14200,
          },
          {
            questionId: 'q2',
            questionText: 'How do you balance high-velocity execution with long-term strategic depth?',
            sectionTitle: 'Strategic Vision',
            dimension: 'vision',
            questionType: 'SINGLE_CHOICE',
            selectedOptionIds: ['o2_1'],
            chosenOptions: [{ id: 'o2_1', label: 'Establish modular sprint goals aligned with annual milestones', score: 10 }],
            timeTakenMs: 18500,
          },
        ],
      };
    }

    const attempt = await db.attempt.findUnique({
      where: { id: attemptId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        assessment: true,
        product: true,
        responses: true,
      },
    });

    if (!attempt) {
      throw ApiError.notFound('Attempt not found', 'ATTEMPT_NOT_FOUND');
    }

    const locale = attempt.language.toLowerCase() as 'en' | 'hi';
    const snapshot = (attempt.snapshot as any) || { questions: [] };
    const questionMap = new Map<string, any>();
    for (const q of snapshot.questions || []) {
      questionMap.set(q.id, q);
    }

    // Build readable responses view for customer support & review
    const readableResponses = attempt.responses.map((resp) => {
      const q = questionMap.get(resp.questionId);
      const chosenLabels: string[] = [];

      if (q && resp.selectedOptionIds && resp.selectedOptionIds.length > 0) {
        const optMap = new Map<string, any>();
        for (const opt of q.options || []) {
          optMap.set(opt.id, opt);
        }
        for (const optId of resp.selectedOptionIds) {
          const opt = optMap.get(optId);
          if (opt) {
            chosenLabels.push(pickLocale(opt.label, locale));
          }
        }
      }

      return {
        questionId: resp.questionId,
        order: q?.order,
        section: q?.section || 'General',
        type: q?.type,
        questionText: q ? pickLocale(q.text, locale) : 'Question text unavailable',
        selectedOptionLabels: chosenLabels,
        textAnswer: resp.textAnswer,
        answeredAt: resp.answeredAt,
        timeTakenMs: resp.timeTakenMs,
      };
    });

    readableResponses.sort((a, b) => (a.order || 0) - (b.order || 0));

    return {
      id: attempt.id,
      status: attempt.status,
      language: attempt.language,
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      submittedAt: attempt.submittedAt,
      scoreSummary: attempt.scoreSummary,
      user: attempt.user,
      assessment: {
        id: attempt.assessment.id,
        title: pickLocale(attempt.assessment.title as any, locale),
        slug: attempt.assessment.slug,
      },
      product: {
        id: attempt.product.id,
        name: pickLocale(attempt.product.name as any, locale),
        slug: attempt.product.slug,
      },
      responses: readableResponses,
    };
  }

  // -------------------------------------------------------------
  // 4. DASHBOARD (with in-memory cache)
  // -------------------------------------------------------------
  async getDashboardSummary(fromStr?: string, toStr?: string) {
    const cacheKey = `${fromStr || 'default'}:${toStr || 'default'}`;
    const cached = this.dashboardCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    if (!isDbOnline()) {
      const fallbackResult = {
        metrics: {
          totalRevenue: 499000,
          totalOrders: 10,
          paidOrders: 8,
          failedOrders: 1,
          freeReports: 1,
          paidReports: 8,
          newUsers: 14,
          pendingReviewReports: 0,
          failedReports: 0,
        },
        revenueTrend: [
          { date: '2026-10-25', amount: 99800 },
          { date: '2026-10-26', amount: 149700 },
          { date: '2026-10-27', amount: 49900 },
          { date: '2026-10-28', amount: 199600 },
          { date: '2026-10-29', amount: 0 },
        ],
        userTrend: [
          { date: '2026-10-25', count: 3 },
          { date: '2026-10-26', count: 5 },
          { date: '2026-10-27', count: 2 },
          { date: '2026-10-28', count: 4 },
        ],
        revenueByProduct: [
          { productId: '1', title: 'Personality & Leadership Dynamics', revenue: 249500, orderCount: 5 },
          { productId: '2', title: 'Career & Cognitive Aptitude', revenue: 159800, orderCount: 2 },
          { productId: '3', title: 'Emotional Resilience & EQ', revenue: 89700, orderCount: 1 },
        ],
        totalRevenue: 499000,
        ordersCount: 10,
        paidOrdersCount: 8,
        failedOrdersCount: 1,
        freeReportsCount: 1,
        paidReportsCount: 8,
        reportsPendingReview: 0,
        reportsFailed: 0,
        revenuePerProduct: [],
        revenuePerDay: [],
        newUsersPerDay: [],
      };
      return fallbackResult;
    }

    const now = new Date();
    const from = fromStr ? new Date(fromStr) : new Date(Date.now() - 30 * 24 * 3600 * 1000); // 30 days
    const to = toStr ? new Date(toStr) : now;

    const [
      orders,
      paidAggregation,
      allReports,
      newUsers,
      allProducts,
    ] = await Promise.all([
      db.order.findMany({
        where: { createdAt: { gte: from, lte: to } },
        select: {
          id: true,
          status: true,
          amountInPaise: true,
          productId: true,
          createdAt: true,
        },
      }),
      db.order.aggregate({
        where: {
          status: OrderStatus.PAID,
          createdAt: { gte: from, lte: to },
        },
        _sum: {
          amountInPaise: true,
        },
        _count: {
          id: true,
        },
      }),
      db.report.findMany({
        where: { createdAt: { gte: from, lte: to } },
        select: {
          id: true,
          status: true,
          order: { select: { amountInPaise: true } },
        },
      }),
      db.user.findMany({
        where: { createdAt: { gte: from, lte: to } },
        select: { id: true, createdAt: true },
      }),
      db.product.findMany({
        select: { id: true, name: true, slug: true },
      }),
    ]);

    const totalRevenue = paidAggregation._sum.amountInPaise || 0;
    const ordersCount = orders.length;
    const paidOrdersCount = paidAggregation._count.id || 0;
    const failedOrdersCount = orders.filter((o) => o.status === OrderStatus.FAILED).length;

    const freeReportsCount = allReports.filter((r) => r.order.amountInPaise === 0).length;
    const paidReportsCount = allReports.filter((r) => r.order.amountInPaise > 0).length;

    const reportsPendingReview = allReports.filter((r) => r.status === ReportStatus.PENDING_REVIEW).length;
    const reportsFailed = allReports.filter((r) => r.status === ReportStatus.FAILED).length;

    // Revenue per product
    const productMap = new Map<string, any>();
    for (const p of allProducts) {
      productMap.set(p.id, {
        productId: p.id,
        productName: pickLocale(p.name as any, 'en'),
        productSlug: p.slug,
        revenueInPaise: 0,
        ordersCount: 0,
      });
    }

    for (const o of orders) {
      if (o.status === OrderStatus.PAID) {
        const prod = productMap.get(o.productId);
        if (prod) {
          prod.revenueInPaise += o.amountInPaise;
          prod.ordersCount++;
        }
      }
    }
    const revenuePerProduct = Array.from(productMap.values());

    // Revenue per day & New users per day
    const revenueDayMap = new Map<string, { revenueInPaise: number; ordersCount: number }>();
    for (const o of orders) {
      if (o.status === OrderStatus.PAID) {
        const day = o.createdAt.toISOString().slice(0, 10);
        const curr = revenueDayMap.get(day) || { revenueInPaise: 0, ordersCount: 0 };
        curr.revenueInPaise += o.amountInPaise;
        curr.ordersCount++;
        revenueDayMap.set(day, curr);
      }
    }
    const revenuePerDay = Array.from(revenueDayMap.entries())
      .map(([date, val]) => ({ date, ...val }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const userDayMap = new Map<string, number>();
    for (const u of newUsers) {
      const day = u.createdAt.toISOString().slice(0, 10);
      userDayMap.set(day, (userDayMap.get(day) || 0) + 1);
    }
    const newUsersPerDay = Array.from(userDayMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const result = {
      metrics: {
        totalRevenue,
        totalOrders: ordersCount,
        paidOrders: paidOrdersCount,
        failedOrders: failedOrdersCount,
        freeReports: freeReportsCount,
        paidReports: paidReportsCount,
        newUsers: newUsers.length,
        pendingReviewReports: reportsPendingReview,
        failedReports: reportsFailed,
      },
      revenueTrend: revenuePerDay.map((r) => ({ date: r.date, amount: r.revenueInPaise })),
      userTrend: newUsersPerDay.map((u) => ({ date: u.date, count: u.count })),
      revenueByProduct: revenuePerProduct.map((p) => ({
        productId: p.productId,
        title: p.title,
        revenue: p.revenue,
        orderCount: p.ordersCount,
      })),
      totalRevenue,
      ordersCount,
      paidOrdersCount,
      failedOrdersCount,
      freeReportsCount,
      paidReportsCount,
      reportsPendingReview,
      reportsFailed,
      revenuePerProduct,
      revenuePerDay,
      newUsersPerDay,
    };

    // Store in cache for 15s
    this.dashboardCache.set(cacheKey, {
      data: result,
      expiresAt: Date.now() + this.CACHE_TTL_MS,
    });

    return result;
  }

  // -------------------------------------------------------------
  // 5. AUDIT LOGS
  // -------------------------------------------------------------
  async listAuditLogs(query: ListAuditLogsQuery) {
    const { page, limit, skip, take } = getPaginationParams(query);

    if (!isDbOnline()) {
      let filtered = [...mockAuditLogsStore];
      if (query.actorId) {
        filtered = filtered.filter((l) => l.actorId === query.actorId);
      }
      if (query.entityType) {
        const et = query.entityType.toLowerCase();
        filtered = filtered.filter((l) => l.entityType.toLowerCase().includes(et));
      }
      if (query.action) {
        const ac = query.action.toLowerCase();
        filtered = filtered.filter((l) => l.action.toLowerCase().includes(ac));
      }
      const paginated = filtered.slice(skip, skip + take);
      return createPaginatedResponse(paginated, filtered.length, page, limit);
    }

    const where: any = {};

    if (query.actorId) {
      where.actorId = query.actorId;
    }
    if (query.entityType) {
      where.entityType = { contains: query.entityType, mode: 'insensitive' };
    }
    if (query.action) {
      where.action = { contains: query.action, mode: 'insensitive' };
    }
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }

    const [items, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      db.auditLog.count({ where }),
    ]);

    return createPaginatedResponse(items, total, page, limit);
  }

  // -------------------------------------------------------------
  // 6. HEALTH / SYSTEM STATUS
  // -------------------------------------------------------------
  async getSystemStatus() {
    if (!isDbOnline()) {
      return {
        database: 'offline_fallback',
        latestReleasedReportAt: new Date().toISOString(),
        pendingReportsCount: 0,
        failedReportsCount: 0,
        uptimeSeconds: Math.floor(process.uptime()),
      };
    }

    const [latestReleasedReport, pendingReportsCount, failedReportsCount] = await Promise.all([
      db.report.findFirst({
        where: { status: ReportStatus.RELEASED },
        orderBy: { releasedAt: 'desc' },
        select: { releasedAt: true },
      }),
      db.report.count({
        where: { status: { in: [ReportStatus.QUEUED, ReportStatus.GENERATING] } },
      }),
      db.report.count({
        where: { status: ReportStatus.FAILED },
      }),
    ]);

    return {
      status: 'healthy',
      queue: {
        backlog: pendingReportsCount,
        failedJobs: failedReportsCount,
      },
      lastSuccessfulReportTime: latestReleasedReport?.releasedAt || null,
      system: {
        uptimeSeconds: Math.floor(process.uptime()),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
      },
    };
  }
}

export const adminService = new AdminService();
