import { NextResponse } from "next/server";
import { z } from "zod";
import { caseDetail, caseFromToken, postMessage, refuse, startCaseReturn } from "@/lib/recovery/service";
import { recipientView } from "@/lib/recovery/views";
import { TransferError } from "@/lib/transfers/service";
import { log } from "@/lib/core/log";

export const dynamic = "force-dynamic";

const Message = z.object({ text: z.string().trim().min(1).max(1000), lang: z.string().regex(/^[a-z]{2,3}(-[A-Za-z0-9]+)*$/) });

/**
 * POST /api/recover/:token/return  → { approveUrl } (recipient approves the return on PayPal themselves)
 * POST /api/recover/:token/refuse  → recipient keeps the money (recorded, reversible)
 * POST /api/recover/:token/message { text, lang }
 */
export async function POST(req: Request, { params }: { params: Promise<{ token: string; action: string }> }) {
  const { token, action } = await params;
  const found = await caseFromToken(token);
  if (!found.ok) return NextResponse.json({ error: found.reason }, { status: 404 });
  const c = found.caseRow;
  try {
    if (action === "return") return NextResponse.json(await startCaseReturn(c));
    if (action === "refuse") await refuse(c);
    else if (action === "message") {
      const parsed = Message.safeParse(await req.json().catch(() => null));
      if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
      await postMessage(c, "recipient", parsed.data.text, parsed.data.lang);
    } else return NextResponse.json({ error: "unknown_action" }, { status: 404 });
    return NextResponse.json(recipientView((await caseDetail(c.id))!));
  } catch (err) {
    if (err instanceof TransferError) return NextResponse.json({ error: err.code }, { status: err.status });
    log.error("recover action failed", { action, message: (err as Error).message });
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
