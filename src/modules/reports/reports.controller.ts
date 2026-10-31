import { Request, Response } from 'express';
import { reportsService } from './reports.service';
import { sendSuccess } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';

export const listMyReports = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw ApiError.unauthorized('Authentication required', 'UNAUTHORIZED');
  }

  const result = await reportsService.listMyReports(req.query as any, req.user.id);
  sendSuccess(res, result);
});

export const getReportById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw ApiError.unauthorized('Authentication required', 'UNAUTHORIZED');
  }

  const report = await reportsService.getReportById(req.params.id, req.user.id);
  sendSuccess(res, { report });
});

export const regenerateReport = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const report = await reportsService.regenerate(
    req.params.id,
    req.body.reason,
    req.user?.id,
    req.ip
  );
  sendSuccess(res, { report });
});

export const releaseReport = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const report = await reportsService.releaseReport(req.params.id, req.user?.id, req.ip);
  sendSuccess(res, { report });
});

export const adminListReports = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const result = await reportsService.adminListReports(req.query as any);
  sendSuccess(res, result);
});

export const adminGetReport = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const report = await reportsService.adminGetReport(req.params.id);
  sendSuccess(res, { report });
});

export const adminUpdateContent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const report = await reportsService.adminUpdateContent(
    req.params.id,
    req.body.content,
    req.body.reason,
    req.user?.id,
    req.ip
  );
  sendSuccess(res, { report });
});

export const adminRejectReport = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const report = await reportsService.adminReject(
    req.params.id,
    req.body.reason,
    req.user?.id,
    req.ip
  );
  sendSuccess(res, { report });
});

export const downloadReport = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw ApiError.unauthorized('Authentication required', 'UNAUTHORIZED');
  }

  const { id } = req.params;
  const isAdmin = req.user.role === 'ADMIN';
  const shouldStream = req.query.stream === 'true' || req.headers.accept?.includes('application/pdf');

  if (shouldStream) {
    const buffer = await reportsService.getReportPdfBuffer(id, req.user.id, isAdmin);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="report-${id}.pdf"`);
    res.send(buffer);
    return;
  }

  const result = await reportsService.getReportDownloadUrl(id, req.user.id, isAdmin);
  sendSuccess(res, result);
});

