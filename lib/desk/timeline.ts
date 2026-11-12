/** Turns Desk rows into the resources and events for the Bryntum deadline timeline. */
import type { DeskRow } from "./queries";
import { cityFor, clockIn, nextDaytime, quietRanges, timeZoneFor } from "@/lib/localTime";
import { ESCALATE_AFTER_H, REMINDER_AFTER_H, OPEN_STATES, type CaseState } from "@/lib/recovery/state";

const H = 3_600_000;
export const TIMELINE_MAX_ROWS = 60;

/**
 * Simulated cases were seeded on one fixed day and never tick, so their real dates drift into the past. On the timeline
 * each is placed a stable 2 to 68 hours into its 72-hour window, as a live queue would look. Live cases use real dates.
 */
export function linkSentMs(r: DeskRow, now: number): number {
  if (!r.simulated) return Date.parse(r.linkSentAt!);
  let hash = 0;
  for (const ch of r.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return now - (2 + (hash % 67)) * H;
}

export function deadlineOf(r: DeskRow, now: number): number | null {
  if (!r.linkSentAt) return null;
  return r.escalateAt ? Date.parse(r.escalateAt) : linkSentMs(r, now) + ESCALATE_AFTER_H * H;
}

/** The window the chart shows, so night shading covers exactly what is visible. */
export const VIEW_BEFORE_MS = 4 * 24 * H;
export const VIEW_AFTER_MS = 8 * 24 * H;

export function timelineData(rows: DeskRow[], now = new Date()) {
  const t = now.getTime();
  const open = rows
    .filter((r) => OPEN_STATES.has(r.state as CaseState) && deadlineOf(r, t) !== null)
    .sort((a, b) => Number(a.simulated) - Number(b.simulated) || deadlineOf(a, t)! - deadlineOf(b, t)!)
    .slice(0, TIMELINE_MAX_ROWS);

  const resources = open.map((r) => {
    const tz = timeZoneFor(r.recipientName, r.recipientLanguage);
    return {
      id: r.id,
      name: `${r.simulated ? "Simulated · " : ""}${r.recipientName} · $${(r.cents / 100).toFixed(2)}`,
      state: r.state,
      local: `${clockIn(now, tz)} ${cityFor(r.recipientName) ?? tz.split("/").pop()!.replace(/_/g, " ")}`,
    };
  });
  // Night where each recipient lives, shaded on their own row. Reminders never land inside it.
  const resourceTimeRanges: Record<string, unknown>[] = [];
  for (const r of open) {
    const tz = timeZoneFor(r.recipientName, r.recipientLanguage);
    quietRanges(new Date(t - VIEW_BEFORE_MS), new Date(t + VIEW_AFTER_MS), tz).forEach((q, i) =>
      resourceTimeRanges.push({ id: `n:${r.id}:${i}`, resourceId: r.id, startDate: q.start.toISOString(), endDate: q.end.toISOString(), name: "", cls: "v-night" }),
    );
  }
  const events: Record<string, unknown>[] = [];
  const assignments: Record<string, unknown>[] = [];
  for (const r of open) {
    const sent = linkSentMs(r, t);
    const end = deadlineOf(r, t)!;
    const overdue = end <= t;
    events.push({
      id: `w:${r.id}`,
      name: overdue ? "Past deadline" : "Waiting for recipient",
      startDate: new Date(sent).toISOString(),
      endDate: new Date(end).toISOString(),
      manuallyScheduled: true,
      draggable: false,
      resizable: "end",
      eventColor: overdue ? "red" : "green",
    });
    assignments.push({ id: `aw:${r.id}`, event: `w:${r.id}`, resource: r.id });
    const tz = timeZoneFor(r.recipientName, r.recipientLanguage);
    const firstDue = sent + REMINDER_AFTER_H * H;
    const remindAt = nextDaytime(new Date(firstDue), tz).getTime();
    const waited = remindAt > firstDue + 60_000;
    if (remindAt < end) {
      events.push({
        id: `r:${r.id}`,
        name: `${r.remindersSent ? "Reminder sent" : "Reminder due"} · ${clockIn(new Date(remindAt), tz)} their time${waited ? ", after their night" : ""}`,
        startDate: new Date(remindAt).toISOString(),
        duration: 0,
        manuallyScheduled: true,
        draggable: false,
        resizable: false,
        eventColor: "blue",
      });
      assignments.push({ id: `ar:${r.id}`, event: `r:${r.id}`, resource: r.id });
    }
  }
  return { resources, events, assignments, resourceTimeRanges };
}
