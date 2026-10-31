import { z } from 'zod';
import { Language } from '@prisma/client';
import { paginationQuerySchema } from '../../utils/pagination';

export const startAttemptSchema = z.object({
  body: z.object({
    productId: z.string().min(1, 'Product ID is required'),
    language: z.nativeEnum(Language).optional().default(Language.EN),
  }),
});

export const answerItemSchema = z.object({
  questionId: z.string().min(1),
  selectedOptionIds: z.array(z.string().min(1)).optional().default([]),
  textAnswer: z.string().optional(),
  timeTakenMs: z.number().int().min(0).optional(),
});

export const saveAnswersSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    answers: z.array(answerItemSchema).min(1, 'At least one answer must be provided'),
  }),
});

export const attemptIdParamSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export const listMyAttemptsQuerySchema = z.object({
  query: paginationQuerySchema,
});

export type StartAttemptInput = z.infer<typeof startAttemptSchema>['body'];
export type AnswerItemInput = z.infer<typeof answerItemSchema>;
export type SaveAnswersInput = z.infer<typeof saveAnswersSchema>['body'];
export type ListMyAttemptsQuery = z.infer<typeof listMyAttemptsQuerySchema>['query'];

