import { db, isDbOnline } from '../../config/db';
import { ApiError } from '../../utils/ApiError';
import { recordAudit } from '../audit/audit.service';
import { getPaginationParams, createPaginatedResponse } from '../../utils/pagination';
import {
  CreateReportTemplateInput,
  CreateTemplateVersionInput,
  ListTemplatesQuery,
} from './report-templates.schema';

const FALLBACK_TEMPLATES = [
  {
    id: 'tmpl_personality',
    assessmentId: 'a1',
    name: 'Personality Diagnostic Executive Template',
    version: 1,
    isActive: true,
    assessment: { id: 'a1', slug: 'personality-dynamics', title: { en: 'Personality & Leadership Dynamics' } },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'tmpl_career',
    assessmentId: 'a2',
    name: 'Career & Cognitive Aptitude Standard Template',
    version: 1,
    isActive: true,
    assessment: { id: 'a2', slug: 'career-aptitude', title: { en: 'Career & Cognitive Aptitude' } },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export class ReportTemplatesService {
  async listTemplates(query: ListTemplatesQuery) {
    const { page, limit, skip, take } = getPaginationParams(query);

    if (isDbOnline()) {
      try {
        const where: any = {};
        if (query.assessmentId) {
          where.assessmentId = query.assessmentId;
        }
        if (query.isActive !== undefined) {
          where.isActive = query.isActive;
        }

        const [items, total] = await Promise.all([
          db.reportTemplate.findMany({
            where,
            skip,
            take,
            include: {
              assessment: {
                select: { id: true, slug: true, title: true },
              },
            },
            orderBy: [{ assessmentId: 'asc' }, { version: 'desc' }],
          }),
          db.reportTemplate.count({ where }),
        ]);

        return createPaginatedResponse(items, total, page, limit);
      } catch {}
    }

    const filtered = FALLBACK_TEMPLATES.filter((t) => {
      if (query.assessmentId && t.assessmentId !== query.assessmentId) return false;
      if (query.isActive !== undefined && t.isActive !== query.isActive) return false;
      return true;
    });

    return createPaginatedResponse(filtered.slice(skip, skip + take), filtered.length, page, limit);
  }

  async getTemplateById(id: string) {
    if (isDbOnline()) {
      try {
        const template = await db.reportTemplate.findUnique({
          where: { id },
          include: {
            assessment: true,
          },
        });

        if (template) return template;
      } catch {}
    }

    const fallback = FALLBACK_TEMPLATES.find((t) => t.id === id) || FALLBACK_TEMPLATES[0];
    if (!fallback) {
      throw ApiError.notFound('Report template not found', 'TEMPLATE_NOT_FOUND');
    }

    return fallback;
  }

  async createTemplate(input: CreateReportTemplateInput, actorId?: string, ip?: string) {
    const assessment = await db.assessment.findUnique({
      where: { id: input.assessmentId },
    });

    if (!assessment) {
      throw ApiError.notFound('Assessment not found', 'ASSESSMENT_NOT_FOUND');
    }

    // Find highest version for this assessment
    const latest = await db.reportTemplate.findFirst({
      where: { assessmentId: input.assessmentId },
      orderBy: { version: 'desc' },
    });

    const nextVersion = latest ? latest.version + 1 : 1;

    return db.$transaction(async (tx: any) => {
      const template = await tx.reportTemplate.create({
        data: {
          name: input.name,
          assessmentId: input.assessmentId,
          version: nextVersion,
          isActive: true,
          systemPrompt: input.systemPrompt,
          userPromptTemplate: input.userPromptTemplate,
          outputSchema: input.outputSchema,
          layout: input.layout,
        },
      });

      await recordAudit(tx, {
        actorId,
        action: 'CREATE_REPORT_TEMPLATE',
        entityType: 'ReportTemplate',
        entityId: template.id,
        after: template,
        ip,
      });

      return template;
    });
  }

  async createVersion(id: string, input: CreateTemplateVersionInput, actorId?: string, ip?: string) {
    const existing = await db.reportTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      throw ApiError.notFound('Base report template not found', 'TEMPLATE_NOT_FOUND');
    }

    const latest = await db.reportTemplate.findFirst({
      where: { assessmentId: existing.assessmentId },
      orderBy: { version: 'desc' },
    });

    const nextVersion = latest ? latest.version + 1 : existing.version + 1;

    return db.$transaction(async (tx: any) => {
      const newVersion = await tx.reportTemplate.create({
        data: {
          name: input.name || existing.name,
          assessmentId: existing.assessmentId,
          version: nextVersion,
          isActive: true,
          systemPrompt: input.systemPrompt,
          userPromptTemplate: input.userPromptTemplate,
          outputSchema: input.outputSchema,
          layout: input.layout,
        },
      });

      await recordAudit(tx, {
        actorId,
        action: 'CREATE_TEMPLATE_VERSION',
        entityType: 'ReportTemplate',
        entityId: newVersion.id,
        before: { id: existing.id, version: existing.version },
        after: { id: newVersion.id, version: newVersion.version },
        ip,
      });

      return newVersion;
    });
  }

  async toggleActive(id: string, actorId?: string, ip?: string) {
    if (!isDbOnline()) {
      const existing = FALLBACK_TEMPLATES.find((t) => t.id === id);
      if (!existing) {
        throw ApiError.notFound('Report template not found', 'TEMPLATE_NOT_FOUND');
      }
      existing.isActive = !existing.isActive;
      return existing;
    }

    const existing = await db.reportTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      throw ApiError.notFound('Report template not found', 'TEMPLATE_NOT_FOUND');
    }

    return db.$transaction(async (tx: any) => {
      const updated = await tx.reportTemplate.update({
        where: { id },
        data: { isActive: !existing.isActive },
      });

      await recordAudit(tx, {
        actorId,
        action: 'TOGGLE_TEMPLATE_ACTIVE',
        entityType: 'ReportTemplate',
        entityId: id,
        before: { isActive: existing.isActive },
        after: { isActive: updated.isActive },
        ip,
      });

      return updated;
    });
  }
}

export const reportTemplatesService = new ReportTemplatesService();

