/** Read models for the Case Desk. Live sandbox cases and simulated ones share tables; `simulated` tells them apart. */
import { desc, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { CONTACTS } from "@/lib/contacts";
import { evidenceScore } from "@/lib/evidence/meter";
import type { RiskAssessment } from "@/lib/risk/score";

export interface DeskRow {
  id: string;
  shortId: string;
  simulated: boolean;
  state: string;
  cents: number;
  senderName: string;
  senderLanguage: string;
  recipientName: string;
  recipientLanguage: string;
  riskLevel: string | null;
  openedAt: string;
  updatedAt: string;
  ageHours: number;
  lastEvent: string | null;
  remindersSent: number;
  messages: number;
  evidence: number;
  everReturned: boolean;
}

export async function listDeskRows(now = new Date()): Promise<DeskRow[]> {
  const db = await getDb();
  type Raw = {
    id: string;
    simulated: number;
    state: string;
    amount_cents: number;
    sender_name: string;
    sender_language: string;
    recipient_name: string;
    recipient_language: string;
    reminders_sent: number;
    created_at: string;
    updated_at: string;
    risk_level: string | null;
    order_id: string | null;
    capture_id: string | null;
    draft_id: string | null;
    return_capture: string | null;
    events: string[] | null;
    msg_count: number;
  };
  // Both PGlite and node-postgres return { rows } from execute().
  const rows = (await db.execute(sql`
    select c.id, c.simulated, c.state, c.amount_cents, c.sender_name, c.sender_language, c.recipient_name,
           c.recipient_language, c.reminders_sent, c.created_at, c.updated_at,
           t.risk_level, t.order_id, t.capture_id, t.draft_id, r.capture_id as return_capture,
           (select array_agg(e.event order by e.id) from case_events e where e.case_id = c.id) as events,
           (select count(*)::int from case_messages m where m.case_id = c.id) as msg_count
    from cases c
    left join transfers t on t.id = c.transfer_id
    left join transfers r on r.id = c.return_transfer_id
    order by c.updated_at desc`)) as unknown as { rows: Raw[] };
  return rows.rows.map((r) => {
    const events = r.events ?? [];
    return {
      id: r.id,
      shortId: r.id.replace(/^case_/, "").slice(0, 8).toUpperCase(),
      simulated: r.simulated === 1,
      state: r.state,
      cents: r.amount_cents,
      senderName: r.sender_name,
      senderLanguage: r.sender_language,
      recipientName: r.recipient_name,
      recipientLanguage: r.recipient_language,
      riskLevel: r.risk_level,
      openedAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString(),
      ageHours: Math.round((now.getTime() - new Date(r.created_at).getTime()) / 3_600_000),
      lastEvent: events[events.length - 1] ?? null,
      remindersSent: r.reminders_sent,
      messages: Number(r.msg_count),
      everReturned: events.includes("RETURNED"),
      evidence: evidenceScore({
        hasPaymentRecord: Boolean(r.order_id && r.capture_id),
        hasRiskRecord: Boolean(r.risk_level),
        hasUtterance: Boolean(r.draft_id),
        recipientViewed: events.includes("VIEWED"),
        hasConversation: Number(r.msg_count) > 0 || events.includes("REPLIED"),
        hasOutcome: events.some((e) => e === "RETURNED" || e === "REFUSED" || e === "ESCALATED"),
        hasReturnPayment: Boolean(r.return_capture),
      }),
    };
  });
}

export interface AlertRow {
  draftId: string;
  createdAt: string;
  language: string;
  recipientName: string;
  cents: number;
  level: string;
  signals: string[];
  transferState: string | null;
}

/** Live pre-send checks (only real drafts made in this app; nothing simulated here). */
export async function listAlerts(limit = 50): Promise<AlertRow[]> {
  const db = await getDb();
  const drafts = await db.select().from(schema.drafts).orderBy(desc(schema.drafts.createdAt)).limit(limit);
  const ids = drafts.map((d) => d.id);
  const transfers = ids.length
    ? await db.select({ draftId: schema.transfers.draftId, state: schema.transfers.state }).from(schema.transfers).where(inArray(schema.transfers.draftId, ids))
    : [];
  return drafts.map((d) => {
    const risk = d.risk as RiskAssessment;
    return {
      draftId: d.id,
      createdAt: d.createdAt.toISOString(),
      language: d.language,
      recipientName: CONTACTS.find((c) => c.id === d.recipientId)?.name ?? d.recipientId,
      cents: d.amountCents,
      level: risk.level,
      signals: risk.signals.map((s) => s.code),
      transferState: transfers.find((t) => t.draftId === d.id)?.state ?? null,
    };
  });
}
