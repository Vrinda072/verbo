import { NextResponse } from "next/server";
import { z } from "zod";
import { createTransferFromDraft, publicView, TransferError } from "@/lib/transfers/service";
import { log } from "@/lib/core/log";

export const dynamic = "force-dynamic";

const Body = z.object({
  /** Server-side draft from /api/understand: recipient, amount and risk come from here, not the client. */
  draftId: z.string().uuid(),
  /** Generated once per confirmation card; a double tap reuses the same transfer and PayPal-Request-Id. */
  nonce: z.string().uuid(),
  /** Required when the amount was spoken in words. */
  typedCents: z.number().int().positive().optional(),
});

/** POST /api/transfers — only after the user tapped "Yes, send" on the read-back card. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  try {
    const t = await createTransferFromDraft(parsed.data);
    return NextResponse.json(publicView(t));
  } catch (err) {
    if (err instanceof TransferError) return NextResponse.json({ error: err.code }, { status: err.status });
    log.error("transfer create failed", { message: (err as Error).message });
    return NextResponse.json({ error: "paypal_error" }, { status: 502 });
  }
}
