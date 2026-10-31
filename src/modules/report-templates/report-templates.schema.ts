import { z } from 'zod';
import { paginationQuerySchema } from '../../utils/pagination';

export const createReportTemplateSchema = z.object({
  body: z.object({
    name: z.string().trim().min(3).max(100),
    assessmentId: z.string().uuid(),
    systemPrompt: z.string().min(10),
    userPromptTemplate: z.string().min(10),
    outputSchema: z.record(z.any()),
    layout: z.record(z.any()),
  }),
});

export const createTemplateVersionSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    name: z.string().trim().min(3).max(100).optional(),
    systemPrompt: z.string().min(10),
    userPromptTemplate: z.string().min(10),
    outputSchema: z.record(z.any()),
    layout: z.record(z.any()),
  }),
});

export const templateIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const listTemplatesQuerySchema = z.object({
  query: paginationQuerySchema.extend({
    assessmentId: z.string().uuid().optional(),
    isActive: z
      .enum(['true', 'false'])
      .transform((val) => val === 'true')
      .optional(),
  }),
});

export type CreateReportTemplateInput = z.infer<typeof createReportTemplateSchema>['body'];
export type CreateTemplateVersionInput = z.infer<typeof createTemplateVersionSchema>['body'];
export type ListTemplatesQuery = z.infer<typeof listTemplatesQuerySchema>['query'];

