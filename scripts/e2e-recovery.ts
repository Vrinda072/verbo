/**
 * End-to-end recovery story in one run (mock PayPal, throwaway in-memory DB, simulated clock):
 *   Telugu send to the look-alike → hold → released → sender asks for it back → link → recipient views,
 *   replies in Portuguese → reminder at 24 h → recipient returns → sender paid back.
 * A second case is left unanswered to show escalation at 72 h.
 *   npm run e2e-recovery
 */
process.env.MOCK = "1";
process.env.PGLITE_DIR = "memory";
process.env.DATABASE_URL = "";
process.env.TOKEN_SIGNING_SECRET ||= "e2e-only-secret-e2e-only-secret-000000";

async function main() {
  const { randomUUID } = await import("node:crypto");
  const { understand } = await import("@/lib/agents/extraction");
  const { RulesExtractor } = await import("@/lib/agents/extraction/rules");
  const tx = await import("@/lib/transfers/service");
  const rc = await import("@/lib/recovery/service");

  const T0 = Date.now();
  const at = (h: number) => new Date(T0 + h * 3_600_000);
  const line = (s: string) => console.log(`  ${s}`);

  async function mistakenSend(h: number) {
    const transcript = "మాన్యుయెల్ లోపెస్ కి 12.34 డాలర్లు పంపండి";
    const u = await understand({ transcript, language: "te" }, new RulesExtractor());
    const d = (await tx.createDraft(u, transcript, "te"))!;
    line(`[t+${h}h] Sreenivas (te): "${transcript}" → risk ${d.risk.level} (${d.risk.signals.map((s) => s.code).join(", ")})`);
    const t = await tx.createTransferFromDraft({ draftId: d.id, nonce: randomUUID() });
    const held = (await tx.handleApproval(t.orderId!, at(h)))!;
    line(`         approved on PayPal → ${held.state} until ${held.holdUntil}`);
    const done = (await tx.tick(t.id, at(h + 0.5)))!;
    const final = (await tx.tick(done.id, at(h + 0.5)))!;
    line(`         sender did not cancel → ${final.state}`);
    return final;
  }

  console.log("\nCase 1 — returned");
  const sent = await mistakenSend(0);
  const { caseRow, link } = await rc.openCase(sent.id, at(1));
  line(`[t+1h]  sender asks for it back → case ${caseRow.state}; link …${link.slice(-12)}`);
  await rc.postMessage(caseRow, "sender", "నేను పొరపాటున మీకు 12.34 డాలర్లు పంపాను. దయచేసి తిరిగి పంపగలరా?", "te", at(1));
  line(`[t+25h] timers (24 h after the link) → ${JSON.stringify((await rc.processTimers(at(25))).map((x) => x.event))}`);
  const found = await rc.caseFromToken(link.split("/recover/")[1], at(30));
  if (!found.ok) throw new Error("token");
  let c = await rc.recordView(found.caseRow, at(30));
  c = await rc.postMessage(c, "recipient", "Olá! Recebi 12.34 por engano, vou devolver.", "pt", at(30));
  line(`[t+30h] recipient opens link in Portuguese, replies → ${c.state}`);
  const { approveUrl } = await rc.startCaseReturn(c, at(31));
  const res = await rc.handleReturnApproval(new URL(approveUrl).searchParams.get("token")!, at(31));
  line(`[t+31h] recipient approves return on PayPal → capture ${res?.transfer.captureId}, payout ${res?.transfer.state}`);
  const d1 = (await rc.caseDetail(caseRow.id))!;
  line(`         case ${d1.caseRow.state}; timeline: ${d1.events.map((e) => e.event).join(" → ")}`);

  console.log("\nCase 2 — no answer, escalated");
  const sent2 = await mistakenSend(0);
  const c2 = await rc.openCase(sent2.id, at(1));
  for (const h of [25, 49, 73]) line(`[t+${h}h] timers → ${JSON.stringify((await rc.processTimers(at(h))).filter((x) => x.caseId === c2.caseRow.id).map((x) => x.event))}`);
  const d2 = (await rc.caseDetail(c2.caseRow.id))!;
  line(`         case ${d2.caseRow.state}; timeline: ${d2.events.map((e) => e.event).join(" → ")}`);

  const ok = d1.caseRow.state === "RETURNED" && d2.caseRow.state === "ESCALATED";
  console.log(ok ? "\n✔ e2e recovery passed (mock PayPal, simulated clock)\n" : "\n✘ e2e recovery FAILED\n");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
