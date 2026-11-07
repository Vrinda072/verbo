/**
 * Recovery: after a completed transfer went to the wrong person, the sender opens a case; the recipient gets a
 * signed link in their language and can return the money with one tap (they approve a PayPal order themselves —
 * Verbo cannot take money from anyone), refuse, or reply. Timers send a reminder at 24 h and escalate at 72 h.
 */
import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { config } from "@/lib/config";
import { CONTACTS, SENDER } from "@/lib/contacts";
import { getPayPal } from "@/lib/paypal";
import type { MockPayPalClient } from "@/lib/paypal/mock";
import { completeReturn, startReturn } from "@/lib/paypal/flows";
import { getTransfer, getTransferByOrder, insertTransfer, type StoredTransfer } from "@/lib/store/transfers";
import { step, tick, TransferError } from "@/lib/transfers/service";
import { getTranslator } from "@/lib/bridge/translate";
import { signRecoveryToken, verifyRecoveryToken } from "./token";
import { dueTimerEvent, nextCaseState, OPEN_STATES, type CaseEvent, type CaseState } from "./state";
import { log } from "@/lib/log";

type CaseRow = typeof schema.cases.$inferSelect;
type Actor = "sender" | "recipient" | "system" | "operator";

async function loadCase(id: string): Promise<CaseRow | null> {
  const db = await getDb();
  const [c] = await db.select().from(schema.cases).where(eq(schema.cases.id, id));
  return c ?? null;
}

/** Apply one event with an optimistic state check and append it to the immutable timeline. */
async function applyEvent(
  c: CaseRow,
  event: CaseEvent,
  actor: Actor,
  opts: { now?: Date; data?: Record<string, unknown>; set?: Partial<typeof schema.cases.$inferInsert> } = {},
): Promise<CaseRow> {
  const now = opts.now ?? new Date();
  const to = nextCaseState(c.state as CaseState, event);
  const db = await getDb();
  const updated = await db
    .update(schema.cases)
    .set({ state: to, updatedAt: now, ...opts.set })
    .where(and(eq(schema.cases.id, c.id), eq(schema.cases.state, c.state)))
    .returning();
  if (!updated.length) throw new TransferError("case_changed_concurrently", 409);
  await db.insert(schema.caseEvents).values({ caseId: c.id, event, fromState: c.state, toState: to, actor, at: now, data: opts.data });
  return updated[0];
}

export function recoveryLink(caseId: string, now = new Date()): string {
  return `${config.baseUrl}/recover/${signRecoveryToken(caseId, now)}`;
}

/** Sender says the completed transfer went to the wrong person. One case per transfer. */
export async function openCase(transferId: string, now = new Date()): Promise<{ caseRow: CaseRow; link: string }> {
  const db = await getDb();
  const [existing] = await db.select().from(schema.cases).where(eq(schema.cases.transferId, transferId));
  if (existing) return { caseRow: existing, link: recoveryLink(existing.id, now) };

  const t = await getTransfer(transferId);
  if (!t || t.meta.kind !== "send") throw new TransferError("not_found", 404);
  if (t.state !== "COMPLETED" && t.state !== "PAYOUT_PENDING") throw new TransferError("transfer_not_completed", 409);
  const contact = CONTACTS.find((c) => c.id === t.meta.recipientId);

  const id = `case_${randomUUID()}`;
  const [row] = await db
    .insert(schema.cases)
    .values({
      id,
      transferId,
      state: "OPENED",
      senderName: SENDER.name,
      senderLanguage: t.meta.language ?? SENDER.language,
      recipientContactId: contact?.id,
      recipientName: contact?.name ?? "Recipient",
      recipientLanguage: contact?.language ?? "en",
      amountCents: t.amount.cents,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  await db.insert(schema.caseEvents).values({ caseId: id, event: "OPENED", fromState: "OPENED", toState: "OPENED", actor: "sender", at: now });
  // Delivery is simulated in the demo (PayPal message / SMS would carry the link in production).
  const sent = await applyEvent(row, "LINK_SENT", "system", { now, set: { linkSentAt: now }, data: { channel: "simulated" } });
  return { caseRow: sent, link: recoveryLink(id, now) };
}

export async function caseFromToken(token: string, now = new Date()) {
  const v = verifyRecoveryToken(token, now);
  if (!v.ok) return { ok: false as const, reason: v.reason };
  const c = await loadCase(v.claims.c);
  if (!c) return { ok: false as const, reason: "not_found" as const };
  return { ok: true as const, caseRow: c };
}

export async function recordView(c: CaseRow, now = new Date()): Promise<CaseRow> {
  if (c.state !== "LINK_SENT") return c; // only the first view moves the case; later views are not logged
  return applyEvent(c, "VIEWED", "recipient", { now });
}

export async function postMessage(c: CaseRow, author: "sender" | "recipient", text: string, lang: string, now = new Date()) {
  const clean = text.trim().slice(0, 1000);
  if (!clean) throw new TransferError("empty_message");
  const target = author === "sender" ? c.recipientLanguage : c.senderLanguage;
  const tr = await getTranslator().translate(clean, lang, target);
  const db = await getDb();
  await db.insert(schema.caseMessages).values({
    caseId: c.id,
    author,
    text: clean,
    lang,
    translatedText: tr.text,
    translatedLang: tr.text ? target : null,
    translator: tr.text ? tr.translator : "none",
    at: now,
  });
  const ev: CaseEvent = author === "recipient" ? "REPLIED" : "MESSAGE";
  return applyEvent(c, ev, author, { now, data: { translated: Boolean(tr.text), note: tr.note } });
}

export async function refuse(c: CaseRow, now = new Date()) {
  return applyEvent(c, "REFUSED", "recipient", { now });
}

/** Recipient taps "Send it back": create a CAPTURE order they pay to the platform. */
export async function startCaseReturn(c: CaseRow, now = new Date()): Promise<{ approveUrl: string }> {
  if (!["VIEWED", "REPLIED", "REFUSED", "ESCALATED"].includes(c.state)) throw new TransferError("case_not_returnable", 409);
  const original = await getTransfer(c.transferId);
  if (!original) throw new TransferError("not_found", 404);

  if (c.returnTransferId) {
    const existing = await getTransfer(c.returnTransferId);
    if (existing?.state === "CREATED" && existing.approveUrl) return { approveUrl: existing.approveUrl };
    if (existing && existing.state !== "CANCELLED") throw new TransferError("return_in_progress", 409);
  }

  const pp = getPayPal();
  const id = `rt_${randomUUID()}`;
  const r = await startReturn(pp, {
    id,
    original,
    returnerEmail: original.recipientEmail,
    urls: { returnUrl: `${config.baseUrl}/paypal/return`, cancelUrl: `${config.baseUrl}/paypal/return?cancelled=1` },
  });
  if (pp.kind === "mock") r.approveUrl = `${config.baseUrl}/paypal/return?token=${r.orderId}`;
  await insertTransfer(r, { kind: "return", originalTransferId: original.id, recipientId: "sender", language: c.recipientLanguage });
  await applyEvent(c, "RETURN_STARTED", "recipient", { now, set: { returnTransferId: id }, data: { returnTransferId: id } });
  return { approveUrl: r.approveUrl! };
}

/** The recipient approved the return order on PayPal: capture, pay the sender back, mark the case RETURNED. */
export async function handleReturnApproval(orderId: string, now = new Date()): Promise<{ caseId: string; transfer: StoredTransfer } | null> {
  let t = await getTransferByOrder(orderId);
  if (!t || t.meta.kind !== "return") return null;
  const db = await getDb();
  const [c] = await db.select().from(schema.cases).where(eq(schema.cases.returnTransferId, t.id));
  const pp = getPayPal();
  if (t.state === "CREATED") {
    if (pp.kind === "mock") (pp as MockPayPalClient).approve(orderId, t.senderEmail);
    t = await step(t, (x) => completeReturn(pp, x, now));
  }
  t = (await tick(t.id, now)) ?? t;
  if (c && t.captureId && c.state !== "RETURNED" && c.state !== "CLOSED") {
    await applyEvent(c, "RETURNED", "recipient", { now, data: { returnTransferId: t.id, payoutState: t.state } });
  }
  return c ? { caseId: c.id, transfer: t } : null;
}

/** Simulated clock: reminders at 24 h, escalation at 72 h. Returns what happened. */
export async function processTimers(now = new Date()) {
  const db = await getDb();
  // Live cases only: simulated demo cases keep the states they were seeded with, or the Desk's figures would drift hourly.
  const open = await db
    .select()
    .from(schema.cases)
    .where(and(inArray(schema.cases.state, [...OPEN_STATES]), eq(schema.cases.simulated, 0)));
  const done: { caseId: string; event: string }[] = [];
  for (const c of open) {
    const ev = dueTimerEvent({ state: c.state as CaseState, linkSentAt: c.linkSentAt, remindersSent: c.remindersSent, now });
    if (!ev) continue;
    try {
      await applyEvent(c, ev, "system", {
        now,
        set: ev === "REMINDER_SENT" ? { remindersSent: c.remindersSent + 1 } : {},
        data: { channel: "simulated" },
      });
      done.push({ caseId: c.id, event: ev });
    } catch (err) {
      log.warn("timer skipped", { caseId: c.id, message: (err as Error).message });
    }
  }
  return done;
}

export async function caseDetail(caseId: string) {
  const db = await getDb();
  const c = await loadCase(caseId);
  if (!c) return null;
  const events = await db.select().from(schema.caseEvents).where(eq(schema.caseEvents.caseId, caseId)).orderBy(asc(schema.caseEvents.id));
  const messages = await db.select().from(schema.caseMessages).where(eq(schema.caseMessages.caseId, caseId)).orderBy(asc(schema.caseMessages.id));
  const ret = c.returnTransferId ? await getTransfer(c.returnTransferId) : null;
  return { caseRow: c, events, messages, returnState: ret?.state ?? null };
}

export async function caseForTransfer(transferId: string) {
  const db = await getDb();
  const [c] = await db.select().from(schema.cases).where(eq(schema.cases.transferId, transferId));
  return c ?? null;
}

export async function caseIdForReturn(returnTransferId: string): Promise<string | null> {
  const db = await getDb();
  const [c] = await db.select({ id: schema.cases.id }).from(schema.cases).where(eq(schema.cases.returnTransferId, returnTransferId));
  return c?.id ?? null;
}

/** Case Desk operator actions (demo: no operator login yet). */
export async function operatorAction(caseId: string, action: "remind" | "escalate" | "close", now = new Date()) {
  const c = await loadCase(caseId);
  if (!c) throw new TransferError("not_found", 404);
  const ev: CaseEvent = action === "remind" ? "REMINDER_SENT" : action === "escalate" ? "ESCALATED" : "CLOSED";
  try {
    nextCaseState(c.state as CaseState, ev);
  } catch {
    throw new TransferError("action_not_allowed", 409);
  }
  return applyEvent(c, ev, "operator", {
    now,
    set: ev === "REMINDER_SENT" ? { remindersSent: c.remindersSent + 1 } : {},
    data: ev === "REMINDER_SENT" ? { channel: "simulated" } : undefined,
  });
}

export type { CaseRow };
