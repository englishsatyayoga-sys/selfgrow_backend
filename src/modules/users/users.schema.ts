import { z } from 'zod';

export const getUserByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid user ID format'),
  }),
});

export const anonymizeUserSchema = z.object({
  body: z.object({
    reason: z.string().max(500).optional(),
    confirmation: z.literal(true, {
      errorMap: () => ({ message: 'You must confirm account deletion / anonymization' }),
    }),
  }),
});

export type GetUserByIdParams = z.infer<typeof getUserByIdSchema>['params'];
export type AnonymizeUserInput = z.infer<typeof anonymizeUserSchema>['body'];


