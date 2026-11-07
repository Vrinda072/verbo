import { beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { understand } from "@/lib/agents/extraction";
import { RulesExtractor } from "@/lib/agents/extraction/rules";
import { createDraft, createTransferFromDraft, handleApproval, tick } from "@/lib/transfers/service";
import {
  caseDetail,
  caseFromToken,
  handleReturnApproval,
  openCase,
  postMessage,
  processTimers,
  recordView,
  refuse,
  startCaseReturn,
} from "@/lib/recovery/service";
import { getDb } from "@/db";

process.env.TOKEN_SIGNING_SECRET ||= "test-secret-test-secret-test-secret-0123";
const rules = new RulesExtractor();

/** A completed $12.34 payment that went to the look-alike Manuel Lopes (hold elapsed). */
async function mistakenPayment() {
  const transcript = "మాన్యుయెల్ లోపెస్ కి 12.34 డాలర్లు పంపండి";
  const u = await understand({ transcript, language: "te" }, rules);
  const d = (await createDraft(u, transcript, "te"))!;
  const t = await createTransferFromDraft({ draftId: d.id, nonce: randomUUID() });
  const held = await handleApproval(t.orderId!);
  const done = await tick(t.id, new Date(Date.parse(held!.holdUntil!) + 1000));
  return (await tick(done!.id))!;
}

beforeAll(async () => {
  await getDb();
}, 30_000);

describe("scheduled timers", () => {
  it("leave simulated cases exactly as seeded", async () => {
    const { seedDesk } = await import("@/lib/desk/seed");
    await seedDesk();
    const done = await processTimers(new Date(Date.now() + 365 * 24 * 3_600_000));
    expect(done.filter((d) => d.caseId.startsWith("case_SIM"))).toEqual([]);
  });
});

describe("recovery (mock PayPal, in-memory DB)", () => {
  it("full happy path: open → link → view → reply → return → RETURNED, sender paid back", async () => {
    const sent = await mistakenPayment();
    expect(sent.state).toBe("COMPLETED");

    const { caseRow, link } = await openCase(sent.id);
    expect(caseRow.state).toBe("LINK_SENT");
    expect(caseRow.recipientLanguage).toBe("pt");
    const again = await openCase(sent.id);
    expect(again.caseRow.id).toBe(caseRow.id); // one case per transfer

    const token = link.split("/recover/")[1];
    const found = await caseFromToken(token);
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    let c = await recordView(found.caseRow);
    expect(c.state).toBe("VIEWED");
    c = await postMessage(c, "recipient", "Oi, recebi 12.34 por engano?", "pt");
    expect(c.state).toBe("REPLIED");

    const { approveUrl } = await startCaseReturn(c);
    const orderId = new URL(approveUrl).searchParams.get("token")!;
    const res = await handleReturnApproval(orderId);
    expect(res?.transfer.captureId).toBeDefined();

    const detail = (await caseDetail(caseRow.id))!;
    expect(detail.caseRow.state).toBe("RETURNED");
    expect(detail.events.map((e) => e.event)).toEqual(["OPENED", "LINK_SENT", "VIEWED", "REPLIED", "RETURN_STARTED", "RETURNED"]);
    expect(detail.messages[0].translator).toBe("none"); // no LLM in tests: shown untranslated, never faked
    expect(["PAYOUT_PENDING", "COMPLETED"]).toContain(detail.returnState);
  });

  it("refusal is recorded, and the recipient can still change their mind", async () => {
    const sent = await mistakenPayment();
    const { caseRow } = await openCase(sent.id);
    let c = await recordView(caseRow);
    c = await refuse(c);
    expect(c.state).toBe("REFUSED");
    const { approveUrl } = await startCaseReturn(c);
    await handleReturnApproval(new URL(approveUrl).searchParams.get("token")!);
    expect((await caseDetail(c.id))!.caseRow.state).toBe("RETURNED");
  });

  it("cannot return before the link is opened; timers remind at 24h and escalate at 72h", async () => {
    const sent = await mistakenPayment();
    const t0 = new Date();
    const { caseRow } = await openCase(sent.id, t0);
    await expect(startCaseReturn(caseRow)).rejects.toThrow("case_not_returnable");
    const h = (n: number) => new Date(t0.getTime() + n * 3_600_000);
    expect((await processTimers(h(25))).filter((x) => x.caseId === caseRow.id)).toEqual([{ caseId: caseRow.id, event: "REMINDER_SENT" }]);
    expect((await processTimers(h(30))).filter((x) => x.caseId === caseRow.id)).toEqual([]);
    expect((await processTimers(h(73))).filter((x) => x.caseId === caseRow.id)).toEqual([{ caseId: caseRow.id, event: "ESCALATED" }]);
    expect((await caseDetail(caseRow.id))!.caseRow.remindersSent).toBe(1);
  });

  it("rejects forged tokens", async () => {
    expect((await caseFromToken("abc.def")).ok).toBe(false);
  });
});
