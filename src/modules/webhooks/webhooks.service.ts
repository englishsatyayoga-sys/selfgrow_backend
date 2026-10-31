import { db } from '../../config/db';
import { ApiError } from '../../utils/ApiError';
import { defaultPaymentGateway, PaymentGateway } from '../../integrations/payment';
import { markOrderPaid } from '../orders/orders.service';
import { logger } from '../../config/logger';

export class WebhooksService {
  private gateway: PaymentGateway;

  constructor(gateway: PaymentGateway = defaultPaymentGateway) {
    this.gateway = gateway;
  }

  setGateway(gateway: PaymentGateway) {
    this.gateway = gateway;
  }

  async handleRazorpayWebhook(rawBody: Buffer | string, signature: string | undefined) {
    if (!signature) {
      throw ApiError.badRequest('Missing webhook signature', 'MISSING_SIGNATURE');
    }

    // Verify cryptographic signature against the exact raw buffer
    const isValid = this.gateway.verifyWebhookSignature({
      rawBody,
      signature,
    });

    if (!isValid) {
      throw ApiError.badRequest('Invalid webhook signature', 'INVALID_SIGNATURE');
    }

    const payloadString = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
    const body = JSON.parse(payloadString);

    const eventId = body.event_id || body.id || (body.payload?.payment?.entity?.id ? `${body.payload.payment.entity.id}_${body.event}` : null);

    if (!eventId) {
      throw ApiError.badRequest('Missing event identifier', 'INVALID_PAYLOAD');
    }

    // Idempotency: check if this event has already been recorded
    const existingEvent = await db.webhookEvent.findUnique({
      where: { eventId },
    });

    if (existingEvent) {
      logger.info({ eventId }, 'Webhook event already processed, returning 200 (idempotent)');
      return { received: true, alreadyProcessed: true };
    }

    // Persist WebhookEvent record
    await db.webhookEvent.create({
      data: {
        provider: 'razorpay',
        eventId,
        type: body.event,
        payload: body,
      },
    });

    const eventType = body.event;
    const paymentEntity = body.payload?.payment?.entity;
    const razorpayOrderId = paymentEntity?.order_id || body.payload?.order?.entity?.id;

    if (!razorpayOrderId) {
      return { received: true };
    }

    const order = await db.order.findUnique({
      where: { razorpayOrderId },
    });

    if (!order) {
      logger.warn({ razorpayOrderId }, 'Order not found for incoming webhook event');
      return { received: true };
    }

    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      await markOrderPaid(order.id, {
        paymentId: paymentEntity.id,
        amountInPaise: Number(paymentEntity.amount),
        status: 'captured',
        method: paymentEntity.method,
      });
      logger.info({ orderId: order.id }, 'Order successfully marked as PAID via webhook');
    } else if (eventType === 'payment.failed') {
      await db.payment.upsert({
        where: { razorpayPaymentId: paymentEntity.id },
        create: {
          orderId: order.id,
          razorpayPaymentId: paymentEntity.id,
          amountInPaise: Number(paymentEntity.amount),
          status: 'failed',
          method: paymentEntity.method || null,
          failureReason: paymentEntity.error_description || 'Payment failed',
        },
        update: {
          status: 'failed',
          failureReason: paymentEntity.error_description || 'Payment failed',
        },
      });
      logger.info({ orderId: order.id }, 'Recorded failed payment attempt; order remains retryable');
    }

    return { received: true };
  }
}

export const webhooksService = new WebhooksService();

