import { Request, Response } from 'express';
import { webhooksService } from './webhooks.service';
import { sendSuccess } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';

export const handleRazorpayWebhook = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const signature = req.headers['x-razorpay-signature'] as string | undefined;
    const rawBody = req.body;

    const result = await webhooksService.handleRazorpayWebhook(rawBody, signature);
    sendSuccess(res, result, 200);
  }
);

