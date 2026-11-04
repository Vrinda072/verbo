import type {
  AuthorizedOrder,
  CaptureResult,
  CreatedOrder,
  CreateOrderInput,
  CreatePayoutInput,
  OrderSummary,
  PayoutDetails,
  PayoutResult,
  WebhookEvent,
  WebhookHeaders,
} from "./types";

/**
 * The PayPal operations Verbo needs. Implemented by `real.ts` (sandbox REST) and `mock.ts` (deterministic fake).
 * Every money-changing method takes a `requestId` that is sent as the `PayPal-Request-Id` idempotency header.
 */
export interface PayPalClient {
  readonly kind: "real" | "mock";

  /** POST /v2/checkout/orders */
  createOrder(input: CreateOrderInput): Promise<CreatedOrder>;
  /** GET /v2/checkout/orders/{id} */
  getOrder(orderId: string): Promise<OrderSummary>;
  /** POST /v2/checkout/orders/{id}/authorize */
  authorizeOrder(orderId: string, requestId: string): Promise<AuthorizedOrder>;
  /** POST /v2/checkout/orders/{id}/capture (intent CAPTURE — used for the return order) */
  captureOrder(orderId: string, requestId: string): Promise<CaptureResult>;
  /** POST /v2/payments/authorizations/{id}/capture */
  captureAuthorization(authorizationId: string, requestId: string): Promise<CaptureResult>;
  /** POST /v2/payments/authorizations/{id}/void */
  voidAuthorization(authorizationId: string, requestId: string): Promise<void>;
  /** POST /v1/payments/payouts */
  createPayout(input: CreatePayoutInput): Promise<PayoutResult>;
  /** GET /v1/payments/payouts/{id} */
  getPayout(payoutBatchId: string): Promise<PayoutDetails>;
  /** POST /v1/notifications/verify-webhook-signature */
  verifyWebhookSignature(headers: WebhookHeaders, event: WebhookEvent, webhookId: string): Promise<boolean>;
  /** POST /v1/notifications/webhooks */
  createWebhook(url: string, eventTypes: string[]): Promise<{ id: string }>;
}

/** Webhook events Verbo subscribes to (names from GET /v1/notifications/webhooks-event-types). */
export const WEBHOOK_EVENT_TYPES = [
  "CHECKOUT.ORDER.APPROVED",
  "PAYMENT.AUTHORIZATION.CREATED",
  "PAYMENT.AUTHORIZATION.VOIDED",
  "PAYMENT.CAPTURE.COMPLETED",
  "PAYMENT.CAPTURE.DENIED",
  "PAYMENT.PAYOUTSBATCH.SUCCESS",
  "PAYMENT.PAYOUTSBATCH.DENIED",
  "PAYMENT.PAYOUTS-ITEM.SUCCEEDED",
  "PAYMENT.PAYOUTS-ITEM.UNCLAIMED",
  "PAYMENT.PAYOUTS-ITEM.FAILED",
] as const;
