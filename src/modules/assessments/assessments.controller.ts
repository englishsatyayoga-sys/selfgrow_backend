import { Request, Response } from 'express';
import { assessmentsService } from './assessments.service';
import { sendSuccess } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';

export const listAssessments = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const result = await assessmentsService.listAssessments(req.query as any);
  sendSuccess(res, result);
});

export const getAssessmentById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const assessment = await assessmentsService.getAssessmentById(req.params.id);
  sendSuccess(res, { assessment });
});

export const createAssessment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const assessment = await assessmentsService.createAssessment(
    req.body,
    req.user?.id,
    req.ip || req.socket.remoteAddress
  );
  sendSuccess(res, { assessment }, 201);
});

export const updateAssessment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const assessment = await assessmentsService.updateAssessment(
    req.params.id,
    req.body,
    req.user?.id,
    req.ip || req.socket.remoteAddress
  );
  sendSuccess(res, { assessment });
});

export const toggleAssessmentActive = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const assessment = await assessmentsService.toggleActive(
    req.params.id,
    req.user?.id,
    req.ip || req.socket.remoteAddress
  );
  sendSuccess(res, { assessment });
});

