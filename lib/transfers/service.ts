/**
 * Transfer service: the only place the app moves money. Composes pure flows (lib/paypal/flows.ts),
 * risk (lib/risk), and persistence (lib/store). Every PayPal call inside uses deterministic idempotency
 * keys derived from the transfer id, so retries and racing workers are safe.
 */
import { paypalTrail } from "@/lib/paypal/trail";
import { randomUUID } from "node:crypto";
import { config } from "@/lib/core/config";
import { contactEmail, personById, type Contact } from "@/lib/people/contacts";
import { getPayPal } from "@/lib/paypal";
import { paypalLocale } from "@/lib/paypal/locale";
import { MockPayPalClient } from "@/lib/paypal/mock";
import {
  authorizeTransfer,
  cancelTransfer,
  refreshPayout,
  releaseTransfer,
  startTransfer,
  voidTransfer,
  type Transfer,
} from "@/lib/paypal/flows";
import { holdHasEnded, money } from "@/lib/paypal/money";
import { assessRisk, type RiskAssessment } from "@/lib/risk/score";
import type { Understanding } from "@/lib/agents/extraction";
import {
  getDraft,
  getTransfer,
  getTransferByOrder,
  insertDraft,
  insertTransfer,
  saveTransfer,
  type Draft,
  type StoredTransfer,
} from "@/lib/transfers/store";
import { log } from "@/lib/core/log";

export class TransferError extends Error {
  constructor(public code: string, public status = 400) {
    super(code);
  }
}

const DRAFT_TTL_MS = 15 * 60_000;

/** Validated understanding → risk-scored draft stored server-side. */
export async function createDraft(u: Understanding, transcript: string, language: string): Promise<Draft | null> {
  if (!u.result.ok) return null;
  const d = u.result.draft;
  const risk = assessRisk({
    recipient: d.recipient,
    lookAlikes: d.lookAlikes.map((m) => m.contact),
    cents: d.amount.cents,
    transcript,
    senderLanguage: language,
    modelPressureCues: u.extraction.pressure_cues,
  });
  const draft: Draft = {
    id: randomUUID(),
    language,
    transcript,
    extractor: u.extractor,
    recipientId: d.recipient.id,
    amountCents: d.amount.cents,
    amountSource: d.amountSource,
    risk,
    expiresAt: new Date(Date.now() + DRAFT_TTL_MS),
  };
  await insertDraft(draft);
  return draft;
}

/**
 * A typed phone number and amount → risk-scored draft. The number decides the person; nothing is interpreted.
 * A number one digit from a contact's adds the near-number signal, which holds the payment.
 */
export async function createNumberDraft(args: { recipient: Contact; cents: number; language: string; nearContact?: Contact }): Promise<Draft> {
  const risk = assessRisk({
    recipient: args.recipient,
    lookAlikes: [],
    cents: args.cents,
    transcript: "",
    senderLanguage: args.language,
    nearContact: args.nearContact,
  });
  const draft: Draft = {
    id: randomUUID(),
    language: args.language,
    transcript: `Pay ${args.recipient.phone}`,
    extractor: "number",
    recipientId: args.recipient.id,
    amountCents: args.cents,
    amountSource: "numerals",
    risk,
    expiresAt: new Date(Date.now() + DRAFT_TTL_MS),
  };
  await insertDraft(draft);
  return draft;
}

/** "Yes, send" → PayPal Order (AUTHORIZE). Idempotent per nonce. */
export async function createTransferFromDraft(args: { draftId: string; nonce: string; typedCents?: number }): Promise<StoredTransfer> {
  const id = `tr_${args.nonce}`;
  const existing = await getTransfer(id);
  if (existing) return existing;

  const draft = await getDraft(args.draftId);
  if (!draft) throw new TransferError("draft_not_found", 404);
  if (draft.expiresAt.getTime() < Date.now()) throw new TransferError("draft_expired", 410);
  if (draft.amountSource === "words" && args.typedCents !== draft.amountCents) throw new TransferError("typed_amount_mismatch");

  const contact = personById(draft.recipientId);
  if (!contact) throw new TransferError("unknown_recipient");
  const recipientEmail = contactEmail(contact) ?? (config.mock ? `${contact.id}@example.test` : undefined);
  const senderEmail = process.env.SANDBOX_SENDER_EMAIL || (config.mock ? "sender@example.test" : undefined);
  if (!recipientEmail || !senderEmail) throw new TransferError("recipient_not_payable_in_demo");

  const pp = getPayPal();
  const t = await startTransfer(pp, {
    id,
    amount: money(draft.amountCents),
    senderEmail,
    recipientEmail,
    urls: { returnUrl: `${config.baseUrl}/paypal/return`, cancelUrl: `${config.baseUrl}/paypal/return?cancelled=1` },
    description: `Verbo transfer to ${contact.name} (sandbox)`,
    locale: paypalLocale(draft.language),
  });
  if (pp.kind === "mock") t.approveUrl = `${config.baseUrl}/paypal/return?token=${t.orderId}`;
  try {
    await insertTransfer(t, { kind: "send", draftId: draft.id, recipientId: contact.id, language: draft.language, risk: draft.risk });
  } catch (err) {
    // A simultaneous request for this nonce won the insert. PayPal's idempotency gave both the same order, so use its record.
    const winner = await getTransfer(id);
    if (winner) return winner;
    throw err;
  }
  log.info("transfer created", { id, orderId: t.orderId, risk: draft.risk.level });
  return (await getTransfer(id))!;
}

/** Run one money step and persist it. If a racing worker got there first, return the stored version. */
export async function step(t: StoredTransfer, fn: (t: Transfer) => Promise<Transfer>): Promise<StoredTransfer> {
  let next: Transfer;
  try {
    next = await fn(t);
  } catch (err) {
    const failed = (err as { transfer?: Transfer }).transfer;
    if (failed) await saveTransfer(failed, t);
    throw err;
  }
  await saveTransfer(next, t);
  return (await getTransfer(t.id))!;
}

/** Sender came back from PayPal: authorize; hold if risk is high, otherwise release right away. */
export async function handleApproval(orderId: string, now = new Date()): Promise<StoredTransfer | null> {
  let t = await getTransferByOrder(orderId);
  if (!t) return null;
  const pp = getPayPal();
  if (t.state === "CREATED") {
    // kind check, not instanceof: Next may bundle the mock class twice (route vs page) around one shared instance.
    if (pp.kind === "mock") (pp as MockPayPalClient).approve(orderId, t.senderEmail);
    const holdMinutes = t.meta.risk?.hold ? config.riskHoldMinutes : 0;
    t = await step(t, (x) => authorizeTransfer(pp, x, { now, holdMinutes }));
  }
  return tick(t.id, now);
}

/** Advance whatever is due: release ended holds or unheld authorizations, refresh pending payouts. */
export async function tick(id: string, now = new Date()): Promise<StoredTransfer | null> {
  let t = await getTransfer(id);
  if (!t) return null;
  const pp = getPayPal();
  try {
    if (t.state === "ON_HOLD" && t.holdUntil && holdHasEnded(new Date(t.holdUntil), now)) {
      t = await step(t, (x) => releaseTransfer(pp, x, { now, note: "Sent with Verbo (sandbox)" }));
    } else if (t.state === "AUTHORIZED") {
      t = await step(t, (x) => releaseTransfer(pp, x, { now, note: "Sent with Verbo (sandbox)" }));
    }
    if (t.state === "PAYOUT_PENDING") t = await step(t, (x) => refreshPayout(pp, x, now));
  } catch (err) {
    log.error("tick failed", { id, message: (err as Error).message });
    t = (await getTransfer(id))!;
  }
  return t;
}

/** Sender cancels. During a hold this VOIDs the authorization: no money moved. */
export async function cancel(id: string, now = new Date()): Promise<StoredTransfer> {
  const t = await getTransfer(id);
  if (!t) throw new TransferError("not_found", 404);
  const pp = getPayPal();
  if (t.state === "ON_HOLD" || t.state === "AUTHORIZED") return step(t, (x) => voidTransfer(pp, x, now));
  if (t.state === "CREATED" || t.state === "APPROVED") return step(t, async (x) => cancelTransfer(x, now));
  if (t.state === "VOIDED" || t.state === "CANCELLED") return t;
  throw new TransferError("too_late_to_cancel", 409);
}

/** What the sender's screen may see (no emails, no PayPal ids). */
export function publicView(t: StoredTransfer, now = new Date()) {
  const contact = personById(t.meta.recipientId);
  return {
    id: t.id,
    state: t.state,
    cents: t.amount.cents,
    currency: t.amount.currency,
    recipientName: contact?.name ?? "recipient",
    language: t.meta.language ?? "en",
    approveUrl: t.state === "CREATED" ? t.approveUrl : undefined,
    holdUntil: t.holdUntil ?? null,
    holdMinutes: config.riskHoldMinutes,
    risk: t.meta.risk ? summarizeRisk(t.meta.risk) : null,
    serverNow: now.toISOString(),
    mode: getPayPal().kind,
    trail: paypalTrail(t),
  };
}

export function summarizeRisk(r: RiskAssessment) {
  return { level: r.level, hold: r.hold, signals: r.signals.map((s) => s.code) };
}
