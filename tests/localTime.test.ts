import { describe, expect, it } from "vitest";
import { hourIn, isQuiet, nextDaytime, quietRanges, timeZoneFor } from "@/lib/localTime";
import { dueTimerEvent } from "@/lib/recovery/state";

describe("the recipient's own clock", () => {
  it("uses the contact's zone, then the language's", () => {
    expect(timeZoneFor("Mohamed Ali", "ar")).toBe("Africa/Cairo");
    expect(timeZoneFor("Someone New", "te")).toBe("Asia/Kolkata");
  });

  it("moves a 03:00 reminder to 08:00 the same morning, and leaves a daytime one alone", () => {
    const night = new Date("2026-11-12T21:30:00Z"); // 03:00 in Kolkata
    expect(isQuiet(night, "Asia/Kolkata")).toBe(true);
    const moved = nextDaytime(night, "Asia/Kolkata");
    expect(hourIn(moved, "Asia/Kolkata")).toBe(8);
    expect(moved.getTime() - night.getTime()).toBeLessThanOrEqual(5 * 3_600_000);
    const day = new Date("2026-11-12T06:00:00Z"); // 11:30 in Kolkata
    expect(nextDaytime(day, "Asia/Kolkata").getTime()).toBe(day.getTime());
  });

  it("finds one night per day", () => {
    const from = new Date("2026-11-12T00:00:00Z");
    expect(quietRanges(from, new Date(from.getTime() + 3 * 86_400_000), "Europe/London").length).toBeGreaterThanOrEqual(3);
  });

  it("holds the reminder at night but never the escalation", () => {
    const linkSentAt = new Date("2026-11-10T00:00:00Z");
    const base = { state: "LINK_SENT" as const, linkSentAt, remindersSent: 0 };
    expect(dueTimerEvent({ ...base, now: new Date("2026-11-11T02:00:00Z"), recipientQuiet: true })).toBeNull();
    expect(dueTimerEvent({ ...base, now: new Date("2026-11-11T02:00:00Z"), recipientQuiet: false })).toBe("REMINDER_SENT");
    expect(dueTimerEvent({ ...base, now: new Date("2026-11-13T02:00:00Z"), recipientQuiet: true })).toBe("ESCALATED");
  });
});
