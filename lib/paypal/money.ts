import type { Currency, Money } from "./types";

/* ------------------------------------------------------------------ */
/* Money helpers                                                       */
/* ------------------------------------------------------------------ */

export const MAX_SANDBOX_CENTS = 1_000_000; // $10,000 — Verbo refuses anything larger in the demo.

export function money(cents: number, currency: Currency = "USD"): Money {
  if (!Number.isInteger(cents) || cents <= 0) throw new Error("Amount must be a positive whole number of cents");
  if (cents > MAX_SANDBOX_CENTS) throw new Error("Amount exceeds the sandbox limit");
  return { cents, currency };
}

/** PayPal wants a decimal string with 2 fraction digits for USD (`money.value`). */
export function toPayPalValue(m: Money): string {
  const whole = Math.floor(m.cents / 100);
  const frac = String(m.cents % 100).padStart(2, "0");
  return `${whole}.${frac}`;
}

export function fromPayPalValue(value: string, currency: Currency = "USD"): Money {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) throw new Error("Invalid PayPal money value");
  const [w, f = ""] = value.split(".");
  return money(Number(w) * 100 + Number(f.padEnd(2, "0")), currency);
}

/* ------------------------------------------------------------------ */
/* Idempotency                                                         */
/* ------------------------------------------------------------------ */

export type MoneyStep =
  | "create-order"
  | "authorize"
  | "capture"
  | "void"
  | "payout"
  | "return-create-order"
  | "return-capture"
  | "return-payout";

/**
 * Deterministic idempotency key per (transfer, step). Retrying the same step re-sends the same
 * `PayPal-Request-Id`, so PayPal returns the original result instead of moving money twice.
 */
export function idempotencyKey(transferId: string, step: MoneyStep, attempt = 0): string {
  if (!/^[A-Za-z0-9_-]{4,80}$/.test(transferId)) throw new Error("Invalid transfer id");
  return `verbo-${transferId}-${step}${attempt ? `-r${attempt}` : ""}`;
}

/* ------------------------------------------------------------------ */
/* Transfer state machine                                              */
/* ------------------------------------------------------------------ */

/**
 * Sender → (Order AUTHORIZE) → platform → (Payout) → recipient.
 *
 *  CREATED ──APPROVED──▶ APPROVED ──AUTHORIZED──▶ AUTHORIZED ──HOLD_STARTED──▶ ON_HOLD
 *     │                     │                        │   │                        │  │
 *  CANCELLED            CANCELLED                 VOIDED CAPTURED ◀──HOLD_ENDED───┘  VOIDED
 *                                                          │
 *                                                   PAYOUT_SENT ─▶ PAYOUT_PENDING ─▶ COMPLETED
 *                                                                        │
 *                                                                  PAYOUT_FAILED ─▶ INVOICE_FALLBACK
 */
export type TransferState =
  | "CREATED"
  | "APPROVED"
  | "AUTHORIZED"
  | "ON_HOLD"
  | "CAPTURED"
  | "PAYOUT_PENDING"
  | "COMPLETED"
  | "VOIDED"
  | "CANCELLED"
  | "PAYOUT_FAILED"
  | "INVOICE_FALLBACK";

export type TransferEvent =
  | "APPROVED"
  | "AUTHORIZED"
  | "HOLD_STARTED"
  | "HOLD_ENDED"
  | "CAPTURED"
  | "VOIDED"
  | "CANCELLED"
  | "PAYOUT_SENT"
  | "PAYOUT_SUCCEEDED"
  | "PAYOUT_FAILED"
  | "INVOICE_SENT";

const TRANSITIONS: Record<TransferState, Partial<Record<TransferEvent, TransferState>>> = {
  CREATED: { APPROVED: "APPROVED", CANCELLED: "CANCELLED" },
  APPROVED: { AUTHORIZED: "AUTHORIZED", CANCELLED: "CANCELLED" },
  AUTHORIZED: { HOLD_STARTED: "ON_HOLD", CAPTURED: "CAPTURED", VOIDED: "VOIDED" },
  ON_HOLD: { HOLD_ENDED: "AUTHORIZED", VOIDED: "VOIDED" },
  CAPTURED: { PAYOUT_SENT: "PAYOUT_PENDING" },
  PAYOUT_PENDING: { PAYOUT_SUCCEEDED: "COMPLETED", PAYOUT_FAILED: "PAYOUT_FAILED" },
  PAYOUT_FAILED: { PAYOUT_SENT: "PAYOUT_PENDING", INVOICE_SENT: "INVOICE_FALLBACK" },
  COMPLETED: {},
  VOIDED: {},
  CANCELLED: {},
  INVOICE_FALLBACK: {},
};

export const TERMINAL_STATES: ReadonlySet<TransferState> = new Set(["COMPLETED", "VOIDED", "CANCELLED", "INVOICE_FALLBACK"]);

export class IllegalTransitionError extends Error {
  constructor(
    public readonly from: TransferState,
    public readonly event: TransferEvent,
  ) {
    super(`Illegal transfer transition: ${from} --${event}-->`);
    this.name = "IllegalTransitionError";
  }
}

export function nextState(from: TransferState, event: TransferEvent): TransferState {
  const to = TRANSITIONS[from][event];
  if (!to) throw new IllegalTransitionError(from, event);
  return to;
}

export function canTransition(from: TransferState, event: TransferEvent): boolean {
  return Boolean(TRANSITIONS[from][event]);
}

/** A risk hold may only be released (captured) once its window has fully elapsed. */
export function holdHasEnded(holdUntil: Date, now: Date): boolean {
  return now.getTime() >= holdUntil.getTime();
}

export function holdUntilFrom(start: Date, minutes: number): Date {
  return new Date(start.getTime() + minutes * 60_000);
}
