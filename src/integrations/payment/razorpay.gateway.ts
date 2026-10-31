import Razorpay from 'razorpay';
import crypto from 'crypto';
import { env } from '../../config/env';
import {
  PaymentGateway,
  CreateGatewayOrderParams,
  GatewayOrderResult,
  VerifyPaymentSignatureParams,
  VerifyWebhookSignatureParams,
  GatewayPaymentDetails,
} from './PaymentGateway';

export class RazorpayGateway implements PaymentGateway {
  private client: Razorpay;
  private keySecret: string;
  private webhookSecret: string;

  constructor(
    keyId: string = env.RAZORPAY_KEY_ID,
    keySecret: string = env.RAZORPAY_KEY_SECRET,
    webhookSecret: string = env.RAZORPAY_WEBHOOK_SECRET
  ) {
    this.keySecret = keySecret;
    this.webhookSecret = webhookSecret;
    this.client = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }

  async createOrder(params: CreateGatewayOrderParams): Promise<GatewayOrderResult> {
    const order = await this.client.orders.create({
      amount: params.amountInPaise,
      currency: params.currency,
      receipt: params.receipt,
      notes: params.notes,
    });

    return {
      id: order.id,
      amount: Number(order.amount),
      currency: order.currency,
    };
  }

  verifyPaymentSignature(params: VerifyPaymentSignatureParams): boolean {
    try {
      const payload = `${params.orderId}|${params.paymentId}`;
      const expectedSignature = crypto
        .createHmac('sha256', this.keySecret)
        .update(payload)
        .digest('hex');

      const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
      const receivedBuffer = Buffer.from(params.signature, 'utf8');

      if (expectedBuffer.length !== receivedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
    } catch {
      return false;
    }
  }

  verifyWebhookSignature(params: VerifyWebhookSignatureParams): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(params.rawBody)
        .digest('hex');

      const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
      const receivedBuffer = Buffer.from(params.signature, 'utf8');

      if (expectedBuffer.length !== receivedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
    } catch {
      return false;
    }
  }

  async fetchPayment(paymentId: string): Promise<GatewayPaymentDetails> {
    const payment = await this.client.payments.fetch(paymentId);
    return {
      id: payment.id,
      amount: Number(payment.amount),
      currency: payment.currency,
      status: payment.status,
      method: payment.method,
      orderId: payment.order_id,
    };
  }
}

export const defaultPaymentGateway: PaymentGateway = new RazorpayGateway();

