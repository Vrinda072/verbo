import { assertSandbox, config } from "@/lib/config";
import { log } from "@/lib/log";
import type { PayPalClient } from "./client";
import { toPayPalValue } from "./money";
import {
  PayPalApiError,
  type AuthorizedOrder,
  type CaptureResult,
  type CreatedOrder,
  type CreateOrderInput,
  type CreatePayoutInput,
  type OrderSummary,
  type PayoutDetails,
  type PayoutResult,
  type WebhookEvent,
  type WebhookHeaders,
} from "./types";

/**
 * Real PayPal sandbox client (REST, no SDK).
 *
 * Every endpoint, header and body field below was checked against PayPal's OpenAPI specs
 * (developer.paypal.com/api/<api>/<version>/schema.json, fetched Nov 4, 2026). Each method
 * names the spec `operationId` it implements.
 */
export class RealPayPalClient implements PayPalClient {
  readonly kind = "real" as const;
  private token?: { value: string; expiresAt: number };

  constructor(
    private readonly clientId = process.env.PAYPAL_CLIENT_ID ?? "",
    private readonly clientSecret = process.env.PAYPAL_CLIENT_SECRET ?? "",
    private readonly base = config.paypal.apiBase,
  ) {
    assertSandbox();
    if (!clientId || !clientSecret) {
      throw new Error("PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are not set (see npm run check-env)");
    }
  }

  /** OAuth 2.0 client credentials: POST /v1/oauth2/token (grant_type=client_credentials, HTTP Basic). */
  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;
    const res = await fetch(`${this.base}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) throw new PayPalApiError("PayPal OAuth failed — check client id/secret", res.status);
    const json = (await res.json()) as { access_token: string; expires_in: number };
    this.token = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
    return json.access_token;
  }

  private async call<T>(
    method: "GET" | "POST",
    path: string,
    opts: { body?: unknown; requestId?: string; prefer?: "return=minimal" | "return=representation" } = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${await this.accessToken()}`,
      "Content-Type": "application/json",
    };
    if (opts.requestId) headers["PayPal-Request-Id"] = opts.requestId; // idempotency (spec parameter paypal_request_id)
    if (opts.prefer) headers["Prefer"] = opts.prefer;

    const res = await fetch(`${this.base}${path}`, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const debugId = res.headers.get("paypal-debug-id") ?? undefined;
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    const json = text ? JSON.parse(text) : undefined;
    if (!res.ok) {
      const issue: string | undefined = json?.details?.[0]?.issue ?? json?.name;
      log.warn("paypal call failed", { method, path: path.replace(/\/[A-Z0-9]{10,}/g, "/:id"), status: res.status, issue, debugId });
      throw new PayPalApiError(json?.message ?? `PayPal ${method} ${path} failed`, res.status, issue, debugId);
    }
    return json as T;
  }

  /** operationId orders.create — POST /v2/checkout/orders */
  async createOrder(input: CreateOrderInput): Promise<CreatedOrder> {
    const body = {
      intent: input.intent, // checkout_payment_intent: CAPTURE | AUTHORIZE
      purchase_units: [
        {
          reference_id: input.referenceId,
          description: input.description,
          amount: { currency_code: input.amount.currency, value: toPayPalValue(input.amount) },
          // no `payee`: funds go to the REST app's own account (the Verbo Platform business account)
        },
      ],
      payment_source: {
        paypal: {
          ...(input.payerEmail ? { email_address: input.payerEmail } : {}),
          experience_context: {
            brand_name: config.appName,
            shipping_preference: "NO_SHIPPING",
            user_action: "CONTINUE",
            landing_page: "LOGIN",
            return_url: input.returnUrl,
            cancel_url: input.cancelUrl,
          },
        },
      },
    };
    const order = await this.call<{ id: string; status: CreatedOrder["status"]; links: { rel: string; href: string }[] }>(
      "POST",
      "/v2/checkout/orders",
      { body, requestId: input.requestId, prefer: "return=representation" },
    );
    const link = order.links.find((l) => l.rel === "payer-action") ?? order.links.find((l) => l.rel === "approve");
    if (!link) throw new PayPalApiError("Order has no approval link", 500);
    return { id: order.id, status: order.status, approveUrl: link.href };
  }

  /** operationId orders.get — GET /v2/checkout/orders/{id} */
  async getOrder(orderId: string): Promise<OrderSummary> {
    const o = await this.call<{ id: string; status: OrderSummary["status"]; payer?: { email_address?: string } }>(
      "GET",
      `/v2/checkout/orders/${encodeURIComponent(orderId)}`,
    );
    return { id: o.id, status: o.status, payerEmail: o.payer?.email_address };
  }

  /** operationId orders.authorize — POST /v2/checkout/orders/{id}/authorize */
  async authorizeOrder(orderId: string, requestId: string): Promise<AuthorizedOrder> {
    const o = await this.call<{
      id: string;
      status: AuthorizedOrder["orderStatus"];
      purchase_units: { payments?: { authorizations?: { id: string; status: AuthorizedOrder["authorizationStatus"]; expiration_time?: string }[] } }[];
    }>("POST", `/v2/checkout/orders/${encodeURIComponent(orderId)}/authorize`, {
      body: {},
      requestId,
      prefer: "return=representation",
    });
    const auth = o.purchase_units?.[0]?.payments?.authorizations?.[0];
    if (!auth) throw new PayPalApiError("Authorize response has no authorization", 500);
    return {
      orderId: o.id,
      orderStatus: o.status,
      authorizationId: auth.id,
      authorizationStatus: auth.status,
      expirationTime: auth.expiration_time,
    };
  }

  /** operationId orders.capture — POST /v2/checkout/orders/{id}/capture */
  async captureOrder(orderId: string, requestId: string): Promise<CaptureResult> {
    const o = await this.call<{
      payer?: { email_address?: string };
      purchase_units: { payments?: { captures?: { id: string; status: CaptureResult["status"] }[] } }[];
    }>("POST", `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      body: {},
      requestId,
      prefer: "return=representation",
    });
    const cap = o.purchase_units?.[0]?.payments?.captures?.[0];
    if (!cap) throw new PayPalApiError("Capture response has no capture", 500);
    return { captureId: cap.id, status: cap.status, payerEmail: o.payer?.email_address };
  }

  /** operationId authorizations.capture — POST /v2/payments/authorizations/{authorization_id}/capture */
  async captureAuthorization(authorizationId: string, requestId: string): Promise<CaptureResult> {
    const c = await this.call<{ id: string; status: CaptureResult["status"] }>(
      "POST",
      `/v2/payments/authorizations/${encodeURIComponent(authorizationId)}/capture`,
      // capture_request: omitting `amount` captures the full authorized amount
      { body: { final_capture: true }, requestId, prefer: "return=representation" },
    );
    return { captureId: c.id, status: c.status };
  }

  /** operationId authorizations.void — POST /v2/payments/authorizations/{authorization_id}/void (no body; 204 or 200) */
  async voidAuthorization(authorizationId: string, requestId: string): Promise<void> {
    await this.call<void>("POST", `/v2/payments/authorizations/${encodeURIComponent(authorizationId)}/void`, {
      requestId,
      prefer: "return=minimal",
    });
  }

  /** operationId payouts.post — POST /v1/payments/payouts */
  async createPayout(input: CreatePayoutInput): Promise<PayoutResult> {
    const body = {
      sender_batch_header: {
        sender_batch_id: input.senderBatchId,
        recipient_type: "EMAIL", // recipient_enum: EMAIL | PHONE | PAYPAL_ID
        email_subject: input.emailSubject,
        email_message: input.emailMessage,
      },
      items: [
        {
          recipient_type: "EMAIL",
          // Payouts uses `currency` + `value` (schema `currency`), not Orders' `currency_code`
          amount: { currency: input.amount.currency, value: toPayPalValue(input.amount) },
          receiver: input.receiverEmail,
          note: input.note,
          sender_item_id: input.senderItemId,
        },
      ],
    };
    const r = await this.call<{ batch_header: { payout_batch_id: string; batch_status: PayoutResult["batchStatus"] } }>(
      "POST",
      "/v1/payments/payouts",
      { body, requestId: input.requestId },
    );
    return { payoutBatchId: r.batch_header.payout_batch_id, batchStatus: r.batch_header.batch_status };
  }

  /** operationId payouts.get — GET /v1/payments/payouts/{id} */
  async getPayout(payoutBatchId: string): Promise<PayoutDetails> {
    const r = await this.call<{
      batch_header: { payout_batch_id: string; batch_status: PayoutResult["batchStatus"] };
      items?: { payout_item_id: string; transaction_status?: PayoutDetails["items"][number]["transactionStatus"]; transaction_id?: string }[];
    }>("GET", `/v1/payments/payouts/${encodeURIComponent(payoutBatchId)}`);
    return {
      payoutBatchId: r.batch_header.payout_batch_id,
      batchStatus: r.batch_header.batch_status,
      items: (r.items ?? []).map((i) => ({
        payoutItemId: i.payout_item_id,
        transactionStatus: i.transaction_status,
        transactionId: i.transaction_id,
      })),
    };
  }

  /** operationId verify-webhook-signature.post — POST /v1/notifications/verify-webhook-signature */
  async verifyWebhookSignature(headers: WebhookHeaders, event: WebhookEvent, webhookId: string): Promise<boolean> {
    const r = await this.call<{ verification_status: "SUCCESS" | "FAILURE" }>(
      "POST",
      "/v1/notifications/verify-webhook-signature",
      {
        body: {
          auth_algo: headers["paypal-auth-algo"],
          cert_url: headers["paypal-cert-url"],
          transmission_id: headers["paypal-transmission-id"],
          transmission_sig: headers["paypal-transmission-sig"],
          transmission_time: headers["paypal-transmission-time"],
          webhook_id: webhookId,
          webhook_event: event,
        },
      },
    );
    return r.verification_status === "SUCCESS";
  }

  /** operationId webhooks.post — POST /v1/notifications/webhooks */
  async createWebhook(url: string, eventTypes: string[]): Promise<{ id: string }> {
    const r = await this.call<{ id: string }>("POST", "/v1/notifications/webhooks", {
      body: { url, event_types: eventTypes.map((name) => ({ name })) },
    });
    return { id: r.id };
  }

  /** operationId webhooks-event-types.list — GET /v1/notifications/webhooks-event-types */
  async listAvailableEventTypes(): Promise<string[]> {
    const r = await this.call<{ event_types: { name: string }[] }>("GET", "/v1/notifications/webhooks-event-types");
    return r.event_types.map((e) => e.name);
  }
}
