import { NextResponse } from "next/server";
import { caseDetail, recoveryLink } from "@/lib/recovery/service";
import { senderView } from "@/lib/recovery/views";

export const dynamic = "force-dynamic";

/** GET /api/cases/:id — sender's view of their case (timeline, messages, return status). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await caseDetail(id);
  if (!d) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(senderView(d, recoveryLink(id)), { headers: { "Cache-Control": "no-store" } });
}
