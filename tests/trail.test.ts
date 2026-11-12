import { describe, expect, it } from "vitest";
import { paypalTrail } from "@/lib/paypal/trail";
import type { StoredTransfer } from "@/lib/transfers/store";

const base = {
  id: "tr_1",
  state: "VOIDED",
  amount: { cents: 6000, currency: "USD" },
  senderEmail: "a@example.com",
  recipientEmail: "b@example.com",
  createdAt: new Date("2026-11-11T10:00:00Z"),
} as const;
const h = (event: string) => ({ at: "2026-11-11T10:01:00Z", event: event as never, from: "CREATED" as never, to: "CREATED" as never });

describe("PayPal call trail", () => {
  it("lists the SDK order, the authorization, the hold and the void, with the sender's locale", () => {
    const t = { ...base, history: ["APPROVED", "AUTHORIZED", "HOLD_STARTED", "VOIDED"].map(h), meta: { kind: "send", language: "te" } } as unknown as StoredTransfer;
    const steps = paypalTrail(t);
    expect(steps.map((s) => s.operation)).toEqual(["orders.create", "orders.get", "orders.authorize", null, "authorizations.void"]);
    expect(steps[0].via).toBe("APIMatic SDK");
    expect(steps[0].note).toContain("te-IN");
    expect(steps.filter((s) => s.operation && s.operation !== "orders.get").every((s) => s.idempotency)).toBe(true);
  });

  it("shows a return as one capture-intent order", () => {
    const t = { ...base, history: ["APPROVED", "AUTHORIZED", "CAPTURED"].map(h), meta: { kind: "return", language: "ar" } } as unknown as StoredTransfer;
    expect(paypalTrail(t).map((s) => s.operation)).toEqual(["orders.create", "orders.get", "orders.capture"]);
  });
});
