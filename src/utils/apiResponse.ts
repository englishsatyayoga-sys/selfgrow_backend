import { Response } from 'express';

export interface ApiResponsePayload<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export const sendResponse = <T>(
  res: Response,
  statusCode: number,
  payload: ApiResponsePayload<T>
): Response => {
  return res.status(statusCode).json(payload);
};

export const sendSuccess = <T>(
  res: Response,
  data: T,
  statusCode: number = 200
): Response => {
  return sendResponse(res, statusCode, {
    success: true,
    data,
  });
};

export const sendError = (
  res: Response,
  statusCode: number,
  code: string,
  message: string
): Response => {
  return sendResponse(res, statusCode, {
    success: false,
    error: {
      code,
      message,
    },
  });
};

