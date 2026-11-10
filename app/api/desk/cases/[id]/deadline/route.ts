import { NextResponse } from "next/server";
import { z } from "zod";
import { DeadlineError, moveDeadline } from "@/lib/recovery/service";

export const dynamic = "force-dynamic";

const Body = z.object({ escalateAt: z.string().datetime() });

/** POST /api/desk/cases/:id/deadline — move a case's escalation deadline from the timeline. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  try {
    await moveDeadline(id, new Date(parsed.data.escalateAt));
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof DeadlineError) return NextResponse.json({ error: err.code }, { status: 409 });
    throw err;
  }
}
