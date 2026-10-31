import { db, isDbOnline } from '../../config/db';
import { ApiError } from '../../utils/ApiError';
import { scoringService } from '../scoring/scoring.service';
import { pickLocale, SupportedLocale } from '../../utils/localized';
import { sanitizeText } from '../../utils/sanitize';
import { getPaginationParams, createPaginatedResponse } from '../../utils/pagination';
import { StartAttemptInput, SaveAnswersInput, ListMyAttemptsQuery } from './attempts.schema';
import { AttemptStatus, QuestionType, Language } from '@prisma/client';
import { FALLBACK_PRODUCTS_DB, inMemoryAttempts } from '../products/products.fallback';

export class AttemptsService {
  async startAttempt(input: StartAttemptInput, userId: string) {
    let product: any = null;

    if (isDbOnline()) {
      try {
        product = await db.product.findUnique({
          where: { id: input.productId },
          include: {
            assessment: {
              include: {
                questions: {
                  where: { isActive: true },
                  include: {
                    options: {
                      where: { isActive: true },
                      orderBy: { order: 'asc' },
                    },
                  },
                  orderBy: { order: 'asc' },
                },
              },
            },
          },
        });
      } catch {
        // Fall back
      }
    }

    if (!product) {
      // Look up in fallback products by id or slug
      const found = FALLBACK_PRODUCTS_DB.find(
        (p) =>
          p.id === input.productId ||
          p.slug === input.productId ||
          input.productId.includes(p.slug) ||
          p.slug.includes(input.productId.replace(/^prod_/, ''))
      ) || FALLBACK_PRODUCTS_DB[0];
      product = found;
    }

    if (!product || !product.isActive || !product.assessment || !product.assessment.isActive) {
      throw ApiError.notFound('Product or assessment not available', 'PRODUCT_NOT_AVAILABLE');
    }

    // Try checking existing in-progress attempt in DB or in-memory
    if (isDbOnline()) {
      try {
        const existingAttempt = await db.attempt.findFirst({
          where: {
            userId,
            productId: product.id,
            status: AttemptStatus.IN_PROGRESS,
          },
        });

        if (existingAttempt) {
          if (existingAttempt.expiresAt && existingAttempt.expiresAt.getTime() < Date.now()) {
            await db.attempt.update({
              where: { id: existingAttempt.id },
              data: { status: AttemptStatus.EXPIRED },
            });
          } else {
            return existingAttempt;
          }
        }
      } catch {
        // DB error, continue to in-memory check
      }
    }

    // Check in-memory attempts
    for (const att of inMemoryAttempts.values()) {
      if (
        att.userId === userId &&
        (att.productId === product.id || att.productId === input.productId) &&
        att.status === AttemptStatus.IN_PROGRESS
      ) {
        if (att.expiresAt && new Date(att.expiresAt).getTime() < Date.now()) {
          att.status = AttemptStatus.EXPIRED;
        } else {
          return att;
        }
      }
    }

    const assessment = product.assessment;
    const now = new Date();
    const expiresAt = assessment.timeLimitSeconds
      ? new Date(now.getTime() + assessment.timeLimitSeconds * 1000)
      : null;

    // Snapshot questions and options structure
    const snapshot = {
      assessmentId: assessment.id,
      assessmentSlug: assessment.slug,
      kind: assessment.kind,
      version: assessment.version || 1,
      timeLimitSeconds: assessment.timeLimitSeconds,
      questions: assessment.questions.map((q: any) => ({
        id: q.id,
        order: q.order,
        section: q.section,
        type: q.type,
        text: q.text,
        isRequired: q.isRequired,
        maxLength: q.maxLength,
        dimension: q.dimension,
        options: (q.options || []).map((o: any) => ({
          id: o.id,
          order: o.order,
          label: o.label,
          score: o.score,
        })),
      })),
    };

    const locale: SupportedLocale = String(input.language || 'EN').toLowerCase() as SupportedLocale;
    const clientQuestions = (snapshot.questions || []).map((q: any) => ({
      id: q.id,
      order: q.order,
      section: q.section,
      type: q.type,
      text: pickLocale(q.text, locale),
      isRequired: q.isRequired,
      maxLength: q.maxLength,
      options: (q.options || []).map((o: any) => ({
        id: o.id,
        order: o.order,
        label: pickLocale(o.label, locale),
      })),
    }));

    if (isDbOnline()) {
      try {
        const created = await db.attempt.create({
          data: {
            userId,
            productId: product.id,
            assessmentId: assessment.id,
            assessmentVersion: assessment.version || 1,
            language: input.language || Language.EN,
            status: AttemptStatus.IN_PROGRESS,
            startedAt: now,
            expiresAt,
            snapshot,
          },
        });
        return {
          ...created,
          questions: clientQuestions,
          savedResponses: [],
          remainingTimeSeconds: assessment.timeLimitSeconds,
        };
      } catch {}
    }

    // In-memory attempt store for local offline dev
    const fallbackAttempt = {
      id: `att_${Date.now()}`,
      userId,
      productId: product.id,
      assessmentId: assessment.id,
      assessmentVersion: assessment.version || 1,
      language: input.language || Language.EN,
      status: AttemptStatus.IN_PROGRESS,
      startedAt: now,
      expiresAt,
      snapshot,
      responses: [],
      scoreSummary: null,
      questions: clientQuestions,
      savedResponses: [],
      remainingTimeSeconds: assessment.timeLimitSeconds,
    };
    inMemoryAttempts.set(fallbackAttempt.id, fallbackAttempt);
    return fallbackAttempt;
  }

  async getAttemptById(id: string, userId: string) {
    let attempt: any = null;

    if (isDbOnline()) {
      try {
        attempt = await db.attempt.findUnique({
          where: { id },
          include: {
            responses: {
              select: {
                questionId: true,
                selectedOptionIds: true,
                textAnswer: true,
                answeredAt: true,
              },
            },
          },
        });
      } catch {
        // Fall through to inMemoryAttempts
      }
    }

    if (!attempt) {
      attempt = inMemoryAttempts.get(id);
    }

    // Ownership check in service layer (404 not 403)
    if (!attempt || attempt.userId !== userId) {
      throw ApiError.notFound('Attempt not found', 'ATTEMPT_NOT_FOUND');
    }

    // Check timer expiration
    if (
      attempt.status === AttemptStatus.IN_PROGRESS &&
      attempt.expiresAt &&
      new Date(attempt.expiresAt).getTime() < Date.now()
    ) {
      try {
        await db.attempt.update({
          where: { id: attempt.id },
          data: { status: AttemptStatus.EXPIRED },
        });
      } catch {
        // In-memory update
      }
      attempt.status = AttemptStatus.EXPIRED;
    }

    const remainingTimeSeconds = attempt.expiresAt
      ? Math.max(0, Math.floor((new Date(attempt.expiresAt).getTime() - Date.now()) / 1000))
      : null;

    const locale: SupportedLocale = String(attempt.language || 'EN').toLowerCase() as SupportedLocale;
    const snapshot: any = attempt.snapshot || { questions: [] };

    // Format questions strictly without scores or internal scoring dimensions
    const clientQuestions = (snapshot.questions || []).map((q: any) => ({
      id: q.id,
      order: q.order,
      section: q.section,
      type: q.type,
      text: pickLocale(q.text, locale),
      isRequired: q.isRequired,
      maxLength: q.maxLength,
      options: (q.options || []).map((o: any) => ({
        id: o.id,
        order: o.order,
        label: pickLocale(o.label, locale),
      })),
    }));

    return {
      id: attempt.id,
      productId: attempt.productId,
      assessmentId: attempt.assessmentId,
      status: attempt.status,
      language: attempt.language,
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      remainingTimeSeconds,
      submittedAt: attempt.submittedAt,
      scoreSummary: attempt.status === AttemptStatus.SUBMITTED ? attempt.scoreSummary : undefined,
      questions: clientQuestions,
      savedResponses: attempt.responses || [],
    };
  }

  async saveAnswers(id: string, input: SaveAnswersInput, userId: string) {
    let attempt: any = null;
    let isDb = isDbOnline();

    if (isDb) {
      try {
        attempt = await db.attempt.findUnique({
          where: { id },
        });
      } catch {
        isDb = false;
      }
    }

    if (!attempt) {
      attempt = inMemoryAttempts.get(id);
      isDb = false;
    }

    if (!attempt || attempt.userId !== userId) {
      throw ApiError.notFound('Attempt not found', 'ATTEMPT_NOT_FOUND');
    }

    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw ApiError.badRequest('Cannot save answers on an inactive attempt', 'ATTEMPT_NOT_ACTIVE');
    }

    // Verify timer
    if (attempt.expiresAt && new Date(attempt.expiresAt).getTime() < Date.now()) {
      if (isDb) {
        try {
          await db.attempt.update({
            where: { id: attempt.id },
            data: { status: AttemptStatus.EXPIRED },
          });
        } catch {}
      }
      attempt.status = AttemptStatus.EXPIRED;
      throw ApiError.badRequest('Attempt has expired', 'ATTEMPT_EXPIRED');
    }

    const snapshot: any = attempt.snapshot || { questions: [] };
    const questionMap = new Map<string, any>();
    for (const q of snapshot.questions || []) {
      questionMap.set(q.id, q);
    }

    // Validate each answer against the question constraints
    const sanitizedAnswers = input.answers.map((ans) => {
      const question = questionMap.get(ans.questionId);
      if (!question) {
        throw ApiError.badRequest(
          `Question ${ans.questionId} does not belong to this assessment`,
          'INVALID_QUESTION'
        );
      }

      const validOptionIds = new Set((question.options || []).map((o: any) => o.id));

      if (question.type === QuestionType.SINGLE_CHOICE) {
        if (ans.selectedOptionIds && ans.selectedOptionIds.length > 1) {
          throw ApiError.badRequest(
            `Single choice question accepts at most one option`,
            'INVALID_ANSWER'
          );
        }
        for (const optId of ans.selectedOptionIds || []) {
          if (!validOptionIds.has(optId)) {
            throw ApiError.badRequest(`Invalid option ID for question`, 'INVALID_OPTION');
          }
        }
        return {
          questionId: ans.questionId,
          selectedOptionIds: ans.selectedOptionIds || [],
          textAnswer: null,
          timeTakenMs: ans.timeTakenMs || null,
        };
      }

      if (question.type === QuestionType.MULTI_CHOICE) {
        for (const optId of ans.selectedOptionIds || []) {
          if (!validOptionIds.has(optId)) {
            throw ApiError.badRequest(`Invalid option ID for question`, 'INVALID_OPTION');
          }
        }
        return {
          questionId: ans.questionId,
          selectedOptionIds: ans.selectedOptionIds || [],
          textAnswer: null,
          timeTakenMs: ans.timeTakenMs || null,
        };
      }

      if (question.type === QuestionType.TEXT) {
        if (ans.selectedOptionIds && ans.selectedOptionIds.length > 0) {
          throw ApiError.badRequest(`Text question cannot have selected options`, 'INVALID_ANSWER');
        }
        const cleanedText = sanitizeText(ans.textAnswer, question.maxLength);
        return {
          questionId: ans.questionId,
          selectedOptionIds: [],
          textAnswer: cleanedText,
          timeTakenMs: ans.timeTakenMs || null,
        };
      }

      return {
        questionId: ans.questionId,
        selectedOptionIds: ans.selectedOptionIds || [],
        textAnswer: ans.textAnswer || null,
        timeTakenMs: ans.timeTakenMs || null,
      };
    });

    if (isDb) {
      try {
        await db.$transaction(async (tx: any) => {
          for (const ans of sanitizedAnswers) {
            await tx.response.upsert({
              where: {
                attemptId_questionId: {
                  attemptId: id,
                  questionId: ans.questionId,
                },
              },
              create: {
                attemptId: id,
                questionId: ans.questionId,
                selectedOptionIds: ans.selectedOptionIds,
                textAnswer: ans.textAnswer,
                timeTakenMs: ans.timeTakenMs,
                answeredAt: new Date(),
              },
              update: {
                selectedOptionIds: ans.selectedOptionIds,
                textAnswer: ans.textAnswer,
                timeTakenMs: ans.timeTakenMs,
                answeredAt: new Date(),
              },
            });
          }
        });
        return { savedCount: sanitizedAnswers.length };
      } catch {
        // Fall back to in-memory response saving
      }
    }

    // In-memory response saving
    if (!attempt.responses) attempt.responses = [];
    for (const ans of sanitizedAnswers) {
      const idx = attempt.responses.findIndex((r: any) => r.questionId === ans.questionId);
      if (idx >= 0) {
        attempt.responses[idx] = { ...ans, answeredAt: new Date() };
      } else {
        attempt.responses.push({ ...ans, answeredAt: new Date() });
      }
    }

    return { savedCount: sanitizedAnswers.length };
  }

  async submitAttempt(id: string, userId: string) {
    let attempt: any = null;
    let isDb = isDbOnline();

    if (isDb) {
      try {
        attempt = await db.attempt.findUnique({
          where: { id },
          include: {
            responses: true,
          },
        });
      } catch {
        isDb = false;
      }
    }

    if (!attempt) {
      attempt = inMemoryAttempts.get(id);
      isDb = false;
    }

    if (!attempt || attempt.userId !== userId) {
      throw ApiError.notFound('Attempt not found', 'ATTEMPT_NOT_FOUND');
    }

    if (attempt.status === AttemptStatus.SUBMITTED) {
      throw ApiError.badRequest('Attempt has already been submitted', 'ALREADY_SUBMITTED');
    }

    // Verify timer
    if (attempt.expiresAt && new Date(attempt.expiresAt).getTime() < Date.now()) {
      if (isDb) {
        try {
          await db.attempt.update({
            where: { id: attempt.id },
            data: { status: AttemptStatus.EXPIRED },
          });
        } catch {}
      }
      attempt.status = AttemptStatus.EXPIRED;
      throw ApiError.badRequest('Attempt has expired and cannot be submitted', 'ATTEMPT_EXPIRED');
    }

    const snapshot: any = attempt.snapshot || { questions: [] };
    const questions: any[] = snapshot.questions || [];
    const responseMap = new Map<string, any>();
    for (const r of attempt.responses || []) {
      responseMap.set(r.questionId, r);
    }

    // Validate completeness: all required questions must have valid responses
    for (const q of questions) {
      if (q.isRequired) {
        const resp = responseMap.get(q.id);
        if (!resp) {
          throw ApiError.badRequest(
            `Please answer all required questions before submitting`,
            'INCOMPLETE_ATTEMPT'
          );
        }

        if (q.type === QuestionType.SINGLE_CHOICE || q.type === QuestionType.MULTI_CHOICE) {
          if (!resp.selectedOptionIds || resp.selectedOptionIds.length === 0) {
            throw ApiError.badRequest(
              `Please answer all required questions before submitting`,
              'INCOMPLETE_ATTEMPT'
            );
          }
        } else if (q.type === QuestionType.TEXT) {
          if (!resp.textAnswer || resp.textAnswer.trim().length === 0) {
            throw ApiError.badRequest(
              `Please answer all required questions before submitting`,
              'INCOMPLETE_ATTEMPT'
            );
          }
        }
      }
    }

    // Run scoring engine
    const scoreSummary = scoringService.calculateScore(
      snapshot.assessmentSlug || snapshot.kind,
      questions,
      attempt.responses || []
    );

    if (isDb) {
      try {
        const submittedAttempt = await db.attempt.update({
          where: { id: attempt.id },
          data: {
            status: AttemptStatus.SUBMITTED,
            submittedAt: new Date(),
            scoreSummary: scoreSummary as any,
          },
        });

        return {
          id: submittedAttempt.id,
          status: submittedAttempt.status,
          submittedAt: submittedAttempt.submittedAt,
          scoreSummary,
        };
      } catch {
        // Fall back to in-memory state
      }
    }

    attempt.status = AttemptStatus.SUBMITTED;
    attempt.submittedAt = new Date();
    attempt.scoreSummary = scoreSummary;

    return {
      id: attempt.id,
      status: attempt.status,
      submittedAt: attempt.submittedAt,
      scoreSummary,
    };
  }

  async listMyAttempts(query: ListMyAttemptsQuery, userId: string) {
    const { page, limit, skip, take } = getPaginationParams(query);

    if (isDbOnline()) {
      try {
        const [items, total] = await Promise.all([
          db.attempt.findMany({
            where: { userId },
            skip,
            take,
            include: {
              product: {
                select: {
                  id: true,
                  slug: true,
                  name: true,
                  priceInPaise: true,
                  currency: true,
                },
              },
              assessment: {
                select: {
                  id: true,
                  slug: true,
                  title: true,
                  kind: true,
                },
              },
            },
            orderBy: { startedAt: 'desc' },
          }),
          db.attempt.count({ where: { userId } }),
        ]);

        const formattedItems = items.map((a) => {
          const locale = a.language.toLowerCase() as SupportedLocale;
          return {
            id: a.id,
            productId: a.productId,
            productName: pickLocale(a.product.name as any, locale),
            productSlug: a.product.slug,
            assessmentTitle: pickLocale(a.assessment.title as any, locale),
            assessmentKind: a.assessment.kind,
            language: a.language,
            status: a.status,
            startedAt: a.startedAt,
            expiresAt: a.expiresAt,
            submittedAt: a.submittedAt,
            hasScore: a.scoreSummary !== null,
          };
        });

        return createPaginatedResponse(formattedItems, total, page, limit);
      } catch {
        // Fall back to in-memory list
      }
    }

    // In-memory fallback
    const userAttempts = Array.from(inMemoryAttempts.values()).filter((a) => a.userId === userId);
    const paginated = userAttempts.slice(skip, skip + take).map((a) => {
      const locale = (a.language || 'en').toLowerCase() as SupportedLocale;
      const product =
        FALLBACK_PRODUCTS_DB.find((p) => p.id === a.productId || p.slug === a.productId) ||
        FALLBACK_PRODUCTS_DB[0];
      return {
        id: a.id,
        productId: a.productId,
        productName: pickLocale(product.name as any, locale),
        productSlug: product.slug,
        assessmentTitle: pickLocale(product.assessment.title as any, locale),
        assessmentKind: product.assessment.kind,
        language: a.language,
        status: a.status,
        startedAt: a.startedAt,
        expiresAt: a.expiresAt,
        submittedAt: a.submittedAt,
        hasScore: Boolean(a.scoreSummary),
      };
    });
    return createPaginatedResponse(paginated, userAttempts.length, page, limit);
  }
}

export const attemptsService = new AttemptsService();

