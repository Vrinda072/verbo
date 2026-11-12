/**
 * The PayPal operations behind one transfer, read from its own state history. Each state change in money.ts is made by
 * exactly one PayPal call (or none, for the hold), so the trail is derived, not logged separately.
 * Operation names are the PayPal OpenAPI operationIds already cited in real.ts and sdk.ts.
 */
import type { StoredTransfer } from "@/lib/transfers/store";
import { paypalLocale } from "./locale";

export interface TrailStep {
  at: string;
  /** PayPal operationId, or null for a step that makes no PayPal call. */
  operation: string | null;
  endpoint: string | null;
  /** How the call is made: PayPal's APIMatic-generated Server SDK, or a typed REST call. */
  via: "APIMatic SDK" | "REST" | null;
  /** The idempotency header or field the call carries. */
  idempotency: string | null;
  note: string;
}

const BY_EVENT: Record<string, Omit<TrailStep, "at">> = {
  APPROVED: { operation: "orders.get", endpoint: "GET /v2/checkout/orders/{id}", via: "REST", idempotency: null, note: "Checked that the sender approved on PayPal." },
  AUTHORIZED: {
    operation: "orders.authorize",
    endpoint: "POST /v2/checkout/orders/{id}/authorize",
    via: "REST",
    idempotency: "PayPal-Request-Id",
    note: "Money reserved on the sender's account, not taken.",
  },
  HOLD_STARTED: { operation: null, endpoint: null, via: null, idempotency: null, note: "Safety hold. No PayPal call: the authorization waits." },
  HOLD_ENDED: { operation: null, endpoint: null, via: null, idempotency: null, note: "Hold over." },
  CAPTURED: {
    operation: "authorizations.capture",
    endpoint: "POST /v2/payments/authorizations/{id}/capture",
    via: "REST",
    idempotency: "PayPal-Request-Id",
    note: "Money taken from the sender.",
  },
  VOIDED: {
    operation: "authorizations.void",
    endpoint: "POST /v2/payments/authorizations/{id}/void",
    via: "REST",
    idempotency: "PayPal-Request-Id",
    note: "Authorization released. Nothing moved.",
  },
  PAYOUT_SENT: {
    operation: "payouts.post",
    endpoint: "POST /v1/payments/payouts",
    via: "REST",
    idempotency: "sender_batch_id",
    note: "Money sent to the recipient.",
  },
  PAYOUT_SUCCEEDED: { operation: "payouts.get", endpoint: "GET /v1/payments/payouts/{id}", via: "REST", idempotency: null, note: "PayPal confirmed the payout." },
  PAYOUT_FAILED: { operation: "payouts.get", endpoint: "GET /v1/payments/payouts/{id}", via: "REST", idempotency: null, note: "PayPal reported the payout failed." },
};

/** A return is one capture-intent order: PayPal captures it directly, with no separate authorization. */
const RETURN_CAPTURE: Omit<TrailStep, "at"> = {
  operation: "orders.capture",
  endpoint: "POST /v2/checkout/orders/{id}/capture",
  via: "REST",
  idempotency: "PayPal-Request-Id",
  note: "Money taken from the person returning it.",
};

export function paypalTrail(t: StoredTransfer): TrailStep[] {
  const locale = paypalLocale(t.meta.language);
  const isReturn = t.meta.kind === "return";
  const steps: TrailStep[] = [
    {
      at: t.createdAt.toISOString(),
      operation: "orders.create",
      endpoint: "POST /v2/checkout/orders",
      via: "APIMatic SDK",
      idempotency: "PayPal-Request-Id",
      note: `OrdersController.createOrder, intent ${isReturn ? "CAPTURE" : "AUTHORIZE"}${locale ? `, approval page locale ${locale}` : ""}.`,
    },
  ];
  for (const h of t.history) {
    if (isReturn && h.event === "AUTHORIZED") continue;
    const s = isReturn && h.event === "CAPTURED" ? RETURN_CAPTURE : BY_EVENT[h.event];
    if (s) steps.push({ at: h.at, ...s });
  }
  return steps;
}
