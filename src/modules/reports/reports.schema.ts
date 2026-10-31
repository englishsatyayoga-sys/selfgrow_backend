import { z } from 'zod';
import { paginationQuerySchema } from '../../utils/pagination';

export const reportIdParamSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Report ID is required'),
  }),
});

export const listMyReportsQuerySchema = z.object({
  query: paginationQuerySchema,
});

export const regenerateReportSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Report ID is required'),
  }),
  body: z.object({
    reason: z.string().trim().min(3, 'Regeneration reason is required'),
  }),
});

export const standardReportContentSchema = z.object({
  executiveSummary: z.string().min(10),
  overallScoreSummary: z.string().min(10),
  dimensionAnalyses: z.array(
    z.object({
      dimension: z.string(),
      score: z.number(),
      analysis: z.string(),
      strengths: z.array(z.string()),
      areasForImprovement: z.array(z.string()),
    })
  ),
  recommendations: z.array(z.string()),
  actionPlan: z.array(z.string()),
});

export const adminListReportsQuerySchema = z.object({
  query: paginationQuerySchema.extend({
    status: z.enum(['QUEUED', 'GENERATING', 'GENERATED', 'PENDING_REVIEW', 'RELEASED', 'FAILED', 'REJECTED']).optional(),
    language: z.enum(['EN', 'HI']).optional(),
  }),
});

export const updateReportContentSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid report ID'),
  }),
  body: z.object({
    content: z.record(z.any()),
    reason: z.string().trim().min(3, 'Edit reason is required'),
  }),
});

export const rejectReportSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid report ID'),
  }),
  body: z.object({
    reason: z.string().trim().min(3, 'Rejection reason is required'),
  }),
});

export type ListMyReportsQuery = z.infer<typeof listMyReportsQuerySchema>['query'];
export type AdminListReportsQuery = z.infer<typeof adminListReportsQuerySchema>['query'];
export type RegenerateReportInput = z.infer<typeof regenerateReportSchema>['body'];
export type UpdateReportContentInput = z.infer<typeof updateReportContentSchema>['body'];
export type RejectReportInput = z.infer<typeof rejectReportSchema>['body'];
export type StandardReportContent = z.infer<typeof standardReportContentSchema>;

