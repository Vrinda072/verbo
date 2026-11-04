/**
 * Day-1 proof that Verbo's platform-mediated money loop works in the PayPal sandbox.
 *
 *   1. SEND   Sreenivas → Order(AUTHORIZE) → [you approve as Sreenivas] → authorize → capture → Payout → Manuel Lopez
 *   2. VOID   Sreenivas → Order(AUTHORIZE) → [you approve as Sreenivas] → authorize → VOID (risk-hold cancel)
 *   3. RETURN Manuel Lopes → Order(CAPTURE) → [you approve as Manuel Lopes] → capture → Payout → Sreenivas
 *
 * Usage:
 *   npm run money-loop                 # all three paths against the sandbox (MOCK=0 forced)
 *   npm run money-loop -- --only=void  # one path: send | void | return
 *   npm run money-loop -- --mock       # offline dry run with the mock client (auto-approves)
 *   npm run money-loop -- --wait=60    # minutes to wait for each approval (default 15)
 *
 * Nothing secret is printed. Emails are masked. Approval links are printed because you must open them.
 */
import "dotenv/config";
import { writeFileSync, mkdirSync } from "node:fs";
import { MockPayPalClient } from "@/lib/paypal/mock";
import { RealPayPalClient } from "@/lib/paypal/real";
import type { PayPalClient } from "@/lib/paypal/client";
import { authorizeTransfer, completeReturn, refreshPayout, releaseTransfer, startReturn, startTransfer, voidTransfer, type Transfer } from "@/lib/paypal/flows";
import { money, toPayPalValue } from "@/lib/paypal/money";
import { maskEmail } from "@/lib/log";
import { PayPalApiError } from "@/lib/paypal/types";

const args = new Set(process.argv.slice(2));
const only = [...args].find((a) => a.startsWith("--only="))?.split("=")[1];
const useMock = args.has("--mock");
const waitMinutes = Number([...args].find((a) => a.startsWith("--wait="))?.split("=")[1] ?? 15);

const BASE = process.env.APP_BASE_URL || "http://localhost:3000";
const urls = { returnUrl: `${BASE}/paypal/return`, cancelUrl: `${BASE}/paypal/return?cancelled=1` };
const RAVI = process.env.SANDBOX_SENDER_EMAIL ?? "";
const LOPEZ = process.env.SANDBOX_INTENDED_RECIPIENT_EMAIL ?? "";
const LOPES = process.env.SANDBOX_WRONG_RECIPIENT_EMAIL ?? "";

const pp: PayPalClient = useMock ? new MockPayPalClient() : new RealPayPalClient();
const runId = Date.now().toString(36);
const results: Record<string, unknown> = { runId, mode: pp.kind, startedAt: new Date().toISOString() };

const c = { b: "\x1b[1m", g: "\x1b[32m", y: "\x1b[33m", r: "\x1b[31m", d: "\x1b[2m", x: "\x1b[0m" };
const step = (s: string) => console.log(`\n${c.b}▸ ${s}${c.x}`);
const ok = (s: string) => console.log(`  ${c.g}✔${c.x} ${s}`);
const info = (s: string) => console.log(`  ${c.d}${s}${c.x}`);

function requireEmails() {
  const missing = [
    ["SANDBOX_SENDER_EMAIL", RAVI],
    ["SANDBOX_INTENDED_RECIPIENT_EMAIL", LOPEZ],
    ["SANDBOX_WRONG_RECIPIENT_EMAIL", LOPES],
  ].filter(([, v]) => !v);
  if (missing.length && !useMock) {
    console.error(`${c.r}Missing in .env: ${missing.map(([k]) => k).join(", ")}${c.x}`);
    process.exit(1);
  }
}

/** Wait for the human to approve on PayPal (poll GET order), or auto-approve in mock mode. */
async function waitForApproval(t: Transfer, who: string, whoEmail: string) {
  if (pp instanceof MockPayPalClient) {
    pp.approve(t.orderId!, whoEmail || "mock@example.test");
    ok(`(mock) ${who} approved`);
    return;
  }
  console.log(`\n  ${c.y}ACTION NEEDED${c.x} — open this link and log in as ${c.b}${who}${c.x} (${maskEmail(whoEmail)}), then approve:`);
  console.log(`  ${t.approveUrl}\n`);
  const deadline = Date.now() + waitMinutes * 60_000;
  let last = "";
  while (Date.now() < deadline) {
    const o = await pp.getOrder(t.orderId!);
    if (o.status !== last) info(`order ${o.id} status: ${o.status}`);
    last = o.status;
    if (o.status === "APPROVED") {
      ok(`${who} approved${o.payerEmail ? ` (payer ${maskEmail(o.payerEmail)})` : ""}`);
      return;
    }
    if (o.status === "VOIDED" || o.status === "COMPLETED") throw new Error(`Order ended as ${o.status}`);
    await new Promise((r) => setTimeout(r, 4000));
  }
  throw new Error(`Timed out waiting for approval (${waitMinutes} min) — rerun with --wait=60 for more time`);
}

async function waitForPayout(t: Transfer): Promise<Transfer> {
  for (let i = 0; i < 20; i++) {
    t = await refreshPayout(pp, t);
    if (t.state !== "PAYOUT_PENDING") return t;
    info("payout still processing…");
    await new Promise((r) => setTimeout(r, pp.kind === "mock" ? 0 : 5000));
  }
  return t;
}

async function sendPath(): Promise<Transfer> {
  step(`1/3 SEND  $12.34  Sreenivas → Manuel Lopez  (Order AUTHORIZE → capture → Payout)`);
  let t = await startTransfer(pp, { id: `tr_${runId}_send`, amount: money(1234), senderEmail: RAVI, recipientEmail: LOPEZ, urls });
  ok(`order created ${t.orderId}`);
  await waitForApproval(t, "Sreenivas Rao", RAVI);
  t = await authorizeTransfer(pp, t);
  ok(`authorized ${t.authorizationId}`);
  t = await releaseTransfer(pp, t, { note: "Verbo money-loop test (sandbox)" });
  ok(`captured ${t.captureId}`);
  ok(`payout batch ${t.payoutBatchId} → ${maskEmail(LOPEZ || "mock")}`);
  t = await waitForPayout(t);
  ok(`final state ${c.b}${t.state}${c.x}`);
  return t;
}

async function voidPath(): Promise<Transfer> {
  step(`2/3 VOID  $5.00  Sreenivas → (held) → cancelled  (Order AUTHORIZE → VOID)`);
  let t = await startTransfer(pp, { id: `tr_${runId}_void`, amount: money(500), senderEmail: RAVI, recipientEmail: LOPES, urls });
  ok(`order created ${t.orderId}`);
  await waitForApproval(t, "Sreenivas Rao", RAVI);
  t = await authorizeTransfer(pp, t, { holdMinutes: 10 });
  ok(`authorized ${t.authorizationId}, risk hold until ${t.holdUntil}`);
  t = await voidTransfer(pp, t);
  ok(`voided — final state ${c.b}${t.state}${c.x} (no money moved)`);
  return t;
}

async function returnPath(original?: Transfer): Promise<Transfer> {
  step(`3/3 RETURN  $12.34  Manuel Lopes → platform → Sreenivas  (Order CAPTURE → Payout)`);
  const base: Transfer = original ?? {
    id: `tr_${runId}_orig`,
    state: "COMPLETED",
    amount: money(1234),
    senderEmail: RAVI,
    recipientEmail: LOPES,
    history: [],
  };
  let r = await startReturn(pp, { id: `rt_${runId}_ret`, original: { ...base, recipientEmail: LOPES }, returnerEmail: LOPES, urls });
  ok(`return order created ${r.orderId} for $${toPayPalValue(r.amount)}`);
  await waitForApproval(r, "Manuel Lopes", LOPES);
  r = await completeReturn(pp, r);
  ok(`captured ${r.captureId}; payout batch ${r.payoutBatchId} → ${maskEmail(RAVI || "mock")}`);
  r = await waitForPayout(r);
  ok(`final state ${c.b}${r.state}${c.x}`);
  return r;
}

function summarize(t: Transfer) {
  return {
    id: t.id,
    state: t.state,
    amount: toPayPalValue(t.amount),
    orderId: t.orderId,
    authorizationId: t.authorizationId,
    captureId: t.captureId,
    payoutBatchId: t.payoutBatchId,
    history: t.history,
  };
}

async function main() {
  requireEmails();
  console.log(`${c.b}Verbo money loop${c.x} — ${pp.kind === "mock" ? "MOCK (offline)" : "PayPal SANDBOX"} · run ${runId}`);
  let sent: Transfer | undefined;
  try {
    if (!only || only === "send") results.send = summarize((sent = await sendPath()));
    if (!only || only === "void") results.void = summarize(await voidPath());
    if (!only || only === "return") results.return = summarize(await returnPath(sent));
  } catch (err) {
    const e = err as PayPalApiError & { transfer?: Transfer };
    console.error(`\n${c.r}✘ ${e.message}${c.x}${e.issue ? ` · issue=${e.issue}` : ""}${e.debugId ? ` · debug_id=${e.debugId}` : ""}`);
    if (e.transfer?.state === "PAYOUT_FAILED") {
      console.error(`  Payout failed after capture. If Payouts stays blocked >90 min we switch to the Invoicing fallback.`);
      results.payoutFailure = summarize(e.transfer);
    }
    results.error = { message: e.message, issue: e.issue, debugId: e.debugId };
    process.exitCode = 1;
  }
  results.finishedAt = new Date().toISOString();
  if (pp.kind === "real") {
    mkdirSync("docs/private", { recursive: true });
    const file = `docs/private/money-loop-${runId}.json`;
    writeFileSync(file, JSON.stringify(results, null, 2));
    console.log(`\nIDs saved to ${file} (git-ignored).`);
  }
}

main();
