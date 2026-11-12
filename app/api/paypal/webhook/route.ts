import { NextResponse, type NextRequest } from "next/server";
import { getPayPal, type WebhookEvent, type WebhookHeaders } from "@/lib/paypal";
import { config } from "@/lib/core/config";
import { log } from "@/lib/core/log";
import { recordWebhookEvent } from "@/lib/paypal/webhook-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADER_NAMES: (keyof WebhookHeaders)[] = [
  "paypal-auth-algo",
  "paypal-cert-url",
  "paypal-transmission-id",
  "paypal-transmission-sig",
  "paypal-transmission-time",
];

/**
 * PayPal webhook receiver.
 * Verifies each delivery with POST /v1/notifications/verify-webhook-signature (Webhooks v1 spec,
 * operationId verify-webhook-signature.post), de-duplicates by event id, and records it.
 * Always answers 2xx quickly once verified so PayPal does not retry.
 */
export async function POST(req: NextRequest) {
  let event: WebhookEvent;
  try {
    event = (await req.json()) as WebhookEvent;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!event?.id || !event?.event_type) return NextResponse.json({ error: "not a webhook event" }, { status: 400 });

  const headers = Object.fromEntries(HEADER_NAMES.map((h) => [h, req.headers.get(h) ?? ""])) as unknown as WebhookHeaders;
  const webhookId = process.env.PAYPAL_WEBHOOK_ID ?? "";

  if (!config.mock) {
    if (!webhookId || HEADER_NAMES.some((h) => !headers[h])) {
      log.warn("webhook rejected: missing webhook id or signature headers", { type: event.event_type });
      return NextResponse.json({ error: "unverifiable" }, { status: 400 });
    }
    const verified = await getPayPal().verifyWebhookSignature(headers, event, webhookId).catch(() => false);
    if (!verified) {
      log.warn("webhook rejected: signature verification failed", { type: event.event_type, id: event.id });
      return NextResponse.json({ error: "signature" }, { status: 401 });
    }
  }

  const fresh = recordWebhookEvent(event);
  log.info(fresh ? "webhook received" : "webhook duplicate ignored", {
    id: event.id,
    type: event.event_type,
    resource: event.resource_type,
    resourceId: (event.resource as { id?: string })?.id,
  });
  // Day 4: dispatch to the transfer/case state machines here (by resource id).
  return NextResponse.json({ received: true, duplicate: !fresh });
}

/** Debug view of the last events received (no payload bodies). Disabled outside MOCK mode in production. */
export async function GET() {
  if (process.env.NODE_ENV === "production" && !config.mock) return new NextResponse(null, { status: 404 });
  const { recentWebhookEvents } = await import("@/lib/paypal/webhook-store");
  return NextResponse.json({ events: recentWebhookEvents() });
}
