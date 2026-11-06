/**
 * Deterministic fallback extractor (no LLM). Used in MOCK mode, in tests, and when no LLM key is set.
 * Built for real speech output: tolerates spelling variation in names, reads number words, and refuses to guess
 * when it hears more than one amount. Anything it can't read becomes null, and validation then asks the user.
 */
import { CONTACTS, type Contact } from "@/lib/contacts";
import { dollarsAndCents, normalizeDigits } from "@/lib/agents/numbers";
import { parseNumberWords } from "@/lib/agents/numberWords";
import { jaroWinkler, normalizeName } from "@/lib/agents/similarity";
import type { ExtractionInput, Extractor, LlmExtraction } from "./schema";

/** Currency words. A foreign one must be caught: treating "500 rupees" as dollars would be a money error. */
const CURRENCY_WORDS: [RegExp, string][] = [
  [/\$|\busd\b|dollars?|bucks?|d[oó]lar(es)?|డాలర్|डॉलर|دولار/iu, "USD"],
  [/€|\beur\b|euros?|యూరో|यूरो|يورو/iu, "EUR"],
  [/₹|\binr\b|rupees?|rupias?|రూపాయ|रुपय|रुपए|रुपये|روپے|روبية/iu, "INR"],
  [/£|\bgbp\b|pounds?|libras?|పౌండ్|पाउंड|جنيه/iu, "GBP"],
  [/\bmxn\b|pesos?/iu, "MXN"],
  [/\bbrl\b|\breais\b|\breal\b/iu, "BRL"],
  [/\baed\b|dirhams?|درهم|दिरहम|దిర్హామ్/iu, "AED"],
  [/\bsar\b|riyals?|ريال|रियाल|రియాల్/iu, "SAR"],
  [/¥|\bjpy\b|\byen\b|\bcny\b|yuan/iu, "OTHER"],
];

const PAY_WORDS = /send|pay|transfer|give|env[ií]a|manda|paga|transfere|envie|pague|పంపు|పంపండి|పంపించు|ఇవ్వు|భేజ|दे|भेज|أرسل|ارسل|حول/iu;

/** Same threshold validation uses, so a window accepted here can still resolve there. */
const NAME_MATCH = 0.9;
const MAX_NAME_WORDS = 3;

/** The stretch of the transcript that sounds most like a contact, e.g. a differently spelled "మాన్యుయల్ లోపెజ్". */
function findRecipient(transcript: string, contacts: Contact[]): string | null {
  const words = normalizeName(transcript).split(" ").filter(Boolean);
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
  return best?.text ?? null;
}

/** The one amount said, or null when there is none or several different ones. */
function findAmount(transcript: string, lang: string): { amount: string; spoken: string } | { unclear: string } | null {
  const split = dollarsAndCents(transcript);
  if (split !== null) return { amount: (split / 100).toFixed(2), spoken: String(split / 100) };

  const text = normalizeDigits(transcript).replace(/(\d),(\d{3})\b/g, "$1$2");
  const numerals = [...new Set([...text.matchAll(/\d{1,7}(?:[.,]\d{1,2})?/g)].map((m) => m[0].replace(",", ".")))];
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
    const currency = CURRENCY_WORDS.find(([re]) => re.test(transcript))?.[1] ?? null;
    return {
      intent: PAY_WORDS.test(transcript) || (amount && recipient) ? "send_money" : "other",
      recipient_spoken: recipient,
      recipient_latin: null,
      amount_spoken: found && "spoken" in found ? found.spoken : null,
      amount,
      currency,
      pressure_cues: [],
      unclear: found && "unclear" in found ? found.unclear : null,
    };
  }
}
