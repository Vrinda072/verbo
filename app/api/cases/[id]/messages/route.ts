import { NextResponse } from "next/server";
import { z } from "zod";
import { caseDetail, postMessage } from "@/lib/recovery/service";
import { senderView } from "@/lib/recovery/views";
import { TransferError } from "@/lib/transfers/service";

export const dynamic = "force-dynamic";

const Body = z.object({ text: z.string().trim().min(1).max(1000), lang: z.string().regex(/^[a-z]{2,3}(-[A-Za-z0-9]+)*$/) });

/** POST /api/cases/:id/messages — sender writes in their language; stored with a translation if available. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const d = await caseDetail(id);
  if (!d) return NextResponse.json({ error: "not_found" }, { status: 404 });
  try {
    await postMessage(d.caseRow, "sender", parsed.data.text, parsed.data.lang);
    return NextResponse.json(senderView((await caseDetail(id))!));
  } catch (err) {
    if (err instanceof TransferError) return NextResponse.json({ error: err.code }, { status: err.status });
    throw err;
  }
}
