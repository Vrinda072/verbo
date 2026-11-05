/**
 * Code validation of an LLM extraction. This is where money is decided — never in the model.
 * Output is either a `ValidDraft` (ready for the fixed read-back template + explicit confirmation)
 * or a list of problems the UI must resolve with the user.
 */
import { CONTACTS, type Contact } from "@/lib/contacts";
import { money, MAX_SANDBOX_CENTS as MAX_CENTS } from "@/lib/paypal/money";
import type { Money } from "@/lib/paypal/types";
import { candidateCents, decimalToCents, hasDigits } from "@/lib/agents/numbers";
import { jaroWinkler, normalizeName } from "@/lib/agents/similarity";
import type { LlmExtraction } from "./schema";

export type Problem =
  | { code: "not_a_payment" }
  | { code: "missing_recipient" }
  | { code: "recipient_not_found"; spoken: string }
  | { code: "recipient_ambiguous"; candidates: string[] }
  | { code: "missing_amount" }
  | { code: "amount_invalid"; value: string | null }
  | { code: "amount_out_of_range"; cents: number }
  | { code: "amount_not_in_transcript"; value: string }
  | { code: "currency_unsupported"; currency: string };

export interface RecipientMatch {
  contact: Contact;
  score: number;
}

export interface ValidDraft {
  recipient: Contact;
  /** Other contacts whose names are close to the chosen one (input to the Day-3 similar-name warning). */
  lookAlikes: RecipientMatch[];
  amount: Money;
  /** "numerals": the digits were in the transcript. "words": spoken as words, so the UI must ask the user to type/confirm the digits. */
  amountSource: "numerals" | "words";
  currencyAssumed: boolean;
}

export type ValidationResult = { ok: true; draft: ValidDraft } | { ok: false; problems: Problem[]; partial: Partial<ValidDraft> };

const MATCH = 0.9; // name similarity needed to count as the same contact
const LOOKALIKE = 0.85; // close enough to warn about

export function resolveRecipient(spoken: string | string[], contacts: Contact[] = CONTACTS) {
  const forms = (Array.isArray(spoken) ? spoken : [spoken]).map(normalizeName).filter(Boolean);
  const scored = contacts
    .map((c) => ({
      contact: c,
      score: Math.max(...forms.flatMap((s) => [c.name, ...c.aliases].map((n) => jaroWinkler(s, normalizeName(n))))),
    }))
    .sort((a, b) => b.score - a.score);
  const matches = scored.filter((m) => m.score >= MATCH);
  const exact = scored.filter((m) => m.score === 1);
  return { scored, matches, exact };
}

export function validateExtraction(x: LlmExtraction, transcript: string, contacts: Contact[] = CONTACTS): ValidationResult {
  const problems: Problem[] = [];
  const partial: Partial<ValidDraft> = {};

  if (x.intent !== "send_money") problems.push({ code: "not_a_payment" });

  // Recipient — resolved by code against the address book.
  if (!x.recipient_spoken?.trim()) {
    problems.push({ code: "missing_recipient" });
  } else {
    const forms = [x.recipient_spoken, x.recipient_latin].filter((f): f is string => !!f?.trim());
    const { scored, matches, exact } = resolveRecipient(forms, contacts);
    const chosen = exact.length === 1 ? exact[0] : matches.length === 1 ? matches[0] : undefined;
    if (chosen) {
      partial.recipient = chosen.contact;
      partial.lookAlikes = scored.filter((m) => m.contact.id !== chosen.contact.id && m.score >= LOOKALIKE);
    } else if (matches.length > 1) {
      problems.push({ code: "recipient_ambiguous", candidates: matches.map((m) => m.contact.name) });
    } else {
      problems.push({ code: "recipient_not_found", spoken: x.recipient_spoken });
    }
  }

  // Amount — strict decimal, in range, and grounded in what was actually said.
  if (x.amount === null || x.amount === undefined) {
    problems.push({ code: "missing_amount" });
  } else {
    const cents = decimalToCents(x.amount);
    if (cents === null) problems.push({ code: "amount_invalid", value: x.amount });
    else if (cents <= 0 || cents > MAX_CENTS) problems.push({ code: "amount_out_of_range", cents });
    else if (hasDigits(transcript)) {
      if (!candidateCents(transcript).has(cents)) problems.push({ code: "amount_not_in_transcript", value: x.amount });
      else {
        partial.amount = money(cents);
        partial.amountSource = "numerals";
      }
    } else {
      partial.amount = money(cents);
      partial.amountSource = "words";
    }
  }

  // Currency — the sandbox demo is USD only; never silently convert.
  const cur = x.currency?.trim().toUpperCase() || null;
  if (cur && cur !== "USD") problems.push({ code: "currency_unsupported", currency: cur });
  partial.currencyAssumed = cur === null;

  if (problems.length) return { ok: false, problems, partial };
  return { ok: true, draft: partial as ValidDraft };
}
