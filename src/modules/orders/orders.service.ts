import { db } from '../../config/db';
import { env } from '../../config/env';
import { ApiError } from '../../utils/ApiError';
import { defaultPaymentGateway, PaymentGateway } from '../../integrations/payment';
import { appEventEmitter, ORDER_PAID_EVENT } from '../../utils/events';
import { getPaginationParams, createPaginatedResponse } from '../../utils/pagination';
import { CreateOrderInput, VerifyPaymentInput, ListMyOrdersQuery } from './orders.schema';
import { OrderStatus, AttemptStatus } from '@prisma/client';
import { FALLBACK_PRODUCTS_DB, inMemoryAttempts, inMemoryOrders } from '../products/products.fallback';

export interface PaymentData {
  paymentId: string;
  amountInPaise: number;
  status?: string;
  method?: string;
  failureReason?: string;
}

/**
 * Single shared function to atomically mark an order as PAID.
 * Idempotent: safe against race conditions between webhook and client verify.
 */
export const markOrderPaid = async (
  orderId: string,
  paymentData: PaymentData
) => {
  return db.$transaction(async (tx: any) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { attempt: true, product: true },
    });

    if (!order) {
      throw ApiError.notFound('Order not found', 'ORDER_NOT_FOUND');
    }

    // Upsert payment transaction
    await tx.payment.upsert({
      where: { razorpayPaymentId: paymentData.paymentId },
      create: {
        orderId,
        razorpayPaymentId: paymentData.paymentId,
        amountInPaise: paymentData.amountInPaise,
        status: paymentData.status || 'captured',
        method: paymentData.method || null,
        failureReason: paymentData.failureReason || null,
      },
      update: {
        status: paymentData.status || 'captured',
        method: paymentData.method || null,
        failureReason: paymentData.failureReason || null,
      },
    });

    // Idempotency: if already paid, return early without re-emitting events
    if (order.status === OrderStatus.PAID) {
      return order;
    }

    // Atomically mark order as PAID
    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.PAID,
        paidAt: new Date(),
      },
    });

    // Emit event hook for downstream listeners (e.g., report generation)
    appEventEmitter.emit(ORDER_PAID_EVENT, {
      orderId: updatedOrder.id,
      attemptId: order.attemptId,
      userId: order.userId,
      productId: order.productId,
      amountInPaise: updatedOrder.amountInPaise,
    });

    return updatedOrder;
  });
};

export class OrdersService {
  private gateway: PaymentGateway;

  constructor(gateway: PaymentGateway = defaultPaymentGateway) {
    this.gateway = gateway;
  }

  // Inject gateway for unit testing
  setGateway(gateway: PaymentGateway) {
    this.gateway = gateway;
  }

  async createOrder(input: CreateOrderInput, userId: string) {
    let attempt: any = null;

    try {
      attempt = await db.attempt.findUnique({
        where: { id: input.attemptId },
        include: { product: true },
      });
    } catch {
      // Offline fallback
    }

    if (!attempt) {
      attempt = inMemoryAttempts.get(input.attemptId);
      if (attempt) {
        attempt.product =
          FALLBACK_PRODUCTS_DB.find(
            (p) => p.id === attempt.productId || p.slug === attempt.productId
          ) || FALLBACK_PRODUCTS_DB[0];
      }
    }

    // Ownership check in service layer (404 not 403)
    if (!attempt || attempt.userId !== userId) {
      throw ApiError.notFound('Attempt not found', 'ATTEMPT_NOT_FOUND');
    }

    if (attempt.status !== AttemptStatus.SUBMITTED) {
      throw ApiError.badRequest(
        'Assessment attempt must be submitted before generating an order',
        'ATTEMPT_NOT_SUBMITTED'
      );
    }

    const product = attempt.product;
    const amountInPaise = product.priceInPaise;
    const currency = product.currency || 'INR';

    // In-memory / Offline fallback flow
    if (inMemoryAttempts.has(input.attemptId)) {
      for (const ord of inMemoryOrders.values()) {
        if (ord.attemptId === attempt.id && ord.userId === userId) {
          return {
            orderId: ord.id,
            status: OrderStatus.PAID,
            amountInPaise: 0,
            currency: ord.currency,
            isFree: true,
          };
        }
      }

      const orderId = `ord_${Date.now()}`;
      const newOrder = {
        id: orderId,
        userId,
        productId: product.id,
        attemptId: attempt.id,
        amountInPaise,
        currency,
        status: OrderStatus.PAID,
        createdAt: new Date(),
        paidAt: new Date(),
        product,
        attempt,
        payments: [],
      };
      inMemoryOrders.set(orderId, newOrder);
      return {
        orderId: newOrder.id,
        status: OrderStatus.PAID,
        amountInPaise: 0,
        currency: newOrder.currency,
        isFree: true,
      };
    }

    // Check if an order already exists for this attempt
    const existingOrder = await db.order.findUnique({
      where: { attemptId: attempt.id },
    });

    // Free Product Flow: priceInPaise = 0
    if (amountInPaise === 0) {
      if (existingOrder) {
        if (existingOrder.status === OrderStatus.PAID) {
          return {
            orderId: existingOrder.id,
            status: OrderStatus.PAID,
            amountInPaise: 0,
            currency,
            isFree: true,
          };
        }
      }

      const paidOrder = await db.$transaction(async (tx: any) => {
        const order = existingOrder
          ? await tx.order.update({
              where: { id: existingOrder.id },
              data: { status: OrderStatus.PAID, paidAt: new Date() },
            })
          : await tx.order.create({
              data: {
                userId,
                productId: product.id,
                attemptId: attempt.id,
                amountInPaise: 0,
                currency,
                status: OrderStatus.PAID,
                paidAt: new Date(),
              },
            });

        appEventEmitter.emit(ORDER_PAID_EVENT, {
          orderId: order.id,
          attemptId: attempt.id,
          userId,
          productId: product.id,
          amountInPaise: 0,
        });

        return order;
      });

      return {
        orderId: paidOrder.id,
        status: OrderStatus.PAID,
        amountInPaise: 0,
        currency,
        isFree: true,
      };
    }

    // Paid Product Flow
    if (existingOrder) {
      if (existingOrder.status === OrderStatus.PAID) {
        return {
          orderId: existingOrder.id,
          status: OrderStatus.PAID,
          amountInPaise: existingOrder.amountInPaise,
          currency: existingOrder.currency,
          isAlreadyPaid: true,
        };
      }

      // Reuse unpaid existing order
      if (existingOrder.razorpayOrderId) {
        return {
          orderId: existingOrder.id,
          razorpayOrderId: existingOrder.razorpayOrderId,
          amountInPaise: existingOrder.amountInPaise,
          currency: existingOrder.currency,
          keyId: env.RAZORPAY_KEY_ID,
        };
      }
    }

    // Create DB order first
    const internalOrder = existingOrder || (await db.order.create({
      data: {
        userId,
        productId: product.id,
        attemptId: attempt.id,
        amountInPaise,
        currency,
        status: OrderStatus.CREATED,
      },
    }));

    // Create Razorpay order via Gateway
    const gatewayOrder = await this.gateway.createOrder({
      amountInPaise,
      currency,
      receipt: internalOrder.id,
    });

    // Update with razorpayOrderId
    await db.order.update({
      where: { id: internalOrder.id },
      data: { razorpayOrderId: gatewayOrder.id },
    });

    return {
      orderId: internalOrder.id,
      razorpayOrderId: gatewayOrder.id,
      amountInPaise,
      currency,
      keyId: env.RAZORPAY_KEY_ID,
    };
  }

  async verifyPayment(orderId: string, input: VerifyPaymentInput, userId: string) {
    let order: any = null;
    try {
      order = await db.order.findUnique({
        where: { id: orderId },
      });
    } catch {}

    if (!order) {
      order = inMemoryOrders.get(orderId);
    }

    if (!order || order.userId !== userId) {
      throw ApiError.notFound('Order not found', 'ORDER_NOT_FOUND');
    }

    // Idempotent fast-exit
    if (order.status === OrderStatus.PAID) {
      return { success: true, message: 'Order is already marked as paid', orderId: order.id };
    }

    if (!order.razorpayOrderId) {
      throw ApiError.badRequest('Order is not associated with a gateway order', 'INVALID_ORDER');
    }

    // Verify HMAC SHA256 timing-safe signature
    const isValid = this.gateway.verifyPaymentSignature({
      orderId: order.razorpayOrderId,
      paymentId: input.razorpay_payment_id,
      signature: input.razorpay_signature,
    });

    if (!isValid) {
      throw ApiError.badRequest('Invalid payment signature', 'INVALID_SIGNATURE');
    }

    // Atomically mark order as PAID and persist payment
    await markOrderPaid(order.id, {
      paymentId: input.razorpay_payment_id,
      amountInPaise: order.amountInPaise,
      status: 'captured',
    });

    return { success: true, message: 'Payment verified successfully', orderId: order.id };
  }

  async listMyOrders(query: ListMyOrdersQuery, userId: string) {
    const { page, limit, skip, take } = getPaginationParams(query);

    try {
      const [items, total] = await Promise.all([
        db.order.findMany({
          where: { userId },
          skip,
          take,
          include: {
            product: {
              select: {
                id: true,
                slug: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        db.order.count({ where: { userId } }),
      ]);

      return createPaginatedResponse(items, total, page, limit);
    } catch {
      const items = Array.from(inMemoryOrders.values()).filter((o) => o.userId === userId);
      return createPaginatedResponse(items, items.length, page, limit);
    }
  }

  async getOrderById(orderId: string, userId: string) {
    let order: any = null;

    try {
      order = await db.order.findUnique({
        where: { id: orderId },
        include: {
          product: true,
          attempt: true,
          payments: true,
        },
      });
    } catch {}

    if (!order) {
      order = inMemoryOrders.get(orderId);
    }

    if (!order || order.userId !== userId) {
      throw ApiError.notFound('Order not found', 'ORDER_NOT_FOUND');
    }

    return order;
  }
}

export const ordersService = new OrdersService();

