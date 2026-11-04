import type { WebhookEvent } from "./types";

/**
 * Minimal in-process webhook ledger for Day 1 (de-duplication by PayPal event id + recent list).
 * Replaced by the `webhook_events` table once the DB lands; the interface stays the same.
 */
const seen = new Map<string, { id: string; type: string; resourceId?: string; receivedAt: string }>();
const MAX = 500;

/** Returns true the first time an event id is seen, false for PayPal's retries. */
export function recordWebhookEvent(e: WebhookEvent): boolean {
  if (seen.has(e.id)) return false;
  seen.set(e.id, {
    id: e.id,
    type: e.event_type,
    resourceId: (e.resource as { id?: string })?.id,
    receivedAt: new Date().toISOString(),
  });
  if (seen.size > MAX) seen.delete(seen.keys().next().value!);
  return true;
}

export function recentWebhookEvents() {
  return [...seen.values()].reverse().slice(0, 50);
}
