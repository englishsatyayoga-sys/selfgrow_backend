import { Request, Response } from 'express';
import path from 'path';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';
import { defaultStorageService, LocalStorageDriver } from '../../integrations/storage';

export const handleStorageDownload = asyncHandler(async (req: Request, res: Response) => {
  const { key, expires, signature } = req.query as {
    key?: string;
    expires?: string;
    signature?: string;
  };

  if (!key || !expires || !signature) {
    throw ApiError.badRequest('Missing key, expires, or signature parameter', 'INVALID_SIGNATURE');
  }

  if (defaultStorageService instanceof LocalStorageDriver) {
    const isValid = defaultStorageService.verifySignature(key, expires, signature);
    if (!isValid) {
      throw ApiError.forbidden('Invalid or expired signature', 'EXPIRED_OR_INVALID_SIGNATURE');
    }

    try {
      const buffer = await defaultStorageService.getBuffer(key);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${path.basename(key)}"`);
      return res.send(buffer);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        throw ApiError.notFound('Requested file not found in storage', 'FILE_NOT_FOUND');
      }
      throw err;
    }
  }

  throw ApiError.badRequest('Direct storage download endpoint is only for local storage driver', 'INVALID_DRIVER');
});

