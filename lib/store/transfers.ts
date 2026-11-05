/**
 * Persistence for drafts and transfers. Transfer state changes are written with an optimistic check
 * (UPDATE … WHERE state = <expected>) and every new history entry is appended to transfer_events
 * (immutable log). Concurrent workers therefore can't both advance the same transfer.
 */
import { and, asc, eq, lte } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Transfer } from "@/lib/paypal/flows";
import type { TransferState } from "@/lib/paypal/money";
import type { RiskAssessment } from "@/lib/risk/score";

export interface Draft {
  id: string;
  language: string;
  transcript: string;
  extractor: string;
  recipientId: string;
  amountCents: number;
  amountSource: "numerals" | "words";
  risk: RiskAssessment;
  expiresAt: Date;
}

export interface TransferMeta {
  kind: "send" | "return";
  draftId?: string;
  recipientId?: string;
  language?: string;
  risk?: RiskAssessment;
}

export type StoredTransfer = Transfer & { meta: TransferMeta; createdAt: Date };

export async function insertDraft(d: Draft): Promise<void> {
  const db = await getDb();
  await db.insert(schema.drafts).values({ ...d, currency: "USD" });
}

export async function getDraft(id: string): Promise<Draft | null> {
  const db = await getDb();
  const [r] = await db.select().from(schema.drafts).where(eq(schema.drafts.id, id));
  return r ? { ...r, amountSource: r.amountSource as Draft["amountSource"], risk: r.risk as RiskAssessment } : null;
}

export async function insertTransfer(t: Transfer, meta: TransferMeta): Promise<void> {
  const db = await getDb();
  await db.insert(schema.transfers).values({
    id: t.id,
    kind: meta.kind,
    state: t.state,
    approveUrl: t.approveUrl,
    amountCents: t.amount.cents,
    currency: t.amount.currency,
    senderEmail: t.senderEmail,
    recipientEmail: t.recipientEmail,
    orderId: t.orderId,
    draftId: meta.draftId,
    recipientId: meta.recipientId,
    language: meta.language,
    riskLevel: meta.risk?.level,
    risk: meta.risk,
  });
  await appendEvents(t, 0);
}

async function appendEvents(t: Transfer, already: number) {
  const fresh = t.history.slice(already);
  if (!fresh.length) return;
  const db = await getDb();
  await db.insert(schema.transferEvents).values(
    fresh.map((h) => ({ transferId: t.id, event: h.event, fromState: h.from, toState: h.to, at: new Date(h.at) })),
  );
}

/** Persist a transfer that moved on from `expected`. Returns false if someone else moved it first. */
export async function saveTransfer(t: Transfer, expected: StoredTransfer): Promise<boolean> {
  const db = await getDb();
  const updated = await db
    .update(schema.transfers)
    .set({
      state: t.state,
      authorizationId: t.authorizationId,
      captureId: t.captureId,
      payoutBatchId: t.payoutBatchId,
      holdUntil: t.holdUntil ? new Date(t.holdUntil) : null,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.transfers.id, t.id), eq(schema.transfers.state, expected.state)))
    .returning({ id: schema.transfers.id });
  if (!updated.length) return false;
  await appendEvents(t, expected.history.length);
  return true;
}

function toTransfer(r: typeof schema.transfers.$inferSelect, events: (typeof schema.transferEvents.$inferSelect)[]): StoredTransfer {
  return {
    id: r.id,
    state: r.state as TransferState,
    amount: { cents: r.amountCents, currency: "USD" },
    senderEmail: r.senderEmail,
    recipientEmail: r.recipientEmail,
    orderId: r.orderId ?? undefined,
    approveUrl: r.approveUrl ?? undefined,
    authorizationId: r.authorizationId ?? undefined,
    captureId: r.captureId ?? undefined,
    payoutBatchId: r.payoutBatchId ?? undefined,
    holdUntil: r.holdUntil?.toISOString(),
    history: events.map((e) => ({ at: e.at.toISOString(), event: e.event as never, from: e.fromState as TransferState, to: e.toState as TransferState })),
    meta: {
      kind: r.kind,
      draftId: r.draftId ?? undefined,
      recipientId: r.recipientId ?? undefined,
      language: r.language ?? undefined,
      risk: (r.risk as RiskAssessment | null) ?? undefined,
    },
    createdAt: r.createdAt,
  };
}

async function load(where: ReturnType<typeof eq>): Promise<StoredTransfer | null> {
  const db = await getDb();
  const [r] = await db.select().from(schema.transfers).where(where);
  if (!r) return null;
  const events = await db
    .select()
    .from(schema.transferEvents)
    .where(eq(schema.transferEvents.transferId, r.id))
    .orderBy(asc(schema.transferEvents.id));
  return toTransfer(r, events);
}

export const getTransfer = (id: string) => load(eq(schema.transfers.id, id));
export const getTransferByOrder = (orderId: string) => load(eq(schema.transfers.orderId, orderId));

/** Holds whose window has ended (for the release worker). */
export async function dueHolds(now = new Date()): Promise<string[]> {
  const db = await getDb();
  const rows = await db
    .select({ id: schema.transfers.id })
    .from(schema.transfers)
    .where(and(eq(schema.transfers.state, "ON_HOLD"), lte(schema.transfers.holdUntil, now)));
  return rows.map((r) => r.id);
}
