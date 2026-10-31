import { z } from 'zod';
import { QuestionType } from '@prisma/client';
import { localizedTextSchema } from '../../utils/localized';

export const optionInputSchema = z.object({
  order: z.number().int().positive(),
  label: localizedTextSchema,
  score: z.number().int().default(0),
});

export const questionBaseSchema = z
  .object({
    order: z.number().int().positive(),
    section: z.string().trim().nullable().optional(),
    type: z.nativeEnum(QuestionType),
    text: localizedTextSchema,
    isRequired: z.boolean().default(true),
    maxLength: z.number().int().positive().nullable().optional(),
    dimension: z.string().trim().nullable().optional(),
    options: z.array(optionInputSchema).optional().default([]),
  })
  .superRefine((data, ctx) => {
    if (data.type === QuestionType.SINGLE_CHOICE || data.type === QuestionType.MULTI_CHOICE) {
      if (!data.options || data.options.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${data.type} questions require at least 2 options`,
          path: ['options'],
        });
      }
    } else if (data.type === QuestionType.TEXT) {
      if (data.options && data.options.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'TEXT questions must not have options',
          path: ['options'],
        });
      }
    }
  });

export const createQuestionSchema = z.object({
  params: z.object({
    assessmentId: z.string().uuid(),
  }),
  body: questionBaseSchema,
});

export const updateQuestionSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: questionBaseSchema,
});

export const reorderQuestionsSchema = z.object({
  params: z.object({
    assessmentId: z.string().uuid(),
  }),
  body: z.object({
    orders: z.array(
      z.object({
        id: z.string().uuid(),
        order: z.number().int().positive(),
      })
    ).min(1, 'At least one question order must be provided'),
  }),
});

export const questionIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export type CreateQuestionInput = z.infer<typeof createQuestionSchema>['body'];
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>['body'];
export type ReorderQuestionsInput = z.infer<typeof reorderQuestionsSchema>['body'];

