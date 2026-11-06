/**
 * Deterministic fallback extractor (no LLM). Used in MOCK mode, in tests, and when no LLM key is set.
 * Built for real speech output: tolerates spelling variation in names, reads number words, and refuses to guess
 * when it hears more than one amount. Anything it can't read becomes null, and validation then asks the user.
 */
import { CONTACTS, type Contact } from "@/lib/contacts";
import { spokenCurrencies } from "@/lib/agents/currency";
import { dollarsAndCents, distinctNumerals } from "@/lib/agents/numbers";
import { parseNumberWords } from "@/lib/agents/numberWords";
import { phoneticKey } from "@/lib/agents/phonetic";
import { jaroWinkler, normalizeName } from "@/lib/agents/similarity";
import type { ExtractionInput, Extractor, LlmExtraction } from "./schema";

const PAY_WORDS = /send|pay|transfer|give|env[ií]a|manda|paga|transfere|envie|pague|పంపు|పంపండి|పంపించు|ఇవ్వు|భేజ|दे|भेज|أرسل|ارسل|حول/iu;

/** Same threshold validation uses, so a window accepted here can still resolve there. */
const NAME_MATCH = 0.9;
const MAX_NAME_WORDS = 3;

/**
 * A full name said in any script, matched by sound: "मैनुअल लोपेज" → Manuel Lopez. Two words minimum, because a single
 * word's sound key can collide with ordinary words (करना, "to do", sounds like Kiran).
 */
function findBySound(words: string[], contacts: Contact[]): { spoken: string; contact: Contact } | null {
  const keyed = contacts.map((c) => ({ c, keys: [c.name, ...c.aliases].map(phoneticKey).filter((k) => k.includes(" ")) }));
  for (let size = MAX_NAME_WORDS; size >= 2; size--) {
    for (let i = 0; i + size <= words.length; i++) {
      const spoken = words.slice(i, i + size).join(" ");
      const key = phoneticKey(spoken);
      const hits = keyed.filter((k) => k.keys.includes(key));
      if (hits.length === 1) return { spoken, contact: hits[0].c };
    }
  }
  return null;
}

/** The stretch of the transcript that sounds most like a contact, e.g. a differently spelled "మాన్యుయల్ లోపెజ్". */
function findRecipient(transcript: string, contacts: Contact[]): { spoken: string; latin: string | null } | null {
  const words = normalizeName(transcript).split(" ").filter(Boolean);
  const bySound = findBySound(words, contacts);
  if (bySound) return { spoken: bySound.spoken, latin: bySound.contact.name };
  const names = contacts.flatMap((c) => [c.name, ...c.aliases]).map(normalizeName).filter(Boolean);
  let best: { text: string; score: number; size: number } | null = null;
  for (let size = MAX_NAME_WORDS; size >= 1; size--) {
    for (let i = 0; i + size <= words.length; i++) {
      const text = words.slice(i, i + size).join(" ");
      if (text.length < 3) continue;
      for (const n of names) {
        const score = jaroWinkler(text, n);
        if (score >= NAME_MATCH && (!best || score > best.score)) best = { text, score, size };
      }
    }
  }
  return best ? { spoken: best.text, latin: null } : null;
}

/** The one amount said, or null when there is none or several different ones. */
export function findAmount(transcript: string, lang: string): { amount: string; spoken: string } | { unclear: string } | null {
  const split = dollarsAndCents(transcript);
  if (split !== null) return { amount: (split / 100).toFixed(2), spoken: String(split / 100) };

  const numerals = distinctNumerals(transcript);
  if (numerals.length > 1) return { unclear: "more than one amount was said" };
  if (numerals.length === 1) return { amount: numerals[0], spoken: numerals[0] };

  const words = parseNumberWords(transcript, lang);
  return words === null ? null : { amount: String(words), spoken: String(words) };
}

export class RulesExtractor implements Extractor {
  readonly kind = "rules" as const;
  constructor(private contacts: Contact[] = CONTACTS) {}

  async extract({ transcript, language }: ExtractionInput): Promise<LlmExtraction> {
    const found = findAmount(transcript, language);
    const amount = found && "amount" in found ? found.amount : null;
    const recipient = findRecipient(transcript, this.contacts);
    const currency = spokenCurrencies(transcript)[0] ?? null;
    return {
      intent: PAY_WORDS.test(transcript) || (amount && recipient) ? "send_money" : "other",
      recipient_spoken: recipient?.spoken ?? null,
      recipient_latin: recipient?.latin ?? null,
      amount_spoken: found && "spoken" in found ? found.spoken : null,
      amount,
      currency,
      pressure_cues: [],
      unclear: found && "unclear" in found ? found.unclear : null,
    };
  }
}
