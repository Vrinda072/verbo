/**
 * Registers Verbo's webhook listener with the sandbox REST app.
 *
 *   npm run register-webhook -- https://<your-tunnel>.trycloudflare.com
 *
 * Subscribes only to event types that PayPal's own list (GET /v1/notifications/webhooks-event-types)
 * confirms exist, so we never subscribe to an invented name. Prints the new webhook id — paste it into
 * .env as PAYPAL_WEBHOOK_ID (it is an identifier, not a secret).
 */
import "dotenv/config";
import { RealPayPalClient } from "@/lib/paypal/real";
import { WEBHOOK_EVENT_TYPES } from "@/lib/paypal/client";

async function main() {
  const base = process.argv[2];
  if (!base || !/^https:\/\//.test(base)) {
    console.error("Usage: npm run register-webhook -- https://<public-https-url>   (PayPal requires HTTPS)");
    process.exit(1);
  }
  const pp = new RealPayPalClient();
  const available = new Set(await pp.listAvailableEventTypes());
  const wanted = WEBHOOK_EVENT_TYPES.filter((t) => available.has(t));
  const unknown = WEBHOOK_EVENT_TYPES.filter((t) => !available.has(t));
  if (unknown.length) console.warn(`Skipping event types PayPal does not list: ${unknown.join(", ")}`);
  const url = `${base.replace(/\/$/, "")}/api/paypal/webhook`;
  const { id } = await pp.createWebhook(url, wanted);
  console.log(`Webhook registered for ${url}`);
  console.log(`Subscribed to ${wanted.length} event types.`);
  console.log(`\nPAYPAL_WEBHOOK_ID=${id}\n\nAdd that line to .env, then restart npm run dev.`);
}

main().catch((e) => {
  console.error(`✘ ${e.message}${e.issue ? ` (${e.issue})` : ""}`);
  process.exit(1);
});
