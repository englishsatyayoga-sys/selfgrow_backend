import { z } from 'zod';
import { AssessmentKind } from '@prisma/client';
import { localizedTextSchema } from '../../utils/localized';
import { paginationQuerySchema } from '../../utils/pagination';

export const createAssessmentSchema = z.object({
  body: z.object({
    slug: z
      .string()
      .trim()
      .min(3)
      .max(100)
      .regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase letters, numbers, and hyphens'),
    title: localizedTextSchema,
    description: localizedTextSchema,
    kind: z.nativeEnum(AssessmentKind),
    timeLimitSeconds: z.number().int().positive().nullable().optional(),
  }),
});

export const updateAssessmentSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    title: localizedTextSchema.optional(),
    description: localizedTextSchema.optional(),
    timeLimitSeconds: z.number().int().positive().nullable().optional(),
    isActive: z.boolean().optional(),
  }),
});

export const getAssessmentParamsSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const listAssessmentsQuerySchema = z.object({
  query: paginationQuerySchema.extend({
    isActive: z
      .enum(['true', 'false'])
      .transform((val) => val === 'true')
      .optional(),
  }),
});

export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>['body'];
export type UpdateAssessmentInput = z.infer<typeof updateAssessmentSchema>['body'];
export type ListAssessmentsQuery = z.infer<typeof listAssessmentsQuerySchema>['query'];

