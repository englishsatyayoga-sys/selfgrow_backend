import { Request, Response } from 'express';
import { reportTemplatesService } from './report-templates.service';
import { sendSuccess } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';

export const listTemplates = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const result = await reportTemplatesService.listTemplates(req.query as any);
  sendSuccess(res, result);
});

export const getTemplateById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const template = await reportTemplatesService.getTemplateById(req.params.id);
  sendSuccess(res, { template });
});

export const createTemplate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const template = await reportTemplatesService.createTemplate(
    req.body,
    req.user?.id,
    req.ip || req.socket.remoteAddress
  );
  sendSuccess(res, { template }, 201);
});

export const createTemplateVersion = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const template = await reportTemplatesService.createVersion(
    req.params.id,
    req.body,
    req.user?.id,
    req.ip || req.socket.remoteAddress
  );
  sendSuccess(res, { template }, 201);
});

export const toggleTemplateActive = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const template = await reportTemplatesService.toggleActive(
    req.params.id,
    req.user?.id,
    req.ip || req.socket.remoteAddress
  );
  sendSuccess(res, { template });
});

