import { geminiJson, realGeminiCreate, type GeminiCreate } from "@/lib/agents/gemini";
import { EXTRACTION_SYSTEM } from "./anthropic";
import { LlmExtraction, type ExtractionInput, type Extractor } from "./schema";

/** Transcript → LlmExtraction via Gemini structured output. `validate.ts` still decides whether anything is usable. */
export class GeminiExtractor implements Extractor {
  readonly kind = "gemini" as const;
  private create: GeminiCreate;

  constructor(create?: GeminiCreate) {
    this.create = create ?? realGeminiCreate();
  }

  extract({ transcript, language }: ExtractionInput): Promise<LlmExtraction> {
    return geminiJson(this.create, {
      system: EXTRACTION_SYSTEM,
      input: `Speaker language (BCP-47): ${language}\n<transcript>\n${transcript}\n</transcript>`,
      schema: LlmExtraction,
    });
  }
}
