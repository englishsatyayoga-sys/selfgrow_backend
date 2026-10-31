import { Request, Response } from 'express';
import { productsService } from './products.service';
import { sendSuccess } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';

// Public endpoints
export const listPublicProducts = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const result = await productsService.listPublicProducts(req.query as any);
  sendSuccess(res, result);
});

export const getPublicProductBySlug = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const lang = (req.query.lang as 'en' | 'hi') || 'en';
  const product = await productsService.getPublicProductBySlug(req.params.slug, lang);
  sendSuccess(res, { product });
});

// Admin endpoints
export const listAdminProducts = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const result = await productsService.listAdminProducts(req.query as any);
  sendSuccess(res, result);
});

export const getAdminProductById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const product = await productsService.getAdminProductById(req.params.id);
  sendSuccess(res, { product });
});

export const createProduct = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const product = await productsService.createProduct(
    req.body,
    req.user?.id,
    req.ip || req.socket.remoteAddress
  );
  sendSuccess(res, { product }, 201);
});

export const updateProduct = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const product = await productsService.updateProduct(
    req.params.id,
    req.body,
    req.user?.id,
    req.ip || req.socket.remoteAddress
  );
  sendSuccess(res, { product });
});

export const toggleProductActive = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const product = await productsService.toggleActive(
    req.params.id,
    req.user?.id,
    req.ip || req.socket.remoteAddress
  );
  sendSuccess(res, { product });
});

