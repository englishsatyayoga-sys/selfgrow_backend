import { db, isDbOnline } from '../../config/db';
import { ApiError } from '../../utils/ApiError';
import { recordAudit } from '../audit/audit.service';
import { getPaginationParams, createPaginatedResponse } from '../../utils/pagination';
import { mapProductToPublicDTO } from './products.dto';
import { FALLBACK_PRODUCTS_DB } from './products.fallback';
import {
  CreateProductInput,
  UpdateProductInput,
  ListPublicProductsQuery,
  ListAdminProductsQuery,
} from './products.schema';

export class ProductsService {
  // Public - active only, sanitized DTO, localized
  async listPublicProducts(query: ListPublicProductsQuery) {
    const { page, limit, skip, take } = getPaginationParams(query);
    const lang = query.lang || 'en';

    try {
      const where = { isActive: true };

      const [items, total] = await Promise.all([
        db.product.findMany({
          where,
          skip,
          take,
          include: {
            assessment: {
              include: {
                questions: {
                  where: { isActive: true },
                  select: { id: true },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        db.product.count({ where }),
      ]);

      const dtos = items.map((product) => mapProductToPublicDTO(product, lang));
      return createPaginatedResponse(dtos, total, page, limit);
    } catch {
      // Offline / Local DB fallback
      const dtos = FALLBACK_PRODUCTS_DB.map((p) => mapProductToPublicDTO(p as any, lang));
      return createPaginatedResponse(dtos, dtos.length, page, limit);
    }
  }

  async getPublicProductBySlug(slug: string, lang: 'en' | 'hi' = 'en') {
    try {
      const product = await db.product.findUnique({
        where: { slug },
        include: {
          assessment: {
            include: {
              questions: {
                where: { isActive: true },
                select: { id: true },
              },
            },
          },
        },
      });

      if (product && product.isActive) {
        return mapProductToPublicDTO(product, lang);
      }
    } catch {
      // Ignore DB error, proceed to fallback
    }

    const fallback = FALLBACK_PRODUCTS_DB.find((p) => p.slug === slug);
    if (!fallback) {
      throw ApiError.notFound('Product not found', 'PRODUCT_NOT_FOUND');
    }

    return mapProductToPublicDTO(fallback as any, lang);
  }

  // Admin - full details & management
  async listAdminProducts(query: ListAdminProductsQuery) {
    const { page, limit, skip, take } = getPaginationParams(query);

    if (!isDbOnline()) {
      let filtered = [...FALLBACK_PRODUCTS_DB];
      if (query.isActive !== undefined) {
        filtered = filtered.filter((p) => p.isActive === query.isActive);
      }
      const mapped = filtered.slice(skip, skip + take).map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        description: p.description,
        priceInPaise: p.priceInPaise,
        currency: p.currency,
        assessmentId: p.assessment.id,
        reportTemplateId: `tmpl_${p.slug}`,
        autoRelease: true,
        isActive: p.isActive,
        createdAt: '2026-01-10T00:00:00.000Z',
        updatedAt: '2026-10-31T00:00:00.000Z',
        assessment: {
          id: p.assessment.id,
          title: p.assessment.title,
        },
        reportTemplate: {
          id: `tmpl_${p.slug}`,
          name: `${p.name.en} Template`,
        },
      }));
      return createPaginatedResponse(mapped, filtered.length, page, limit);
    }

    const where: any = {};
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    const [items, total] = await Promise.all([
      db.product.findMany({
        where,
        skip,
        take,
        include: {
          assessment: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.product.count({ where }),
    ]);

    return createPaginatedResponse(items, total, page, limit);
  }

  async getAdminProductById(id: string) {
    if (!isDbOnline()) {
      const p = FALLBACK_PRODUCTS_DB.find((item) => item.id === id || item.slug === id);
      if (!p) {
        throw ApiError.notFound('Product not found', 'PRODUCT_NOT_FOUND');
      }
      return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        description: p.description,
        priceInPaise: p.priceInPaise,
        currency: p.currency,
        assessmentId: p.assessment.id,
        reportTemplateId: `tmpl_${p.slug}`,
        autoRelease: true,
        isActive: p.isActive,
        createdAt: '2026-01-10T00:00:00.000Z',
        updatedAt: '2026-10-31T00:00:00.000Z',
        assessment: p.assessment,
        reportTemplate: {
          id: `tmpl_${p.slug}`,
          name: `${p.name.en} Template`,
        },
      };
    }

    const product = await db.product.findUnique({
      where: { id },
      include: {
        assessment: true,
      },
    });

    if (!product) {
      throw ApiError.notFound('Product not found', 'PRODUCT_NOT_FOUND');
    }

    return product;
  }

  async createProduct(input: CreateProductInput, actorId?: string, ip?: string) {
    if (!isDbOnline()) {
      const existingSlug = FALLBACK_PRODUCTS_DB.find((p) => p.slug === input.slug);
      if (existingSlug) {
        throw ApiError.conflict('Product with this slug already exists', 'SLUG_EXISTS');
      }

      const linkedAssessment =
        FALLBACK_PRODUCTS_DB.find(
          (p) => p.assessment.id === input.assessmentId || p.assessment.slug === input.assessmentId
        )?.assessment || {
          id: input.assessmentId,
          slug: input.slug,
          title: input.name,
          description: input.description,
          kind: 'OBJECTIVE' as const,
          version: 1,
          isActive: true,
          timeLimitSeconds: 1200,
          questions: [],
        };

      const newProduct: any = {
        id: `prod_${Date.now()}`,
        slug: input.slug,
        name: input.name,
        description: input.description,
        priceInPaise: input.priceInPaise,
        currency: input.currency || 'INR',
        isActive: true,
        autoRelease: input.autoRelease !== undefined ? input.autoRelease : true,
        assessmentId: input.assessmentId,
        assessment: linkedAssessment,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      FALLBACK_PRODUCTS_DB.unshift(newProduct);
      return newProduct;
    }

    const existingSlug = await db.product.findUnique({
      where: { slug: input.slug },
    });

    if (existingSlug) {
      throw ApiError.conflict('Product with this slug already exists', 'SLUG_EXISTS');
    }

    const assessment = await db.assessment.findUnique({
      where: { id: input.assessmentId },
    });

    if (!assessment) {
      throw ApiError.notFound('Linked assessment does not exist', 'ASSESSMENT_NOT_FOUND');
    }

    return db.$transaction(async (tx: any) => {
      const product = await tx.product.create({
        data: {
          slug: input.slug,
          name: input.name,
          description: input.description,
          assessmentId: input.assessmentId,
          priceInPaise: input.priceInPaise,
          currency: input.currency || 'INR',
          autoRelease: input.autoRelease !== undefined ? input.autoRelease : true,
          isActive: true,
        },
      });

      await recordAudit(tx, {
        actorId,
        action: 'CREATE_PRODUCT',
        entityType: 'Product',
        entityId: product.id,
        after: product,
        ip,
      });

      return product;
    });
  }

  async updateProduct(id: string, input: UpdateProductInput, actorId?: string, ip?: string) {
    if (!isDbOnline()) {
      const product = FALLBACK_PRODUCTS_DB.find((p) => p.id === id || p.slug === id);
      if (!product) {
        throw ApiError.notFound('Product not found', 'PRODUCT_NOT_FOUND');
      }
      if (input.name) product.name = input.name;
      if (input.description) product.description = input.description;
      if (input.priceInPaise !== undefined) product.priceInPaise = input.priceInPaise;
      if (input.currency) product.currency = input.currency;
      if (input.autoRelease !== undefined) (product as any).autoRelease = input.autoRelease;
      if (input.isActive !== undefined) product.isActive = input.isActive;
      return product;
    }

    const existing = await db.product.findUnique({
      where: { id },
    });

    if (!existing) {
      throw ApiError.notFound('Product not found', 'PRODUCT_NOT_FOUND');
    }

    return db.$transaction(async (tx: any) => {
      const updated = await tx.product.update({
        where: { id },
        data: {
          name: input.name !== undefined ? input.name : undefined,
          description: input.description !== undefined ? input.description : undefined,
          priceInPaise: input.priceInPaise !== undefined ? input.priceInPaise : undefined,
          currency: input.currency !== undefined ? input.currency : undefined,
          autoRelease: input.autoRelease !== undefined ? input.autoRelease : undefined,
          isActive: input.isActive !== undefined ? input.isActive : undefined,
        },
      });

      await recordAudit(tx, {
        actorId,
        action: 'UPDATE_PRODUCT',
        entityType: 'Product',
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
      const p = FALLBACK_PRODUCTS_DB.find((item) => item.id === id || item.slug === id);
      if (!p) {
        throw ApiError.notFound('Product not found', 'PRODUCT_NOT_FOUND');
      }
      p.isActive = !p.isActive;
      return p;
    }

    const existing = await db.product.findUnique({
      where: { id },
    });

    if (!existing) {
      throw ApiError.notFound('Product not found', 'PRODUCT_NOT_FOUND');
    }

    return db.$transaction(async (tx: any) => {
      const updated = await tx.product.update({
        where: { id },
        data: {
          isActive: !existing.isActive,
        },
      });

      await recordAudit(tx, {
        actorId,
        action: 'TOGGLE_PRODUCT_ACTIVE',
        entityType: 'Product',
        entityId: id,
        before: { isActive: existing.isActive },
        after: { isActive: updated.isActive },
        ip,
      });

      return updated;
    });
  }
}

export const productsService = new ProductsService();

