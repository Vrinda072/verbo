import { describe, expect, it } from "vitest";
import { dueTimerEvent } from "@/lib/recovery/state";
import { timelineData } from "@/lib/desk/timeline";
import type { DeskRow } from "@/lib/desk/queries";

describe("deadline timeline", () => {
  const base = new Date("2026-11-01T00:00:00Z");
  const h = (n: number) => new Date(base.getTime() + n * 3_600_000);
  const row = (over: Partial<DeskRow>) =>
    ({ id: "c1", simulated: false, state: "LINK_SENT", cents: 4000, recipientName: "R", remindersSent: 0, linkSentAt: base.toISOString(), escalateAt: null, ...over }) as DeskRow;

  it("an operator deadline replaces the standard 72 hours", () => {
    const args = { state: "LINK_SENT" as const, linkSentAt: base, remindersSent: 1 };
    expect(dueTimerEvent({ ...args, now: h(73) })).toBe("ESCALATED");
    expect(dueTimerEvent({ ...args, now: h(73), escalateAt: h(100) })).toBeNull();
    expect(dueTimerEvent({ ...args, now: h(40), escalateAt: h(30) })).toBe("ESCALATED");
  });

  it("shows open cases only, live first, with a deadline bar and a reminder marker", () => {
    const d = timelineData([row({ id: "sim", simulated: true }), row({ id: "live" }), row({ id: "done", state: "RETURNED" })], h(10));
    expect(d.resources.map((r) => r.id)).toEqual(["live", "sim"]);
    expect(d.events.filter((e) => String(e.id).endsWith(":live"))).toHaveLength(2);
    expect(d.events.find((e) => e.id === "w:live")).toMatchObject({ endDate: h(72).toISOString(), resizable: "end" });
    expect(Date.parse(String(d.events.find((e) => e.id === "w:sim")!.endDate))).toBeGreaterThan(h(10).getTime());
  });
});
