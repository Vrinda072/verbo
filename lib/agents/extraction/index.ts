import { log } from "@/lib/log";
import { AnthropicExtractor } from "./anthropic";
import { GeminiExtractor } from "./gemini";
import { findAmount, RulesExtractor } from "./rules";
import type { Extractor, ExtractionInput } from "./schema";
import { validateExtraction, type ValidationResult } from "./validate";
import type { LlmExtraction } from "./schema";

export * from "./schema";
export * from "./validate";

let cached: Extractor | undefined;

/**
 * Gemini when GEMINI_API_KEY is set, Claude when LLM_PROVIDER=anthropic with a key, otherwise the rules parser.
 * Independent of MOCK, which only controls PayPal: the demo can use real AI with mock money.
 */
export function getExtractor(): Extractor {
  if (cached) return cached;
  const provider = process.env.LLM_PROVIDER;
  if (provider === "rules") cached = new RulesExtractor();
  else if (provider === "anthropic" && process.env.ANTHROPIC_API_KEY) cached = new AnthropicExtractor();
  else if (process.env.GEMINI_API_KEY) cached = new GeminiExtractor();
  else cached = new RulesExtractor();
  return cached;
}

export interface Understanding {
  extractor: Extractor["kind"];
  extraction: LlmExtraction;
  result: ValidationResult;
  /** The AI failed (quota, network, bad answer) and the rules parser stepped in. */
  fellBack: boolean;
}

/** Transcript → structured fields (LLM or rules) → code validation. */
export async function understand(
  input: ExtractionInput,
  extractor = getExtractor(),
  /** The contact the user tapped after an ambiguous name. Must be an exact address-book name. */
  chosenRecipient?: string,
  opts: { fallback?: boolean; fromVoice?: boolean } = {},
): Promise<Understanding> {
  let used = extractor;
  let extraction: LlmExtraction;
  let fellBack = false;
  try {
    extraction = await extractor.extract(input);
  } catch (err) {
    if (opts.fallback === false || extractor.kind === "rules") throw err;
    log.warn("extraction fell back to rules", { from: extractor.kind, message: (err as Error).message });
    used = new RulesExtractor();
    extraction = await used.extract(input);
    fellBack = true;
  }
  // Models can decline number words they read fine ("ఇరవై ఐదు"). Code's own parser fills the gap; it refuses several
  // amounts, and word amounts still need the person to type the digits.
  if (extraction.amount == null) {
    const found = findAmount(input.transcript, input.language);
    if (found && "amount" in found) extraction.amount = found.amount;
  }
  if (chosenRecipient) {
    extraction.recipient_spoken = chosenRecipient;
    extraction.recipient_latin = chosenRecipient;
  }
  let result = validateExtraction(extraction, input.transcript);
  // Speech can't reliably tell Lopez from Lopes, so a speech model must not choose who gets paid. The person taps instead.
  if (opts.fromVoice && !chosenRecipient && result.ok && result.draft.lookAlikes.length) {
    const { draft } = result;
    result = {
      ok: false,
      partial: draft,
      problems: [{ code: "recipient_ambiguous", candidates: [draft.recipient.name, ...draft.lookAlikes.map((m) => m.contact.name)] }],
    };
  }
  return { extractor: used.kind, extraction, result, fellBack };
}
