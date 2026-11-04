import { describe, expect, it } from "vitest";
import {
  canTransition,
  fromPayPalValue,
  holdHasEnded,
  holdUntilFrom,
  idempotencyKey,
  IllegalTransitionError,
  money,
  nextState,
  TERMINAL_STATES,
  toPayPalValue,
  type TransferEvent,
  type TransferState,
} from "@/lib/paypal/money";

describe("money helpers", () => {
  it("formats cents as PayPal decimal strings", () => {
    expect(toPayPalValue(money(5000))).toBe("50.00");
    expect(toPayPalValue(money(5))).toBe("0.05");
    expect(toPayPalValue(money(123456))).toBe("1234.56");
  });
  it("round-trips PayPal values", () => {
    for (const v of ["0.01", "1.5", "50.00", "9999.99"]) {
      expect(toPayPalValue(fromPayPalValue(v))).toBe(Number(v).toFixed(2));
    }
  });
  it("rejects non-positive, fractional, oversized and malformed amounts", () => {
    expect(() => money(0)).toThrow();
    expect(() => money(-100)).toThrow();
    expect(() => money(10.5)).toThrow();
    expect(() => money(1_000_001)).toThrow();
    expect(() => fromPayPalValue("1,000.00")).toThrow();
    expect(() => fromPayPalValue("1.234")).toThrow();
  });
});

describe("idempotency keys", () => {
  it("are deterministic per transfer and step", () => {
    expect(idempotencyKey("tr_abc123", "capture")).toBe(idempotencyKey("tr_abc123", "capture"));
    expect(idempotencyKey("tr_abc123", "capture")).not.toBe(idempotencyKey("tr_abc123", "payout"));
    expect(idempotencyKey("tr_abc123", "capture")).not.toBe(idempotencyKey("tr_abc124", "capture"));
  });
  it("only change on an explicit retry attempt", () => {
    expect(idempotencyKey("tr_abc123", "payout", 1)).toBe("verbo-tr_abc123-payout-r1");
  });
  it("reject unsafe transfer ids", () => {
    expect(() => idempotencyKey("a b", "capture")).toThrow();
    expect(() => idempotencyKey("x", "capture")).toThrow();
  });
});

describe("transfer state machine", () => {
  const happy: [TransferState, TransferEvent, TransferState][] = [
    ["CREATED", "APPROVED", "APPROVED"],
    ["APPROVED", "AUTHORIZED", "AUTHORIZED"],
    ["AUTHORIZED", "HOLD_STARTED", "ON_HOLD"],
    ["ON_HOLD", "HOLD_ENDED", "AUTHORIZED"],
    ["AUTHORIZED", "CAPTURED", "CAPTURED"],
    ["CAPTURED", "PAYOUT_SENT", "PAYOUT_PENDING"],
    ["PAYOUT_PENDING", "PAYOUT_SUCCEEDED", "COMPLETED"],
  ];
  it.each(happy)("%s --%s--> %s", (from, ev, to) => expect(nextState(from, ev)).toBe(to));

  it("can void during a hold but never capture during one", () => {
    expect(nextState("ON_HOLD", "VOIDED")).toBe("VOIDED");
    expect(canTransition("ON_HOLD", "CAPTURED")).toBe(false);
  });
  it("cannot void after capture", () => {
    expect(() => nextState("CAPTURED", "VOIDED")).toThrow(IllegalTransitionError);
  });
  it("allows a payout retry or the invoice fallback after a payout failure", () => {
    expect(nextState("PAYOUT_FAILED", "PAYOUT_SENT")).toBe("PAYOUT_PENDING");
    expect(nextState("PAYOUT_FAILED", "INVOICE_SENT")).toBe("INVOICE_FALLBACK");
  });
  it("terminal states accept no events", () => {
    const events: TransferEvent[] = ["APPROVED", "AUTHORIZED", "HOLD_STARTED", "HOLD_ENDED", "CAPTURED", "VOIDED", "CANCELLED", "PAYOUT_SENT", "PAYOUT_SUCCEEDED", "PAYOUT_FAILED", "INVOICE_SENT"];
    for (const s of TERMINAL_STATES) for (const e of events) expect(canTransition(s, e)).toBe(false);
  });
});

describe("risk hold window", () => {
  it("ends exactly after N minutes", () => {
    const start = new Date("2026-11-04T10:00:00Z");
    const until = holdUntilFrom(start, 10);
    expect(holdHasEnded(until, new Date("2026-11-04T10:09:59Z"))).toBe(false);
    expect(holdHasEnded(until, new Date("2026-11-04T10:10:00Z"))).toBe(true);
  });
});
