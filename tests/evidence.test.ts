import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { canonicalJson, sha256, buildPacket } from "@/lib/evidence/packet";
import { pdfSafe, renderPdf } from "@/lib/evidence/pdf";
import { evidenceScore } from "@/lib/evidence/meter";
import { seedDesk, SEED_COUNT } from "@/lib/desk/seed";
import { understand } from "@/lib/agents/extraction";
import { RulesExtractor } from "@/lib/agents/extraction/rules";
import { createDraft, createTransferFromDraft, handleApproval, tick } from "@/lib/transfers/service";
import { handleReturnApproval, openCase, postMessage, recordView, startCaseReturn } from "@/lib/recovery/service";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";

process.env.TOKEN_SIGNING_SECRET ||= "test-secret-test-secret-test-secret-0123";

beforeAll(async () => {
  await getDb();
}, 30_000);

describe("canonical JSON + SHA-256 (golden file)", () => {
  it("matches the committed golden hash", () => {
    const fixture = JSON.parse(readFileSync("tests/fixtures/evidence-fixture.json", "utf8"));
    const golden = readFileSync("tests/fixtures/evidence-fixture.sha256", "utf8").trim();
    expect(sha256(canonicalJson(fixture))).toBe(golden);
  });
  it("is independent of key order and drops undefined", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: undefined, e: [3, { z: 1, y: 2 }] } })).toBe('{"a":{"d":2,"e":[3,{"y":2,"z":1}]},"b":1}');
  });
});

describe("evidence packet for a live (mock) recovery", () => {
  it("contains instruction, risk, timeline, conversation and return; hash verifies; PDF renders deterministically", async () => {
    const transcript = "మాన్యుయెల్ లోపెస్ కి 12.34 డాలర్లు పంపండి";
    const u = await understand({ transcript, language: "te" }, new RulesExtractor());
    const d = (await createDraft(u, transcript, "te"))!;
    const t = await createTransferFromDraft({ draftId: d.id, nonce: randomUUID() });
    const held = (await handleApproval(t.orderId!))!;
    await tick(t.id, new Date(Date.parse(held.holdUntil!) + 1000));
    await tick(t.id);
    const { caseRow } = await openCase(t.id);
    let c = await recordView(caseRow);
    c = await postMessage(c, "recipient", "Olá, vou devolver.", "pt");
    const { approveUrl } = await startCaseReturn(c);
    await handleReturnApproval(new URL(approveUrl).searchParams.get("token")!);

    const at = new Date("2026-11-12T12:00:00Z");
    const p = (await buildPacket(caseRow.id, at))!;
    expect(sha256(p.json)).toBe(p.sha256);
    expect(p.packet.instruction?.transcript).toBe(transcript);
    expect(p.packet.payment?.recipientEmail).toMatch(/\*\*\*@/); // masked
    expect(p.packet.caseTimeline.map((e) => e.event)).toContain("RETURNED");
    expect(p.packet.returnPayment?.paypal.captureId).toBeTruthy();
    expect(p.packet.evidence.score).toBe(100);

    const a = await renderPdf(p);
    const b = await renderPdf(p);
    expect(Buffer.from(a.slice(0, 5)).toString()).toBe("%PDF-");
    expect(Buffer.compare(Buffer.from(a), Buffer.from(b))).toBe(0);
  });

  it("replaces non-Latin text in the PDF with a pointer instead of dropping it", () => {
    expect(pdfSafe("Olá, vou devolver.")).toBe("Olá, vou devolver.");
    expect(pdfSafe("నమస్తే")).toMatch(/JSON/);
    expect(pdfSafe("Verbo — evidence packet")).toBe("Verbo — evidence packet");
    expect(pdfSafe("s***@x.test → r***@y.test")).toBe("s***@x.test -> r***@y.test");
    expect(pdfSafe("Said (te): మాన్యుయెల్ లోపెస్ కి 12.34")).toBe("Said (te): [non-Latin text — exact original in the JSON packet] 12.34");
    expect(pdfSafe("నమస్తే, నేను. పంపాను?")).toBe("[non-Latin text — exact original in the JSON packet]");
  });
});

describe("evidence meter", () => {
  it("adds to 100 when everything is present", () => {
    expect(
      evidenceScore({ hasPaymentRecord: true, hasRiskRecord: true, hasUtterance: true, recipientViewed: true, hasConversation: true, hasOutcome: true, hasReturnPayment: true }),
    ).toBe(100);
  });
});

describe("Case Desk seed", () => {
  it(`inserts ${SEED_COUNT} simulated cases once, all labelled simulated`, async () => {
    const first = await seedDesk({ now: new Date("2026-11-12T12:00:00Z") });
    expect(first.inserted).toBe(SEED_COUNT);
    expect((await seedDesk()).skipped).toBe(true);
    const db = await getDb();
    const sim = await db.select({ id: schema.cases.id, state: schema.cases.state }).from(schema.cases).where(eq(schema.cases.simulated, 1));
    expect(sim.length).toBe(SEED_COUNT);
    const states = new Set(sim.map((s) => s.state));
    for (const s of ["LINK_SENT", "VIEWED", "RETURNED", "ESCALATED", "REFUSED", "CLOSED"]) expect(states).toContain(s);
  }, 60_000);
});
