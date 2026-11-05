import { NextResponse } from "next/server";
import { publicView, tick } from "@/lib/transfers/service";

export const dynamic = "force-dynamic";

/** GET /api/transfers/:id — current state for the sender's screen. Also advances due holds/payouts. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await tick(id);
  if (!t) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(publicView(t), { headers: { "Cache-Control": "no-store" } });
}
