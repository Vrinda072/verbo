import { config } from "@/lib/config";
import { AnthropicExtractor } from "./anthropic";
import { RulesExtractor } from "./rules";
import type { Extractor, ExtractionInput } from "./schema";
import { validateExtraction, type ValidationResult } from "./validate";
import type { LlmExtraction } from "./schema";

export * from "./schema";
export * from "./validate";

let cached: Extractor | undefined;

/** Claude when a key is configured and MOCK is off; otherwise the deterministic rules extractor. */
export function getExtractor(): Extractor {
  if (cached) return cached;
  const useLlm = !config.mock && process.env.LLM_PROVIDER === "anthropic" && !!process.env.ANTHROPIC_API_KEY;
  cached = useLlm ? new AnthropicExtractor() : new RulesExtractor();
  return cached;
}

export interface Understanding {
  extractor: Extractor["kind"];
  extraction: LlmExtraction;
  result: ValidationResult;
}

/** Transcript → structured fields (LLM or rules) → code validation. */
export async function understand(
  input: ExtractionInput,
  extractor = getExtractor(),
  /** The contact the user tapped after an ambiguous name. Must be an exact address-book name. */
  chosenRecipient?: string,
): Promise<Understanding> {
  const extraction = await extractor.extract(input);
  if (chosenRecipient) {
    extraction.recipient_spoken = chosenRecipient;
    extraction.recipient_latin = chosenRecipient;
  }
  return { extractor: extractor.kind, extraction, result: validateExtraction(extraction, input.transcript) };
}
