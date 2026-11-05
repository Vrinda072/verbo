import { NextResponse } from "next/server";
import { z } from "zod";
import { operatorAction } from "@/lib/recovery/service";
import { TransferError } from "@/lib/transfers/service";

export const dynamic = "force-dynamic";

/** POST /api/desk/cases/:id/action { action: remind | escalate | close } — demo operator, no login. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = z.object({ action: z.enum(["remind", "escalate", "close"]) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  try {
    const c = await operatorAction(id, parsed.data.action);
    return NextResponse.json({ id: c.id, state: c.state });
  } catch (err) {
    if (err instanceof TransferError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }
}
