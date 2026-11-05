import { describe, expect, it } from "vitest";
import { canCase, dueTimerEvent, nextCaseState } from "@/lib/recovery/state";
import { signRecoveryToken, verifyRecoveryToken } from "@/lib/recovery/token";

describe("case state machine", () => {
  it("follows the happy path to RETURNED and CLOSED", () => {
    let s = nextCaseState("OPENED", "LINK_SENT");
    s = nextCaseState(s, "VIEWED");
    s = nextCaseState(s, "REPLIED");
    s = nextCaseState(s, "RETURN_STARTED");
    s = nextCaseState(s, "RETURNED");
    expect(nextCaseState(s, "CLOSED")).toBe("CLOSED");
  });
  it("lets a refusing or escalated recipient still return later", () => {
    expect(nextCaseState("REFUSED", "RETURNED")).toBe("RETURNED");
    expect(nextCaseState("ESCALATED", "RETURNED")).toBe("RETURNED");
  });
  it("forbids returning before the link was even viewed, and anything after CLOSED", () => {
    expect(canCase("LINK_SENT", "RETURNED")).toBe(false);
    expect(canCase("CLOSED", "VIEWED")).toBe(false);
  });
});

describe("simulated clock", () => {
  const linkSentAt = new Date("2026-11-05T00:00:00Z");
  const at = (h: number) => new Date(linkSentAt.getTime() + h * 3_600_000);
  it("reminds once at 24h and escalates at 72h", () => {
    expect(dueTimerEvent({ state: "LINK_SENT", linkSentAt, remindersSent: 0, now: at(23) })).toBeNull();
    expect(dueTimerEvent({ state: "LINK_SENT", linkSentAt, remindersSent: 0, now: at(24) })).toBe("REMINDER_SENT");
    expect(dueTimerEvent({ state: "VIEWED", linkSentAt, remindersSent: 1, now: at(48) })).toBeNull();
    expect(dueTimerEvent({ state: "REPLIED", linkSentAt, remindersSent: 1, now: at(72) })).toBe("ESCALATED");
    expect(dueTimerEvent({ state: "RETURNED", linkSentAt, remindersSent: 1, now: at(100) })).toBeNull();
  });
});

describe("recovery tokens", () => {
  process.env.TOKEN_SIGNING_SECRET ||= "test-secret-test-secret-test-secret-0123";
  it("round-trips and carries no personal data", () => {
    const t = signRecoveryToken("case_123");
    const v = verifyRecoveryToken(t);
    expect(v.ok && v.claims.c).toBe("case_123");
    expect(Buffer.from(t.split(".")[0], "base64url").toString()).not.toMatch(/@|Manuel|\d{3,}\.\d/);
  });
  it("rejects tampering and expiry", () => {
    const t = signRecoveryToken("case_123");
    const forged = Buffer.from(JSON.stringify({ c: "case_999", r: "recipient", exp: 9e9 })).toString("base64url") + "." + t.split(".")[1];
    expect(verifyRecoveryToken(forged)).toEqual({ ok: false, reason: "bad_signature" });
    expect(verifyRecoveryToken("nope")).toEqual({ ok: false, reason: "malformed" });
    const old = signRecoveryToken("case_123", new Date("2020-01-01"));
    expect(verifyRecoveryToken(old)).toEqual({ ok: false, reason: "expired" });
  });
});
