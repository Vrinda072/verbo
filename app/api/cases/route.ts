import { NextResponse } from "next/server";
import { z } from "zod";
import { caseDetail, openCase } from "@/lib/recovery/service";
import { senderView } from "@/lib/recovery/views";
import { TransferError } from "@/lib/transfers/service";
import { log } from "@/lib/core/log";

export const dynamic = "force-dynamic";

/** POST /api/cases { transferId } — sender: "Sent to the wrong person? Ask for it back". Idempotent per transfer. */
export async function POST(req: Request) {
  const parsed = z.object({ transferId: z.string().min(4) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  try {
    const { caseRow, link } = await openCase(parsed.data.transferId);
    // The link is shown to the sender only because delivery is simulated in this demo.
    return NextResponse.json(senderView((await caseDetail(caseRow.id))!, link));
  } catch (err) {
    if (err instanceof TransferError) return NextResponse.json({ error: err.code }, { status: err.status });
    log.error("open case failed", { message: (err as Error).message });
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
