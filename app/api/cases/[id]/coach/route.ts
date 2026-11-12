import { NextResponse } from "next/server";
import { z } from "zod";
import { coachMessages } from "@/lib/agents/recovery/coach";
import { overLimit } from "@/lib/rateLimit";
import { caseDetail } from "@/lib/recovery/service";

export const dynamic = "force-dynamic";

const Body = z.object({ lang: z.string().regex(/^[a-z]{2,3}(-[A-Za-z0-9]+)*$/) });

/** POST /api/cases/:id/coach — AI-drafted messages for the sender to edit. Sends nothing and moves no money. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  if (overLimit("coach", 20)) return NextResponse.json({ error: "busy" }, { status: 503 });
  const d = await caseDetail(id);
  if (!d) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const lang = parsed.data.lang;
  return NextResponse.json(
    await coachMessages({
      senderName: d.caseRow.senderName,
      recipientName: d.caseRow.recipientName,
      cents: d.caseRow.amountCents,
      state: d.caseRow.state,
      language: lang,
      conversation: d.messages.map((m) => ({
        author: m.author as "sender" | "recipient",
        // Show the coach the sender's-language version of what the recipient wrote.
        text: m.author === "recipient" && m.translatedText ? m.translatedText : m.text,
      })),
    }),
  );
}
