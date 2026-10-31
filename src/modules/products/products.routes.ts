import { Router } from 'express';
import {
  listPublicProducts,
  getPublicProductBySlug,
  listAdminProducts,
  getAdminProductById,
  createProduct,
  updateProduct,
  toggleProductActive,
} from './products.controller';
import {
  createProductSchema,
  updateProductSchema,
  productIdParamSchema,
  productSlugParamSchema,
  listPublicProductsQuerySchema,
  listAdminProductsQuerySchema,
} from './products.schema';
import { validate } from '../../middlewares/validate';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { Role } from '@prisma/client';

// Public Router
const publicRouter = Router();
publicRouter.get('/', validate(listPublicProductsQuerySchema), listPublicProducts);
publicRouter.get('/:slug', validate(productSlugParamSchema), getPublicProductBySlug);

// Admin Router
const adminRouter = Router();
adminRouter.use(authenticate, authorize(Role.ADMIN));
adminRouter.get('/', validate(listAdminProductsQuerySchema), listAdminProducts);
adminRouter.get('/:id', validate(productIdParamSchema), getAdminProductById);
adminRouter.post('/', validate(createProductSchema), createProduct);
adminRouter.patch('/:id', validate(updateProductSchema), updateProduct);
adminRouter.patch('/:id/toggle-active', validate(productIdParamSchema), toggleProductActive);

export const productsRoutes = publicRouter;
export const adminProductsRoutes = adminRouter;

