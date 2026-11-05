import { NextResponse } from "next/server";
import { caseDetail, caseFromToken } from "@/lib/recovery/service";
import { recipientView } from "@/lib/recovery/views";

export const dynamic = "force-dynamic";

/** GET /api/recover/:token — recipient's view (polling). */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await caseFromToken(token);
  if (!found.ok) return NextResponse.json({ error: found.reason }, { status: 404 });
  return NextResponse.json(recipientView((await caseDetail(found.caseRow.id))!), { headers: { "Cache-Control": "no-store" } });
}
