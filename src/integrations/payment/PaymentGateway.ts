export interface CreateGatewayOrderParams {
  amountInPaise: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface GatewayOrderResult {
  id: string;
  amount: number;
  currency: string;
}

export interface VerifyPaymentSignatureParams {
  orderId: string;
  paymentId: string;
  signature: string;
}

export interface VerifyWebhookSignatureParams {
  rawBody: string | Buffer;
  signature: string;
}

export interface GatewayPaymentDetails {
  id: string;
  amount: number;
  currency: string;
  status: string;
  method?: string;
  orderId?: string;
}

export interface PaymentGateway {
  createOrder(params: CreateGatewayOrderParams): Promise<GatewayOrderResult>;
  verifyPaymentSignature(params: VerifyPaymentSignatureParams): boolean;
  verifyWebhookSignature(params: VerifyWebhookSignatureParams): boolean;
  fetchPayment(paymentId: string): Promise<GatewayPaymentDetails>;
}

