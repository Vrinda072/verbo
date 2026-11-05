import { NextResponse } from "next/server";
import { buildPacket } from "@/lib/evidence/packet";
import { EVIDENCE_ITEMS } from "@/lib/evidence/meter";

export const dynamic = "force-dynamic";

/** GET /api/desk/cases/:id — detail for the grid's expanded row (from the evidence packet). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await buildPacket(id);
  if (!p) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ packet: p.packet, sha256: p.sha256, items: EVIDENCE_ITEMS }, { headers: { "Cache-Control": "no-store" } });
}
