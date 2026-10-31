import { db } from '../../config/db';
import { ApiError } from '../../utils/ApiError';
import { recordAudit } from '../audit/audit.service';
import { CreateQuestionInput, UpdateQuestionInput, ReorderQuestionsInput } from './questions.schema';

export class QuestionsService {
  async createQuestion(
    assessmentId: string,
    input: CreateQuestionInput,
    actorId?: string,
    ip?: string
  ) {
    const assessment = await db.assessment.findUnique({
      where: { id: assessmentId },
    });

    if (!assessment) {
      throw ApiError.notFound('Assessment not found', 'ASSESSMENT_NOT_FOUND');
    }

    return db.$transaction(async (tx: any) => {
      const question = await tx.question.create({
        data: {
          assessmentId,
          order: input.order,
          section: input.section || null,
          type: input.type,
          text: input.text,
          isRequired: input.isRequired,
          maxLength: input.maxLength || null,
          dimension: input.dimension || null,
          isActive: true,
        },
      });

      if (input.options && input.options.length > 0) {
        await tx.option.createMany({
          data: input.options.map((opt) => ({
            questionId: question.id,
            order: opt.order,
            label: opt.label,
            score: opt.score,
            isActive: true,
          })),
        });
      }

      // Bump assessment version
      await tx.assessment.update({
        where: { id: assessmentId },
        data: { version: { increment: 1 } },
      });

      const fullQuestion = await tx.question.findUnique({
        where: { id: question.id },
        include: {
          options: {
            orderBy: { order: 'asc' },
          },
        },
      });

      await recordAudit(tx, {
        actorId,
        action: 'CREATE_QUESTION',
        entityType: 'Question',
        entityId: question.id,
        after: fullQuestion,
        ip,
      });

      return fullQuestion;
    });
  }

  async updateQuestion(
    id: string,
    input: UpdateQuestionInput,
    actorId?: string,
    ip?: string
  ) {
    const existing = await db.question.findUnique({
      where: { id },
      include: { options: true },
    });

    if (!existing) {
      throw ApiError.notFound('Question not found', 'QUESTION_NOT_FOUND');
    }

    return db.$transaction(async (tx: any) => {
      await tx.question.update({
        where: { id },
        data: {
          order: input.order,
          section: input.section !== undefined ? input.section : undefined,
          type: input.type,
          text: input.text,
          isRequired: input.isRequired,
          maxLength: input.maxLength !== undefined ? input.maxLength : undefined,
          dimension: input.dimension !== undefined ? input.dimension : undefined,
        },
      });

      // Replace options in the same transaction
      await tx.option.deleteMany({
        where: { questionId: id },
      });

      if (input.options && input.options.length > 0) {
        await tx.option.createMany({
          data: input.options.map((opt) => ({
            questionId: id,
            order: opt.order,
            label: opt.label,
            score: opt.score,
            isActive: true,
          })),
        });
      }

      // Bump assessment version on question/option edits
      await tx.assessment.update({
        where: { id: existing.assessmentId },
        data: { version: { increment: 1 } },
      });

      const updatedQuestion = await tx.question.findUnique({
        where: { id },
        include: {
          options: {
            orderBy: { order: 'asc' },
          },
        },
      });

      await recordAudit(tx, {
        actorId,
        action: 'UPDATE_QUESTION',
        entityType: 'Question',
        entityId: id,
        before: existing,
        after: updatedQuestion,
        ip,
      });

      return updatedQuestion;
    });
  }

  async reorderQuestions(
    assessmentId: string,
    input: ReorderQuestionsInput,
    actorId?: string,
    ip?: string
  ) {
    const assessment = await db.assessment.findUnique({
      where: { id: assessmentId },
    });

    if (!assessment) {
      throw ApiError.notFound('Assessment not found', 'ASSESSMENT_NOT_FOUND');
    }

    return db.$transaction(async (tx: any) => {
      for (const item of input.orders) {
        await tx.question.update({
          where: { id: item.id },
          data: { order: item.order },
        });
      }

      // Bump assessment version
      await tx.assessment.update({
        where: { id: assessmentId },
        data: { version: { increment: 1 } },
      });

      await recordAudit(tx, {
        actorId,
        action: 'REORDER_QUESTIONS',
        entityType: 'Assessment',
        entityId: assessmentId,
        after: input.orders,
        ip,
      });

      return { message: 'Questions reordered successfully' };
    });
  }

  async deactivateQuestion(id: string, actorId?: string, ip?: string) {
    const existing = await db.question.findUnique({
      where: { id },
    });

    if (!existing) {
      throw ApiError.notFound('Question not found', 'QUESTION_NOT_FOUND');
    }

    return db.$transaction(async (tx: any) => {
      // Soft-delete: set isActive to false
      const updated = await tx.question.update({
        where: { id },
        data: { isActive: false },
      });

      await tx.option.updateMany?.({
        where: { questionId: id },
        data: { isActive: false },
      });

      // Bump assessment version
      await tx.assessment.update({
        where: { id: existing.assessmentId },
        data: { version: { increment: 1 } },
      });

      await recordAudit(tx, {
        actorId,
        action: 'DEACTIVATE_QUESTION',
        entityType: 'Question',
        entityId: id,
        before: { isActive: existing.isActive },
        after: { isActive: false },
        ip,
      });

      return updated;
    });
  }
}

export const questionsService = new QuestionsService();

