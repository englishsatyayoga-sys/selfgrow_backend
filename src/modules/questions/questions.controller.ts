import { Request, Response } from 'express';
import { questionsService } from './questions.service';
import { sendSuccess } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';

export const createQuestion = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const question = await questionsService.createQuestion(
    req.params.assessmentId,
    req.body,
    req.user?.id,
    req.ip || req.socket.remoteAddress
  );
  sendSuccess(res, { question }, 201);
});

export const updateQuestion = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const question = await questionsService.updateQuestion(
    req.params.id,
    req.body,
    req.user?.id,
    req.ip || req.socket.remoteAddress
  );
  sendSuccess(res, { question });
});

export const reorderQuestions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const result = await questionsService.reorderQuestions(
    req.params.assessmentId,
    req.body,
    req.user?.id,
    req.ip || req.socket.remoteAddress
  );
  sendSuccess(res, result);
});

export const deactivateQuestion = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const question = await questionsService.deactivateQuestion(
    req.params.id,
    req.user?.id,
    req.ip || req.socket.remoteAddress
  );
  sendSuccess(res, { question });
});

