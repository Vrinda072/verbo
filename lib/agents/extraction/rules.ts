/**
 * Deterministic fallback extractor (no LLM). Used in MOCK mode, in tests, and when no LLM key is set.
 * It is intentionally simple: numerals + address-book names. Anything it can't read becomes null,
 * and validation then asks the user.
 */
import { CONTACTS, type Contact } from "@/lib/contacts";
import { normalizeDigits } from "@/lib/agents/numbers";
import { normalizeName } from "@/lib/agents/similarity";
import type { ExtractionInput, Extractor, LlmExtraction } from "./schema";

const CURRENCY_WORDS: [RegExp, string][] = [
  [/\$|\busd\b|dollars?|d[oó]lares?|డాలర్/iu, "USD"],
  [/€|\beur\b|euros?/iu, "EUR"],
  [/₹|\binr\b|rupees?|rupias?|రూపాయ/iu, "INR"],
];

const PAY_WORDS = /send|pay|transfer|give|env[ií]a|manda|paga|transfere|pague|పంపు|పంపండి|పంపించు|ఇవ్వు|భేజ|दे|भेज/iu;

export class RulesExtractor implements Extractor {
  readonly kind = "rules" as const;
  constructor(private contacts: Contact[] = CONTACTS) {}

  async extract({ transcript }: ExtractionInput): Promise<LlmExtraction> {
    const text = normalizeDigits(transcript);
    const num = /(\d{1,7}(?:[.,]\d{1,2})?)/.exec(text.replace(/(\d),(\d{3})\b/g, "$1$2"));
    const amount = num ? num[1].replace(",", ".") : null;

    const norm = normalizeName(transcript);
    let recipient: string | null = null;
    let best = 0;
    for (const c of this.contacts) {
      for (const n of [c.name, ...c.aliases]) {
        const nn = normalizeName(n);
        if (nn && ` ${norm} `.includes(` ${nn} `) && nn.length > best) {
          best = nn.length;
          recipient = n;
        }
      }
    }

    const currency = CURRENCY_WORDS.find(([re]) => re.test(transcript))?.[1] ?? null;
    return {
      intent: PAY_WORDS.test(transcript) || (amount && recipient) ? "send_money" : "other",
      recipient_spoken: recipient,
      recipient_latin: null,
      amount_spoken: num ? num[1] : null,
      amount,
      currency,
      pressure_cues: [],
      unclear: null,
    };
  }
}
