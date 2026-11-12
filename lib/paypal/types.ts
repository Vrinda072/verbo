/**
 * Types for Verbo's PayPal integration.
 *
 * Field names and enums are taken from PayPal's published OpenAPI specs (fetched Nov 4, 2026):
 *   - Orders v2        https://developer.paypal.com/api/orders/v2/schema.json
 *   - Payments v2      https://developer.paypal.com/api/payments/v2/schema.json
 *   - Payouts v1       https://developer.paypal.com/api/payments.payouts-batch/v1/schema.json
 *   - Webhooks v1      https://developer.paypal.com/api/webhooks/v1/schema.json
 * Only the subset Verbo uses is modelled.
 */

/** Orders v2 `order_status` enum. */
export type OrderStatus = "CREATED" | "SAVED" | "APPROVED" | "VOIDED" | "COMPLETED" | "PAYER_ACTION_REQUIRED";
/** Payments v2 `authorization_status.status` enum. */
export type AuthorizationStatus = "CREATED" | "CAPTURED" | "DENIED" | "PARTIALLY_CAPTURED" | "VOIDED" | "PENDING";
/** Payments v2 `capture_status.status` enum. */
export type CaptureStatus = "COMPLETED" | "DECLINED" | "PARTIALLY_REFUNDED" | "PENDING" | "REFUNDED" | "FAILED";
/** Payouts v1 `batch_enum`. */
export type PayoutBatchStatus = "DENIED" | "PENDING" | "PROCESSING" | "SUCCESS" | "CANCELED";
/** Payouts v1 `transaction_enum`. */
export type PayoutItemStatus =
  | "SUCCESS"
  | "FAILED"
  | "PENDING"
  | "UNCLAIMED"
  | "RETURNED"
  | "ONHOLD"
  | "BLOCKED"
  | "REFUNDED"
  | "REVERSED";

/** Verbo is USD-only in the sandbox demo (all sandbox accounts are US). */
export type Currency = "USD";

/** Money as integer minor units (cents) inside Verbo; converted to PayPal's string `value` at the edge. */
export interface Money {
  cents: number;
  currency: Currency;
}

export interface CreateOrderInput {
  intent: "AUTHORIZE" | "CAPTURE";
  amount: Money;
  /** purchase_units[0].reference_id — our transfer / case id. */
  referenceId: string;
  description: string;
  returnUrl: string;
  cancelUrl: string;
  /** Prefills the PayPal login (sandbox convenience). */
  payerEmail?: string;
  requestId: string;
  /** Language of PayPal's approval page (experience_context.locale), e.g. "hi-IN". */
  locale?: string;
}

export interface CreatedOrder {
  id: string;
  status: OrderStatus;
  /** Where the payer approves: link rel "payer-action" (or "approve" for older flows). */
  approveUrl: string;
}

export interface OrderSummary {
  id: string;
  status: OrderStatus;
  payerEmail?: string;
}

export interface AuthorizedOrder {
  orderId: string;
  orderStatus: OrderStatus;
  authorizationId: string;
  authorizationStatus: AuthorizationStatus;
  expirationTime?: string;
}

export interface CaptureResult {
  captureId: string;
  status: CaptureStatus;
  payerEmail?: string;
}

export interface CreatePayoutInput {
  /** sender_batch_header.sender_batch_id — PayPal rejects a reused id, which makes payouts idempotent. */
  senderBatchId: string;
  senderItemId: string;
  receiverEmail: string;
  amount: Money;
  note: string;
  emailSubject: string;
  emailMessage: string;
  requestId: string;
}

export interface PayoutResult {
  payoutBatchId: string;
  batchStatus: PayoutBatchStatus;
}

export interface PayoutDetails extends PayoutResult {
  items: { payoutItemId: string; transactionStatus?: PayoutItemStatus; transactionId?: string }[];
}

/** Headers PayPal sends with each webhook delivery (lower-cased). */
export interface WebhookHeaders {
  "paypal-auth-algo": string;
  "paypal-cert-url": string;
  "paypal-transmission-id": string;
  "paypal-transmission-sig": string;
  "paypal-transmission-time": string;
}

export interface WebhookEvent {
  id: string;
  event_type: string;
  resource_type?: string;
  summary?: string;
  create_time?: string;
  resource: Record<string, unknown>;
}

export class PayPalApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly issue?: string,
    public readonly debugId?: string,
  ) {
    super(message);
    this.name = "PayPalApiError";
  }
}
