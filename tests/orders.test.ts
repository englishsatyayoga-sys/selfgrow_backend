import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { resetMockDb, mockDb, mockOrders, mockPayments, mockWebhookEvents } from './setup';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env';
import { ordersService } from '../src/modules/orders/orders.service';
import { webhooksService } from '../src/modules/webhooks/webhooks.service';
import {
  PaymentGateway,
  CreateGatewayOrderParams,
  GatewayOrderResult,
  VerifyPaymentSignatureParams,
  VerifyWebhookSignatureParams,
  GatewayPaymentDetails,
} from '../src/integrations/payment/PaymentGateway';
import { appEventEmitter, ORDER_PAID_EVENT } from '../src/utils/events';

class MockPaymentGateway implements PaymentGateway {
  async createOrder(params: CreateGatewayOrderParams): Promise<GatewayOrderResult> {
    return {
      id: 'order_rzp_mock_123',
      amount: params.amountInPaise,
      currency: params.currency,
    };
  }

  verifyPaymentSignature(params: VerifyPaymentSignatureParams): boolean {
    return params.signature === 'valid_signature_123';
  }

  verifyWebhookSignature(params: VerifyWebhookSignatureParams): boolean {
    return params.signature === 'valid_webhook_sig_123';
  }

  async fetchPayment(paymentId: string): Promise<GatewayPaymentDetails> {
    return {
      id: paymentId,
      amount: 49900,
      currency: 'INR',
      status: 'captured',
    };
  }
}

describe('Phase 4: Orders & Payments Integration Tests', () => {
  let mockGateway: MockPaymentGateway;
  let userA: any;
  let userB: any;
  let userToken: string;
  let userBToken: string;
  let freeProduct: any;
  let paidProduct: any;
  let assessment: any;
  let submittedAttemptPaid: any;
  let submittedAttemptFree: any;
  let inProgressAttempt: any;

  beforeEach(async () => {
    resetMockDb();

    mockGateway = new MockPaymentGateway();
    ordersService.setGateway(mockGateway);
    webhooksService.setGateway(mockGateway);

    // Create User A
    userA = await mockDb.user.create({
      data: {
        name: 'User A',
        email: 'user_a@example.com',
        role: 'USER',
        passwordHash: 'dummy',
      },
    });

    userToken = jwt.sign(
      { sub: userA.id, email: userA.email, role: 'USER' },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    // Create User B
    userB = await mockDb.user.create({
      data: {
        name: 'User B',
        email: 'user_b@example.com',
        role: 'USER',
        passwordHash: 'dummy',
      },
    });

    userBToken = jwt.sign(
      { sub: userB.id, email: userB.email, role: 'USER' },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    // Assessment
    assessment = await mockDb.assessment.create({
      data: {
        slug: 'leadership-eval',
        title: { en: 'Leadership' },
        description: { en: 'Desc' },
        kind: 'OBJECTIVE',
        version: 1,
        isActive: true,
      },
    });

    // Paid Product (₹499)
    paidProduct = await mockDb.product.create({
      data: {
        slug: 'paid-leadership-report',
        name: { en: 'Paid Report' },
        description: { en: 'Paid Desc' },
        assessmentId: assessment.id,
        priceInPaise: 49900,
        currency: 'INR',
        isActive: true,
      },
    });

    // Free Product (₹0)
    freeProduct = await mockDb.product.create({
      data: {
        slug: 'free-leadership-report',
        name: { en: 'Free Report' },
        description: { en: 'Free Desc' },
        assessmentId: assessment.id,
        priceInPaise: 0,
        currency: 'INR',
        isActive: true,
      },
    });

    // Submitted Attempt for Paid Product
    submittedAttemptPaid = await mockDb.attempt.create({
      data: {
        userId: userA.id,
        productId: paidProduct.id,
        assessmentId: assessment.id,
        assessmentVersion: 1,
        status: 'SUBMITTED',
        scoreSummary: { totalScore: 10 },
      },
    });

    // Submitted Attempt for Free Product
    submittedAttemptFree = await mockDb.attempt.create({
      data: {
        userId: userA.id,
        productId: freeProduct.id,
        assessmentId: assessment.id,
        assessmentVersion: 1,
        status: 'SUBMITTED',
        scoreSummary: { totalScore: 5 },
      },
    });

    // In-Progress Attempt
    inProgressAttempt = await mockDb.attempt.create({
      data: {
        userId: userA.id,
        productId: paidProduct.id,
        assessmentId: assessment.id,
        assessmentVersion: 1,
        status: 'IN_PROGRESS',
      },
    });
  });

  describe('Order Creation & Amount Tamper Resistance', () => {
    it('should reject order creation if attempt is not SUBMITTED', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Cookie', [`accessToken=${userToken}`])
        .send({ attemptId: inProgressAttempt.id });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('ATTEMPT_NOT_SUBMITTED');
    });

    it('should always read amount from Product in DB (snapshotting priceInPaise), ignoring any client-sent price', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Cookie', [`accessToken=${userToken}`])
        .send({
          attemptId: submittedAttemptPaid.id,
          amountInPaise: 100, // Malicious client attempt to buy for ₹1
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.amountInPaise).toBe(49900); // DB price enforced!
      expect(res.body.data.razorpayOrderId).toBe('order_rzp_mock_123');
    });

    it('should handle Free Product Flow instantly with no gateway call and emit order.paid event', async () => {
      let eventEmitted = false;
      appEventEmitter.once(ORDER_PAID_EVENT, (payload) => {
        expect(payload.amountInPaise).toBe(0);
        eventEmitted = true;
      });

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Cookie', [`accessToken=${userToken}`])
        .send({ attemptId: submittedAttemptFree.id });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isFree).toBe(true);
      expect(res.body.data.status).toBe('PAID');
      expect(eventEmitted).toBe(true);
    });

    it('should enforce ownership on order creation (404 if attempt belongs to another user)', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Cookie', [`accessToken=${userBToken}`])
        .send({ attemptId: submittedAttemptPaid.id });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('ATTEMPT_NOT_FOUND');
    });
  });

  describe('Payment Verification (/api/v1/orders/:id/verify)', () => {
    let orderId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Cookie', [`accessToken=${userToken}`])
        .send({ attemptId: submittedAttemptPaid.id });

      orderId = res.body.data.orderId;
    });

    it('should reject invalid HMAC payment signature with 400', async () => {
      const res = await request(app)
        .post(`/api/v1/orders/${orderId}/verify`)
        .set('Cookie', [`accessToken=${userToken}`])
        .send({
          razorpay_payment_id: 'pay_mock_123',
          razorpay_signature: 'invalid_fraudulent_signature',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_SIGNATURE');

      const order = mockOrders.get(orderId);
      expect(order.status).toBe('CREATED');
    });

    it('should accept valid signature, mark order PAID, and be idempotent on duplicate verify', async () => {
      let eventCount = 0;
      appEventEmitter.on(ORDER_PAID_EVENT, () => {
        eventCount++;
      });

      // 1. First valid verify
      const res1 = await request(app)
        .post(`/api/v1/orders/${orderId}/verify`)
        .set('Cookie', [`accessToken=${userToken}`])
        .send({
          razorpay_payment_id: 'pay_mock_123',
          razorpay_signature: 'valid_signature_123',
        });

      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);

      const order = mockOrders.get(orderId);
      expect(order.status).toBe('PAID');
      expect(order.paidAt).toBeDefined();
      expect(eventCount).toBe(1);

      // 2. Duplicate verify call (idempotent)
      const res2 = await request(app)
        .post(`/api/v1/orders/${orderId}/verify`)
        .set('Cookie', [`accessToken=${userToken}`])
        .send({
          razorpay_payment_id: 'pay_mock_123',
          razorpay_signature: 'valid_signature_123',
        });

      expect(res2.status).toBe(200);
      expect(res2.body.data.message).toContain('already marked as paid');
      expect(eventCount).toBe(1); // Event NOT re-emitted!
    });
  });

  describe('Webhook Endpoint (/api/v1/webhooks/razorpay)', () => {
    let orderId: string;
    let rzpOrderId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Cookie', [`accessToken=${userToken}`])
        .send({ attemptId: submittedAttemptPaid.id });

      orderId = res.body.data.orderId;
      rzpOrderId = res.body.data.razorpayOrderId;
    });

    it('should reject webhook requests with missing or invalid signature', async () => {
      const payload = JSON.stringify({
        event: 'payment.captured',
        event_id: 'evt_1',
      });

      const res = await request(app)
        .post('/api/v1/webhooks/razorpay')
        .set('Content-Type', 'application/json')
        .set('x-razorpay-signature', 'wrong_signature')
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_SIGNATURE');
    });

    it('should process payment.captured webhook, mark order PAID, and store payment record', async () => {
      const payload = JSON.stringify({
        event: 'payment.captured',
        event_id: 'evt_captured_999',
        payload: {
          payment: {
            entity: {
              id: 'pay_captured_123',
              order_id: rzpOrderId,
              amount: 49900,
              method: 'upi',
            },
          },
        },
      });

      const res = await request(app)
        .post('/api/v1/webhooks/razorpay')
        .set('Content-Type', 'application/json')
        .set('x-razorpay-signature', 'valid_webhook_sig_123')
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const order = mockOrders.get(orderId);
      expect(order.status).toBe('PAID');

      const payment = mockPayments.get('pay_captured_123');
      expect(payment).toBeDefined();
      expect(payment.method).toBe('upi');
      expect(payment.status).toBe('captured');
    });

    it('should be strictly idempotent on duplicate webhook events with same event_id', async () => {
      const payload = JSON.stringify({
        event: 'payment.captured',
        event_id: 'evt_duplicate_test',
        payload: {
          payment: {
            entity: {
              id: 'pay_dup_123',
              order_id: rzpOrderId,
              amount: 49900,
            },
          },
        },
      });

      // 1. First webhook
      const res1 = await request(app)
        .post('/api/v1/webhooks/razorpay')
        .set('Content-Type', 'application/json')
        .set('x-razorpay-signature', 'valid_webhook_sig_123')
        .send(payload);

      expect(res1.status).toBe(200);
      expect(mockWebhookEvents.has('evt_duplicate_test')).toBe(true);

      // 2. Duplicate webhook delivery
      const res2 = await request(app)
        .post('/api/v1/webhooks/razorpay')
        .set('Content-Type', 'application/json')
        .set('x-razorpay-signature', 'valid_webhook_sig_123')
        .send(payload);

      expect(res2.status).toBe(200);
      expect(res2.body.data.alreadyProcessed).toBe(true);
    });

    it('should record payment failure when payment.failed event arrives, keeping order retryable', async () => {
      const payload = JSON.stringify({
        event: 'payment.failed',
        event_id: 'evt_failed_test',
        payload: {
          payment: {
            entity: {
              id: 'pay_failed_456',
              order_id: rzpOrderId,
              amount: 49900,
              error_description: 'Card declined by bank',
            },
          },
        },
      });

      const res = await request(app)
        .post('/api/v1/webhooks/razorpay')
        .set('Content-Type', 'application/json')
        .set('x-razorpay-signature', 'valid_webhook_sig_123')
        .send(payload);

      expect(res.status).toBe(200);

      // Order should remain CREATED (retryable)
      const order = mockOrders.get(orderId);
      expect(order.status).toBe('CREATED');

      // Payment record should be recorded as failed
      const payment = mockPayments.get('pay_failed_456');
      expect(payment).toBeDefined();
      expect(payment.status).toBe('failed');
      expect(payment.failureReason).toBe('Card declined by bank');
    });
  });

  describe('Order Ownership Isolation', () => {
    it('should return 404 if User B tries to view or verify User A order', async () => {
      const createRes = await request(app)
        .post('/api/v1/orders')
        .set('Cookie', [`accessToken=${userToken}`])
        .send({ attemptId: submittedAttemptPaid.id });

      const orderId = createRes.body.data.orderId;

      const getRes = await request(app)
        .get(`/api/v1/orders/${orderId}`)
        .set('Cookie', [`accessToken=${userBToken}`]);

      expect(getRes.status).toBe(404);
      expect(getRes.body.error.code).toBe('ORDER_NOT_FOUND');
    });
  });
});

