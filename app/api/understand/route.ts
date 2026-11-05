import { NextResponse } from "next/server";
import { z } from "zod";
import { understand } from "@/lib/agents/extraction";
import { ExtractionFailed } from "@/lib/agents/extraction/anthropic";
import { formatAmount, labelsFor } from "@/lib/bridge/readback";
import { log } from "@/lib/log";
import { createDraft, summarizeRisk } from "@/lib/transfers/service";

export const dynamic = "force-dynamic";

const Body = z.object({
  transcript: z.string().trim().min(1).max(500),
  language: z.string().regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/),
});

/**
 * POST /api/understand { transcript, language }
 * Transcript → extraction (LLM or rules) → code validation → data for the fixed read-back card.
 * Nothing here moves money; the confirmation step does, after an explicit tap.
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const { transcript, language } = parsed.data;
  try {
    const u = await understand({ transcript, language });
    const labels = labelsFor(language);
    const r = u.result;
    const draft = r.ok ? r.draft : r.partial;
    const stored = await createDraft(u, transcript, language);
    return NextResponse.json({
      draftId: stored?.id ?? null,
      risk: stored ? summarizeRisk(stored.risk) : null,
      extractor: u.extractor,
      ok: r.ok,
      problems: r.ok ? [] : r.problems,
      heard: { recipient: u.extraction.recipient_spoken, amount: u.extraction.amount_spoken },
      recipient: draft.recipient
        ? { id: draft.recipient.id, name: draft.recipient.name, paidBefore: draft.recipient.paidBefore }
        : null,
      lookAlikes: (draft.lookAlikes ?? []).map((m) => ({ id: m.contact.id, name: m.contact.name })),
      amount: draft.amount ? { cents: draft.amount.cents, currency: draft.amount.currency, ...formatAmount(draft.amount, labels.usedLang) } : null,
      amountSource: draft.amountSource ?? null,
      currencyAssumed: draft.currencyAssumed ?? false,
    });
  } catch (err) {
    const reason = err instanceof ExtractionFailed ? err.reason : "extraction_error";
    log.error("understand failed", { reason });
    return NextResponse.json({ error: reason }, { status: 502 });
  }
}
