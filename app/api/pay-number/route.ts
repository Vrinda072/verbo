import { NextResponse } from "next/server";
import { z } from "zod";
import { formatAmount } from "@/lib/bridge/readback";
import { LANGUAGES } from "@/lib/bridge/readback";
import { log } from "@/lib/log";
import { money, MAX_SANDBOX_CENTS } from "@/lib/paypal/money";
import { digitsOf, lookupNumber } from "@/lib/phone";
import { overLimit } from "@/lib/rateLimit";
import { createNumberDraft, summarizeRisk } from "@/lib/transfers/service";

export const dynamic = "force-dynamic";

const Body = z.object({
  phone: z.string().trim().min(6).max(24),
  cents: z.number().int().positive().max(MAX_SANDBOX_CENTS),
  language: z.string().regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/),
});

const langName = (code: string) => LANGUAGES.find((l) => l.code === code)?.englishName ?? code;

/**
 * POST /api/pay-number { phone, cents, language } — who a typed number reaches, and a draft for the confirmation card.
 * Moves no money. The response has the same shape as /api/understand, plus what the number nearly was.
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  if (overLimit("pay-number", 30)) return NextResponse.json({ error: "busy" }, { status: 503 });
  const { phone, cents, language } = parsed.data;
  const { owner, near } = lookupNumber(phone);
  if (!owner) return NextResponse.json({ error: "no_account", near: near ? { name: near.contact.name, phone: near.contact.phone } : null }, { status: 404 });

  try {
    const draft = await createNumberDraft({ recipient: owner, cents, language, nearContact: near?.contact });
    const amount = money(cents);
    return NextResponse.json({
      draftId: draft.id,
      risk: summarizeRisk(draft.risk),
      extractor: "rules",
      ok: true,
      problems: [],
      heard: { recipient: phone, amount: null },
      recipient: { id: owner.id, name: owner.name, paidBefore: owner.paidBefore },
      lookAlikes: [],
      amount: { cents, currency: amount.currency, localized: formatAmount(amount, language).localized, digits: formatAmount(amount, language).digits },
      amountSource: "numerals",
      currencyAssumed: false,
      nearContact: near?.contact.name,
      number: {
        typed: digitsOf(phone),
        owner: { name: owner.name, language: langName(owner.language), languageCode: owner.language, city: owner.city, timeZone: owner.timeZone },
        near: near ? { name: near.contact.name, phone: near.contact.phone, digits: digitsOf(near.contact.phone), positions: near.positions } : null,
      },
    });
  } catch (err) {
    log.error("pay-number failed", { message: (err as Error).message });
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
