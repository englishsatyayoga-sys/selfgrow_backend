import { EventEmitter } from 'events';

export interface OrderPaidEventPayload {
  orderId: string;
  attemptId: string;
  userId: string;
  productId: string;
  amountInPaise: number;
}

class AppEventEmitter extends EventEmitter {}

export const appEventEmitter = new AppEventEmitter();

export const ORDER_PAID_EVENT = 'order.paid';

