import { beforeEach, describe, expect, it } from "vitest";
import { MockPayPalClient } from "@/lib/paypal/mock";
import { authorizeTransfer, completeReturn, refreshPayout, releaseTransfer, startReturn, startTransfer, voidTransfer } from "@/lib/paypal/flows";
import { money } from "@/lib/paypal/money";

const urls = { returnUrl: "http://localhost:3000/paypal/return", cancelUrl: "http://localhost:3000/paypal/return?cancelled=1" };
const RAVI = "ravi@example.test";
const LOPEZ = "maria.lopez@example.test";
const LOPES = "maria.lopes@example.test";

let pp: MockPayPalClient;
beforeEach(() => {
  pp = new MockPayPalClient();
});

async function approvedTransfer(id = "tr_test01") {
  const t = await startTransfer(pp, { id, amount: money(5000), senderEmail: RAVI, recipientEmail: LOPEZ, urls });
  pp.approve(t.orderId!, RAVI);
  return t;
}

describe("send flow", () => {
  it("authorize → capture → payout → completed", async () => {
    let t = await approvedTransfer();
    t = await authorizeTransfer(pp, t);
    expect(t.state).toBe("AUTHORIZED");
    t = await releaseTransfer(pp, t);
    expect(t.state).toBe("PAYOUT_PENDING");
    t = await refreshPayout(pp, t);
    expect(t.state).toBe("COMPLETED");
    const payout = pp.payouts.get(t.payoutBatchId!)!;
    expect(payout.receiver).toBe(LOPEZ);
    expect(payout.amount.cents).toBe(5000);
    expect(t.history.map((h) => h.to)).toEqual(["APPROVED", "AUTHORIZED", "CAPTURED", "PAYOUT_PENDING", "COMPLETED"]);
  });

  it("refuses to authorize before the payer approves", async () => {
    const t = await startTransfer(pp, { id: "tr_test02", amount: money(100), senderEmail: RAVI, recipientEmail: LOPEZ, urls });
    await expect(authorizeTransfer(pp, t)).rejects.toThrow(/not APPROVED/);
  });

  it("is idempotent: replaying release does not move money twice", async () => {
    let t = await approvedTransfer();
    t = await authorizeTransfer(pp, t);
    const before = pp.movements;
    await releaseTransfer(pp, t);
    await releaseTransfer(pp, t); // same keys → replayed responses
    expect(pp.movements - before).toBe(2); // one capture + one payout
  });
});

describe("risk hold", () => {
  it("blocks capture until the window ends, then releases", async () => {
    const start = new Date("2026-11-04T10:00:00Z");
    let t = await approvedTransfer();
    t = await authorizeTransfer(pp, t, { now: start, holdMinutes: 10 });
    expect(t.state).toBe("ON_HOLD");
    await expect(releaseTransfer(pp, t, { now: new Date("2026-11-04T10:05:00Z") })).rejects.toThrow(/hold/);
    expect(pp.movements).toBe(0);
    t = await releaseTransfer(pp, t, { now: new Date("2026-11-04T10:10:00Z") });
    expect(t.state).toBe("PAYOUT_PENDING");
  });

  it("void path: cancelling during the hold voids the authorization and moves no money", async () => {
    let t = await approvedTransfer();
    t = await authorizeTransfer(pp, t, { holdMinutes: 10 });
    t = await voidTransfer(pp, t);
    expect(t.state).toBe("VOIDED");
    expect(pp.authorizations.get(t.authorizationId!)!.status).toBe("VOIDED");
    expect(pp.movements).toBe(0);
    await expect(pp.captureAuthorization(t.authorizationId!, "verbo-other-capture")).rejects.toThrow();
  });
});

describe("payout failure", () => {
  it("surfaces PAYOUT_FAILED so the caller can fall back to an invoice", async () => {
    let t = await approvedTransfer();
    t = await authorizeTransfer(pp, t);
    pp.failNextPayout = true;
    const err = await releaseTransfer(pp, t).catch((e) => e);
    expect(err.transfer.state).toBe("PAYOUT_FAILED");
  });
});

describe("return path", () => {
  it("wrong recipient pays the platform, platform pays the original sender back", async () => {
    let original = await approvedTransfer();
    original = await authorizeTransfer(pp, original);
    original = await releaseTransfer(pp, { ...original, recipientEmail: LOPES });
    let ret = await startReturn(pp, { id: "rt_test01", original, returnerEmail: LOPES, urls });
    expect(ret.recipientEmail).toBe(RAVI);
    pp.approve(ret.orderId!, LOPES);
    ret = await completeReturn(pp, ret);
    ret = await refreshPayout(pp, ret);
    expect(ret.state).toBe("COMPLETED");
    expect(pp.payouts.get(ret.payoutBatchId!)!.receiver).toBe(RAVI);
  });
});
