import { NextResponse } from "next/server";
import { cancel, publicView, TransferError } from "@/lib/transfers/service";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

/** POST /api/transfers/:id/cancel — during a hold this VOIDs the authorization; no money moves. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return NextResponse.json(publicView(await cancel(id)));
  } catch (err) {
    if (err instanceof TransferError) return NextResponse.json({ error: err.code }, { status: err.status });
    log.error("cancel failed", { id, message: (err as Error).message });
    return NextResponse.json({ error: "paypal_error" }, { status: 502 });
  }
}
