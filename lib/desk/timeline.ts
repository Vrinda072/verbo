/** Turns Desk rows into the resources and events for the Bryntum deadline timeline. */
import type { DeskRow } from "./queries";
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

export function timelineData(rows: DeskRow[], now = new Date()) {
  const t = now.getTime();
  const open = rows
    .filter((r) => OPEN_STATES.has(r.state as CaseState) && deadlineOf(r, t) !== null)
    .sort((a, b) => Number(a.simulated) - Number(b.simulated) || deadlineOf(a, t)! - deadlineOf(b, t)!)
    .slice(0, TIMELINE_MAX_ROWS);

  const resources = open.map((r) => ({
    id: r.id,
    name: `${r.simulated ? "Simulated · " : ""}${r.recipientName} · $${(r.cents / 100).toFixed(2)}`,
    state: r.state,
  }));
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
    const remindAt = sent + REMINDER_AFTER_H * H;
    if (remindAt < end) {
      events.push({
        id: `r:${r.id}`,
        name: r.remindersSent ? "Reminder sent" : "Reminder due",
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
  return { resources, events, assignments };
}
