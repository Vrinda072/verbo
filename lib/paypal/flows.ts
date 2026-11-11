import type { PayPalClient } from "./client";
import {
  holdHasEnded,
  holdUntilFrom,
  idempotencyKey,
  nextState,
  type TransferEvent,
  type TransferState,
} from "./money";
import { PayPalApiError, type Money, type PayoutResult } from "./types";

/**
 * Platform-mediated money flows. Pure orchestration over a PayPalClient — no DB, no HTTP framework —
 * so the same code runs in the app, in scripts/money-loop.ts and in tests.
 *
 *   send:   Order(AUTHORIZE) → payer approves → authorize → [risk hold] → capture → Payout to recipient
 *   cancel: authorize → VOID (sender cancelled during the hold)
 *   return: Order(CAPTURE) paid by the wrong recipient → capture → Payout back to the original sender
 */

export interface Transfer {
  id: string;
  state: TransferState;
  amount: Money;
  senderEmail: string;
  recipientEmail: string;
  orderId?: string;
  approveUrl?: string;
  authorizationId?: string;
  captureId?: string;
  payoutBatchId?: string;
  holdUntil?: string;
  history: { at: string; event: TransferEvent; from: TransferState; to: TransferState }[];
}

function apply(t: Transfer, event: TransferEvent, now: Date): Transfer {
  const to = nextState(t.state, event);
  return { ...t, state: to, history: [...t.history, { at: now.toISOString(), event, from: t.state, to }] };
}

export interface FlowUrls {
  returnUrl: string;
  cancelUrl: string;
}

export async function startTransfer(
  pp: PayPalClient,
  args: { id: string; amount: Money; senderEmail: string; recipientEmail: string; urls: FlowUrls; locale?: string; description?: string },
): Promise<Transfer> {
  const order = await pp.createOrder({
    intent: "AUTHORIZE",
    amount: args.amount,
    referenceId: args.id,
    description: args.description ?? "Verbo transfer (sandbox)",
    returnUrl: args.urls.returnUrl,
    cancelUrl: args.urls.cancelUrl,
    payerEmail: args.senderEmail,
    locale: args.locale,
    requestId: idempotencyKey(args.id, "create-order"),
  });
  return {
    id: args.id,
    state: "CREATED",
    amount: args.amount,
    senderEmail: args.senderEmail,
    recipientEmail: args.recipientEmail,
    orderId: order.id,
    approveUrl: order.approveUrl,
    history: [],
  };
}

/** Call after the payer approved (webhook CHECKOUT.ORDER.APPROVED or polling GET order). */
export async function authorizeTransfer(
  pp: PayPalClient,
  t: Transfer,
  opts: { now?: Date; holdMinutes?: number } = {},
): Promise<Transfer> {
  const now = opts.now ?? new Date();
  if (!t.orderId) throw new Error("Transfer has no order");
  const order = await pp.getOrder(t.orderId);
  if (order.status !== "APPROVED") throw new PayPalApiError(`Order is ${order.status}, not APPROVED`, 409, "ORDER_NOT_APPROVED");
  let next = apply(t, "APPROVED", now);
  const auth = await pp.authorizeOrder(t.orderId, idempotencyKey(t.id, "authorize"));
  next = apply({ ...next, authorizationId: auth.authorizationId }, "AUTHORIZED", now);
  if (opts.holdMinutes && opts.holdMinutes > 0) {
    next = apply({ ...next, holdUntil: holdUntilFrom(now, opts.holdMinutes).toISOString() }, "HOLD_STARTED", now);
  }
  return next;
}

/** Sender cancelled before approving/authorizing on PayPal: nothing to call, nothing moved. */
export function cancelTransfer(t: Transfer, now = new Date()): Transfer {
  return apply(t, "CANCELLED", now);
}

/** Sender cancelled (or risk confirmed): void the uncaptured authorization. No money moved. */
export async function voidTransfer(pp: PayPalClient, t: Transfer, now = new Date()): Promise<Transfer> {
  if (!t.authorizationId) throw new Error("Transfer has no authorization");
  await pp.voidAuthorization(t.authorizationId, idempotencyKey(t.id, "void"));
  return apply(t, "VOIDED", now);
}

/** Capture the authorization and pay the recipient out from the platform account. */
export async function releaseTransfer(
  pp: PayPalClient,
  t: Transfer,
  opts: { now?: Date; note?: string } = {},
): Promise<Transfer> {
  const now = opts.now ?? new Date();
  if (!t.authorizationId) throw new Error("Transfer has no authorization");
  let next = t;
  if (next.state === "ON_HOLD") {
    if (!next.holdUntil || !holdHasEnded(new Date(next.holdUntil), now)) {
      throw new Error("Risk hold has not ended yet");
    }
    next = apply(next, "HOLD_ENDED", now);
  }
  const cap = await pp.captureAuthorization(t.authorizationId, idempotencyKey(t.id, "capture"));
  if (cap.status !== "COMPLETED" && cap.status !== "PENDING") {
    throw new PayPalApiError(`Capture ${cap.status}`, 422, "CAPTURE_NOT_COMPLETED");
  }
  next = apply({ ...next, captureId: cap.captureId }, "CAPTURED", now);
  return payout(pp, next, { now, note: opts.note, step: "payout", receiver: t.recipientEmail });
}

async function payout(
  pp: PayPalClient,
  t: Transfer,
  o: { now: Date; note?: string; step: "payout" | "return-payout"; receiver: string },
): Promise<Transfer> {
  const key = idempotencyKey(t.id, o.step);
  let r: PayoutResult;
  try {
    r = await pp.createPayout({
      senderBatchId: key,
      senderItemId: `${t.id}-item`,
      receiverEmail: o.receiver,
      amount: t.amount,
      note: o.note ?? "Sent with Verbo (sandbox)",
      emailSubject: o.step === "payout" ? "You received money via Verbo" : "Your money was returned via Verbo",
      emailMessage: "This is a PayPal sandbox payment sent through Verbo.",
      requestId: key,
    });
  } catch (err) {
    const failed = apply(apply(t, "PAYOUT_SENT", o.now), "PAYOUT_FAILED", o.now);
    throw Object.assign(err as Error, { transfer: failed });
  }
  const sent = apply({ ...t, payoutBatchId: r.payoutBatchId }, "PAYOUT_SENT", o.now);
  return r.batchStatus === "DENIED" ? apply(sent, "PAYOUT_FAILED", o.now) : sent;
}

/** Poll result → state. SUCCESS completes; DENIED/CANCELED fails; PENDING/PROCESSING stays. */
export async function refreshPayout(pp: PayPalClient, t: Transfer, now = new Date()): Promise<Transfer> {
  if (!t.payoutBatchId || t.state !== "PAYOUT_PENDING") return t;
  const p = await pp.getPayout(t.payoutBatchId);
  if (p.batchStatus === "SUCCESS") return apply(t, "PAYOUT_SUCCEEDED", now);
  if (p.batchStatus === "DENIED" || p.batchStatus === "CANCELED") return apply(t, "PAYOUT_FAILED", now);
  return t;
}

/* ------------------------------------------------------------------ */
/* Return path                                                         */
/* ------------------------------------------------------------------ */

/**
 * The wrong recipient chooses to return the money. They approve an Order (intent CAPTURE) paid to the
 * platform; we capture it and pay the original sender back via Payout.
 * The return is modelled as its own Transfer (sender = wrong recipient, recipient = original sender).
 */
export async function startReturn(
  pp: PayPalClient,
  args: { id: string; original: Transfer; returnerEmail: string; urls: FlowUrls; locale?: string },
): Promise<Transfer> {
  const order = await pp.createOrder({
    intent: "CAPTURE",
    amount: args.original.amount,
    referenceId: args.id,
    description: "Return a payment sent by mistake (Verbo, sandbox)",
    returnUrl: args.urls.returnUrl,
    cancelUrl: args.urls.cancelUrl,
    payerEmail: args.returnerEmail,
    locale: args.locale,
    requestId: idempotencyKey(args.id, "return-create-order"),
  });
  return {
    id: args.id,
    state: "CREATED",
    amount: args.original.amount,
    senderEmail: args.returnerEmail,
    recipientEmail: args.original.senderEmail,
    orderId: order.id,
    approveUrl: order.approveUrl,
    history: [],
  };
}

export async function completeReturn(pp: PayPalClient, t: Transfer, now = new Date()): Promise<Transfer> {
  if (!t.orderId) throw new Error("Return has no order");
  const order = await pp.getOrder(t.orderId);
  if (order.status !== "APPROVED") throw new PayPalApiError(`Order is ${order.status}, not APPROVED`, 409, "ORDER_NOT_APPROVED");
  let next = apply(t, "APPROVED", now);
  const cap = await pp.captureOrder(t.orderId, idempotencyKey(t.id, "return-capture"));
  // Capture-on-order skips the separate authorization step: model it as AUTHORIZED → CAPTURED.
  next = apply(next, "AUTHORIZED", now);
  next = apply({ ...next, captureId: cap.captureId }, "CAPTURED", now);
  return payout(pp, next, { now, step: "return-payout", receiver: t.recipientEmail, note: "Returned with Verbo (sandbox)" });
}
