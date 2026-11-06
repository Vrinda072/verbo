import { z } from "zod";

/**
 * What the LLM is allowed to return. It only *transcribes* intent into fields; it never decides money.
 * Every field is re-checked by code in `validate.ts` before anything is shown to the user.
 */
export const LlmExtraction = z
  .object({
    intent: z.enum(["send_money", "other"]).describe("send_money only if the speaker wants to pay someone"),
    recipient_spoken: z
      .string()
      .nullable()
      .describe("The recipient exactly as spoken (keep original script/spelling). null if not said."),
    recipient_latin: z
      .string()
      .nullable()
      .describe("recipient_spoken transliterated to Latin script (unchanged if already Latin). null if not said."),
    amount_spoken: z
      .string()
      .nullable()
      .describe("The exact words/numerals the speaker used for the amount, copied verbatim. null if not said."),
    amount: z
      .string()
      .nullable()
      .describe("That amount as a plain decimal string with '.' as separator, e.g. '12.34' or '20'. null if unclear."),
    currency: z
      .string()
      .nullable()
      .describe("ISO 4217 code if the speaker named a currency (dollars → USD), else null. Do not guess."),
    pressure_cues: z
      .array(z.string())
      .describe("Verbatim phrases from the transcript suggesting urgency, secrecy, threats or prizes. Empty if none."),
    unclear: z.string().nullable().describe("Short note if anything was ambiguous, else null."),
  })
  .strict();
export type LlmExtraction = z.infer<typeof LlmExtraction>;

export interface ExtractionInput {
  transcript: string;
  /** BCP-47 language the speaker selected or STT detected. */
  language: string;
}

export interface Extractor {
  readonly kind: "anthropic" | "gemini" | "rules";
  extract(input: ExtractionInput): Promise<LlmExtraction>;
}
