import { NextResponse } from "next/server";
import { z } from "zod";
import { config } from "@/lib/config";
import { CONTACTS, contactEmail } from "@/lib/contacts";
import { getPayPal } from "@/lib/paypal";
import { startTransfer } from "@/lib/paypal/flows";
import { money, MAX_SANDBOX_CENTS } from "@/lib/paypal/money";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

const Body = z.object({
  /** Client-generated once per confirmation card; makes double-taps idempotent (same PayPal-Request-Id). */
  nonce: z.string().uuid(),
  recipientId: z.string(),
  cents: z.number().int().positive().max(MAX_SANDBOX_CENTS),
  /** Present when the amount was spoken in words: the user must have typed the same digits. */
  typedCents: z.number().int().positive().optional(),
  amountSource: z.enum(["numerals", "words"]),
});

/**
 * POST /api/transfers — called only after the user tapped "Yes, send" on the fixed read-back card.
 * Re-validates everything server-side (never trusts the client or the LLM), then creates a PayPal
 * Order (intent AUTHORIZE) that the sender approves on PayPal.
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const b = parsed.data;

  if (b.amountSource === "words" && b.typedCents !== b.cents)
    return NextResponse.json({ error: "typed_amount_mismatch" }, { status: 400 });

  const contact = CONTACTS.find((c) => c.id === b.recipientId);
  if (!contact) return NextResponse.json({ error: "unknown_recipient" }, { status: 400 });
  const recipientEmail = contactEmail(contact) ?? (config.mock ? `${contact.id}@example.test` : undefined);
  const senderEmail = process.env.SANDBOX_SENDER_EMAIL || (config.mock ? "sender@example.test" : undefined);
  if (!recipientEmail || !senderEmail)
    return NextResponse.json({ error: "recipient_not_payable_in_demo" }, { status: 400 });

  const base = config.baseUrl;
  try {
    const pp = getPayPal();
    const t = await startTransfer(pp, {
      id: `tr_${b.nonce}`,
      amount: money(b.cents),
      senderEmail,
      recipientEmail,
      urls: { returnUrl: `${base}/paypal/return`, cancelUrl: `${base}/paypal/return?cancelled=1` },
      description: `Verbo transfer to ${contact.name} (sandbox)`,
    });
    log.info("transfer created", { id: t.id, orderId: t.orderId, recipient: contact.id, cents: b.cents });
    const approveUrl = pp.kind === "mock" ? `${base}/paypal/return?mock=1&token=${t.orderId}` : t.approveUrl;
    return NextResponse.json({ id: t.id, orderId: t.orderId, state: t.state, approveUrl, mode: pp.kind });
  } catch (err) {
    log.error("transfer create failed", { message: (err as Error).message });
    return NextResponse.json({ error: "paypal_error" }, { status: 502 });
  }
}
