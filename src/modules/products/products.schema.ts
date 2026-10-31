import { z } from 'zod';
import { localizedTextSchema } from '../../utils/localized';
import { paginationQuerySchema } from '../../utils/pagination';

export const createProductSchema = z.object({
  body: z.object({
    slug: z
      .string()
      .trim()
      .min(3)
      .max(100)
      .regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase letters, numbers, and hyphens'),
    name: localizedTextSchema,
    description: localizedTextSchema,
    assessmentId: z.string().uuid(),
    priceInPaise: z.number().int().min(0, 'Price in paise cannot be negative').default(0),
    currency: z.string().length(3).default('INR'),
    autoRelease: z.boolean().default(true),
  }),
});

export const updateProductSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    name: localizedTextSchema.optional(),
    description: localizedTextSchema.optional(),
    priceInPaise: z.number().int().min(0).optional(),
    currency: z.string().length(3).optional(),
    autoRelease: z.boolean().optional(),
    isActive: z.boolean().optional(),
  }),
});

export const productIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const productSlugParamSchema = z.object({
  params: z.object({
    slug: z.string().min(1),
  }),
  query: z.object({
    lang: z.enum(['en', 'hi']).optional().default('en'),
  }),
});

export const listPublicProductsQuerySchema = z.object({
  query: paginationQuerySchema.extend({
    lang: z.enum(['en', 'hi']).optional().default('en'),
  }),
});

export const listAdminProductsQuerySchema = z.object({
  query: paginationQuerySchema.extend({
    isActive: z
      .enum(['true', 'false'])
      .transform((val) => val === 'true')
      .optional(),
  }),
});

export type CreateProductInput = z.infer<typeof createProductSchema>['body'];
export type UpdateProductInput = z.infer<typeof updateProductSchema>['body'];
export type ListPublicProductsQuery = z.infer<typeof listPublicProductsQuerySchema>['query'];
export type ListAdminProductsQuery = z.infer<typeof listAdminProductsQuerySchema>['query'];

