import { db, isDbOnline } from '../../config/db';
import { ApiError } from '../../utils/ApiError';
import { recordAudit } from '../audit/audit.service';
import { getPaginationParams, createPaginatedResponse } from '../../utils/pagination';
import { CreateAssessmentInput, UpdateAssessmentInput, ListAssessmentsQuery } from './assessments.schema';
import { FALLBACK_PRODUCTS_DB } from '../products/products.fallback';

export class AssessmentsService {
  async listAssessments(query: ListAssessmentsQuery) {
    const { page, limit, skip, take } = getPaginationParams(query);

    if (isDbOnline()) {
      try {
        const where: any = {};
        if (query.isActive !== undefined) {
          where.isActive = query.isActive;
        }

        const [items, total] = await Promise.all([
          db.assessment.findMany({
            where,
            skip,
            take,
            orderBy: { createdAt: 'desc' },
          }),
          db.assessment.count({ where }),
        ]);

        return createPaginatedResponse(items, total, page, limit);
      } catch {}
    }

    const fallbackAssessments = FALLBACK_PRODUCTS_DB.map((p) => p.assessment);
    const paginated = fallbackAssessments.slice(skip, skip + take);
    return createPaginatedResponse(paginated, fallbackAssessments.length, page, limit);
  }

  async getAssessmentById(id: string) {
    if (isDbOnline()) {
      try {
        const assessment = await db.assessment.findUnique({
          where: { id },
          include: {
            questions: {
              include: {
                options: {
                  orderBy: { order: 'asc' },
                },
              },
              orderBy: { order: 'asc' },
            },
          },
        });

        if (assessment) return assessment;
      } catch {}
    }

    const fallback = FALLBACK_PRODUCTS_DB.find(
      (p) => p.assessment.id === id || p.assessment.slug === id || p.slug === id
    )?.assessment;

    if (!fallback) {
      throw ApiError.notFound('Assessment not found', 'ASSESSMENT_NOT_FOUND');
    }

    return fallback;
  }

  async createAssessment(
    input: CreateAssessmentInput,
    actorId?: string,
    ip?: string
  ) {
    const existing = await db.assessment.findUnique({
      where: { slug: input.slug },
    });

    if (existing) {
      throw ApiError.conflict('Assessment with this slug already exists', 'SLUG_EXISTS');
    }

    return db.$transaction(async (tx: any) => {
      const assessment = await tx.assessment.create({
        data: {
          slug: input.slug,
          title: input.title,
          description: input.description,
          kind: input.kind,
          timeLimitSeconds: input.timeLimitSeconds || null,
          version: 1,
          isActive: true,
        },
      });

      await recordAudit(tx, {
        actorId,
        action: 'CREATE_ASSESSMENT',
        entityType: 'Assessment',
        entityId: assessment.id,
        after: assessment,
        ip,
      });

      return assessment;
    });
  }

  async updateAssessment(
    id: string,
    input: UpdateAssessmentInput,
    actorId?: string,
    ip?: string
  ) {
    const existing = await db.assessment.findUnique({
      where: { id },
    });

    if (!existing) {
      throw ApiError.notFound('Assessment not found', 'ASSESSMENT_NOT_FOUND');
    }

    return db.$transaction(async (tx: any) => {
      const updated = await tx.assessment.update({
        where: { id },
        data: {
          title: input.title !== undefined ? input.title : undefined,
          description: input.description !== undefined ? input.description : undefined,
          timeLimitSeconds: input.timeLimitSeconds !== undefined ? input.timeLimitSeconds : undefined,
          isActive: input.isActive !== undefined ? input.isActive : undefined,
        },
      });

      await recordAudit(tx, {
        actorId,
        action: 'UPDATE_ASSESSMENT',
        entityType: 'Assessment',
        entityId: id,
        before: existing,
        after: updated,
        ip,
      });

      return updated;
    });
  }

  async toggleActive(id: string, actorId?: string, ip?: string) {
    if (!isDbOnline()) {
      const fallback = FALLBACK_PRODUCTS_DB.find(
        (p) => p.assessment.id === id || p.assessment.slug === id || p.slug === id
      )?.assessment;
      if (!fallback) {
        throw ApiError.notFound('Assessment not found', 'ASSESSMENT_NOT_FOUND');
      }
      fallback.isActive = !fallback.isActive;
      return fallback;
    }

    const existing = await db.assessment.findUnique({
      where: { id },
    });

    if (!existing) {
      throw ApiError.notFound('Assessment not found', 'ASSESSMENT_NOT_FOUND');
    }

    return db.$transaction(async (tx: any) => {
      const updated = await tx.assessment.update({
        where: { id },
        data: {
          isActive: !existing.isActive,
        },
      });

      await recordAudit(tx, {
        actorId,
        action: 'TOGGLE_ASSESSMENT_ACTIVE',
        entityType: 'Assessment',
        entityId: id,
        before: { isActive: existing.isActive },
        after: { isActive: updated.isActive },
        ip,
      });

      return updated;
    });
  }
}

export const assessmentsService = new AssessmentsService();

