import type { PayPalClient } from "./client";
import {
  PayPalApiError,
  type AuthorizedOrder,
  type CaptureResult,
  type CreatedOrder,
  type CreateOrderInput,
  type CreatePayoutInput,
  type Money,
  type OrderStatus,
  type OrderSummary,
  type PayoutDetails,
  type PayoutResult,
} from "./types";

interface MockOrder {
  id: string;
  intent: "AUTHORIZE" | "CAPTURE";
  status: OrderStatus;
  amount: Money;
  payerEmail?: string;
  authorizationId?: string;
}

/**
 * Deterministic in-memory PayPal fake (MOCK=1 and tests). Mirrors the sandbox's observable behaviour:
 * idempotent replays for a repeated PayPal-Request-Id, DUPLICATE sender_batch_id rejection, and
 * the order/authorization status rules (e.g. you cannot capture a voided authorization).
 */
export class MockPayPalClient implements PayPalClient {
  readonly kind = "mock" as const;
  private seq = 0;
  /** Random per-instance prefix so ids never collide with ones stored in a persistent DB by an earlier process. */
  private readonly run = Math.random().toString(36).slice(2, 6).toUpperCase();
  readonly orders = new Map<string, MockOrder>();
  readonly authorizations = new Map<string, { orderId: string; status: AuthorizedOrder["authorizationStatus"]; amount: Money }>();
  readonly payouts = new Map<string, PayoutDetails & { senderBatchId: string; receiver: string; amount: Money }>();
  private readonly replay = new Map<string, unknown>();
  /** Set to make the next createPayout fail (tests the Invoice fallback path). */
  failNextPayout = false;
  /** Count of real (non-replayed) money movements — tests assert idempotency with this. */
  movements = 0;

  private id(prefix: string) {
    this.seq += 1;
    return `${prefix}${this.run}${String(this.seq).padStart(6, "0")}MOCK`;
  }

  private once<T>(requestId: string, fn: () => T): T {
    if (this.replay.has(requestId)) return this.replay.get(requestId) as T;
    const r = fn();
    this.replay.set(requestId, r);
    return r;
  }

  /** Simulates the payer logging in and approving on PayPal. */
  approve(orderId: string, payerEmail: string) {
    const o = this.orders.get(orderId);
    if (!o) throw new PayPalApiError("Order not found", 404, "RESOURCE_NOT_FOUND");
    o.status = "APPROVED";
    o.payerEmail = payerEmail;
  }

  async createOrder(input: CreateOrderInput): Promise<CreatedOrder> {
    return this.once(input.requestId, () => {
      const id = this.id("ORD");
      this.orders.set(id, { id, intent: input.intent, status: "PAYER_ACTION_REQUIRED", amount: input.amount });
      return { id, status: "PAYER_ACTION_REQUIRED" as const, approveUrl: `https://www.sandbox.paypal.com/checkoutnow?token=${id}` };
    });
  }

  async getOrder(orderId: string): Promise<OrderSummary> {
    const o = this.orders.get(orderId);
    if (!o) throw new PayPalApiError("Order not found", 404, "RESOURCE_NOT_FOUND");
    return { id: o.id, status: o.status, payerEmail: o.payerEmail };
  }

  async authorizeOrder(orderId: string, requestId: string): Promise<AuthorizedOrder> {
    return this.once(requestId, () => {
      const o = this.orders.get(orderId);
      if (!o) throw new PayPalApiError("Order not found", 404, "RESOURCE_NOT_FOUND");
      if (o.intent !== "AUTHORIZE") throw new PayPalApiError("Wrong intent", 422, "ACTION_DOES_NOT_MATCH_INTENT");
      if (o.status !== "APPROVED") throw new PayPalApiError("Payer has not approved", 422, "ORDER_NOT_APPROVED");
      const authId = this.id("AUTH");
      o.status = "COMPLETED";
      o.authorizationId = authId;
      this.authorizations.set(authId, { orderId, status: "CREATED", amount: o.amount });
      return { orderId, orderStatus: "COMPLETED" as const, authorizationId: authId, authorizationStatus: "CREATED" as const };
    });
  }

  async captureOrder(orderId: string, requestId: string): Promise<CaptureResult> {
    return this.once(requestId, () => {
      const o = this.orders.get(orderId);
      if (!o) throw new PayPalApiError("Order not found", 404, "RESOURCE_NOT_FOUND");
      if (o.intent !== "CAPTURE") throw new PayPalApiError("Wrong intent", 422, "ACTION_DOES_NOT_MATCH_INTENT");
      if (o.status !== "APPROVED") throw new PayPalApiError("Payer has not approved", 422, "ORDER_NOT_APPROVED");
      o.status = "COMPLETED";
      this.movements += 1;
      return { captureId: this.id("CAP"), status: "COMPLETED" as const, payerEmail: o.payerEmail };
    });
  }

  async captureAuthorization(authorizationId: string, requestId: string): Promise<CaptureResult> {
    return this.once(requestId, () => {
      const a = this.authorizations.get(authorizationId);
      if (!a) throw new PayPalApiError("Authorization not found", 404, "RESOURCE_NOT_FOUND");
      if (a.status !== "CREATED") throw new PayPalApiError("Authorization not capturable", 422, "AUTHORIZATION_ALREADY_CAPTURED_OR_VOIDED");
      a.status = "CAPTURED";
      this.movements += 1;
      return { captureId: this.id("CAP"), status: "COMPLETED" as const };
    });
  }

  async voidAuthorization(authorizationId: string, requestId: string): Promise<void> {
    return this.once(requestId, () => {
      const a = this.authorizations.get(authorizationId);
      if (!a) throw new PayPalApiError("Authorization not found", 404, "RESOURCE_NOT_FOUND");
      if (a.status === "CAPTURED") throw new PayPalApiError("Already captured", 422, "PREVIOUSLY_CAPTURED");
      a.status = "VOIDED";
    });
  }

  async createPayout(input: CreatePayoutInput): Promise<PayoutResult> {
    return this.once(input.requestId, () => {
      if ([...this.payouts.values()].some((p) => p.senderBatchId === input.senderBatchId)) {
        throw new PayPalApiError("Batch already submitted", 400, "DUPLICATE_REQUEST_ID");
      }
      if (this.failNextPayout) {
        this.failNextPayout = false;
        throw new PayPalApiError("Payouts not enabled for this account", 403, "AUTHORIZATION_ERROR");
      }
      const payoutBatchId = this.id("PB");
      this.payouts.set(payoutBatchId, {
        payoutBatchId,
        batchStatus: "SUCCESS",
        senderBatchId: input.senderBatchId,
        receiver: input.receiverEmail,
        amount: input.amount,
        items: [{ payoutItemId: this.id("PI"), transactionStatus: "SUCCESS", transactionId: this.id("TX") }],
      });
      this.movements += 1;
      return { payoutBatchId, batchStatus: "PENDING" as const };
    });
  }

  async getPayout(payoutBatchId: string): Promise<PayoutDetails> {
    const p = this.payouts.get(payoutBatchId);
    if (!p) throw new PayPalApiError("Payout not found", 404, "RESOURCE_NOT_FOUND");
    return { payoutBatchId: p.payoutBatchId, batchStatus: p.batchStatus, items: p.items };
  }

  async verifyWebhookSignature(): Promise<boolean> {
    return true;
  }

  async createWebhook(): Promise<{ id: string }> {
    return { id: this.id("WH") };
  }
}
