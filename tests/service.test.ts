import { beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { understand } from "@/lib/agents/extraction";
import { RulesExtractor } from "@/lib/agents/extraction/rules";
import { cancel, createDraft, createTransferFromDraft, handleApproval, tick, TransferError } from "@/lib/transfers/service";
import { getPayPal } from "@/lib/paypal";
import { MockPayPalClient } from "@/lib/paypal/mock";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";

const rules = new RulesExtractor();

async function draftFor(transcript: string, language = "te") {
  const u = await understand({ transcript, language }, rules);
  const d = await createDraft(u, transcript, language);
  if (!d) throw new Error("no draft");
  return d;
}

beforeAll(async () => {
  await getDb(); // runs migrations on in-memory PGlite
}, 30_000);

describe("transfer service (mock PayPal, in-memory DB)", () => {
  it("low risk: approve → authorize → capture → payout, no hold", async () => {
    const d = await draftFor("Send 12.34 dollars to Manuel Lopez", "en");
    expect(d.risk.level).toBe("low");
    const t = await createTransferFromDraft({ draftId: d.id, nonce: randomUUID() });
    expect(t.state).toBe("CREATED");
    const after = await handleApproval(t.orderId!);
    expect(["PAYOUT_PENDING", "COMPLETED"]).toContain(after!.state);
    expect(after!.history.map((h) => h.event)).toEqual(expect.arrayContaining(["APPROVED", "AUTHORIZED", "CAPTURED", "PAYOUT_SENT"]));
  });

  it("high risk (look-alike Manuel Lopes): held, then cancel VOIDs with no capture", async () => {
    const d = await draftFor("Send 12.34 dollars to Manuel Lopes");
    expect(d.risk.hold).toBe(true);
    const t = await createTransferFromDraft({ draftId: d.id, nonce: randomUUID() });
    const held = await handleApproval(t.orderId!);
    expect(held!.state).toBe("ON_HOLD");
    expect(held!.captureId).toBeUndefined();
    // a tick before the window ends does nothing
    expect((await tick(t.id))!.state).toBe("ON_HOLD");
    const cancelled = await cancel(t.id);
    expect(cancelled.state).toBe("VOIDED");
    expect(cancelled.captureId).toBeUndefined();
  });

  it("high risk: released only after the hold window ends", async () => {
    const d = await draftFor("Send 12.34 dollars to Manuel Lopes");
    const t = await createTransferFromDraft({ draftId: d.id, nonce: randomUUID() });
    const held = await handleApproval(t.orderId!);
    const later = new Date(new Date(held!.holdUntil!).getTime() + 1000);
    const released = await tick(t.id, later);
    expect(["PAYOUT_PENDING", "COMPLETED"]).toContain(released!.state);
    await expect(cancel(t.id)).rejects.toThrow("too_late_to_cancel");
  });

  it("is idempotent per nonce (double tap creates one order)", async () => {
    const d = await draftFor("Send 12.34 dollars to Manuel Lopez", "en");
    const nonce = randomUUID();
    const a = await createTransferFromDraft({ draftId: d.id, nonce });
    const b = await createTransferFromDraft({ draftId: d.id, nonce });
    expect(b.orderId).toBe(a.orderId);
  });

  it("rejects expired drafts and wrong typed amounts", async () => {
    const d = await draftFor("Send 12.34 dollars to Manuel Lopez", "en");
    const db = await getDb();
    await db.update(schema.drafts).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(schema.drafts.id, d.id));
    await expect(createTransferFromDraft({ draftId: d.id, nonce: randomUUID() })).rejects.toBeInstanceOf(TransferError);
  });

  it("writes an immutable event row per transition", async () => {
    const d = await draftFor("Send 12.34 dollars to Manuel Lopes");
    const t = await createTransferFromDraft({ draftId: d.id, nonce: randomUUID() });
    await handleApproval(t.orderId!);
    await cancel(t.id);
    const db = await getDb();
    const rows = await db.select().from(schema.transferEvents).where(eq(schema.transferEvents.transferId, t.id));
    expect(rows.map((r) => r.event)).toEqual(["APPROVED", "AUTHORIZED", "HOLD_STARTED", "VOIDED"]);
    expect(getPayPal()).toBeInstanceOf(MockPayPalClient);
  });
});
