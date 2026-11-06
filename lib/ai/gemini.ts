/**
 * Gemini client for typed JSON. It only fills fields or translates text; code decides money.
 * Source: aistudio.google.com/docs/structured-output, /docs/models (read Nov 6, 2026) and @google/genai 3.0.0 genai.d.ts:
 * client.interactions.create({ model, input, system_instruction, response_format, store }) → interaction.output_text.
 * gemini-3.6-flash is marked Stable and listed with a free tier. store:false: not kept for later retrieval. Free-tier
 * content is still used by Google to improve its products, so only synthetic demo data belongs here.
 */
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

export interface GeminiRequest {
  model: string;
  input: string;
  system_instruction: string;
  store: boolean;
  response_format: { type: "text"; mime_type: "application/json"; schema: Record<string, unknown> };
}
export type GeminiCreate = (req: GeminiRequest) => Promise<{ output_text?: string }>;

/** Thrown for any unusable answer, so callers can fall back. Carries no prompt or response text. */
export class GeminiFailed extends Error {
  constructor(public reason: "no_text" | "not_json" | "schema_mismatch") {
    super(`Gemini failed: ${reason}`);
  }
}

export function realGeminiCreate(apiKey = process.env.GEMINI_API_KEY): GeminiCreate {
  const client = new GoogleGenAI({ apiKey });
  return async (req) => {
    const res = await client.interactions.create(req as never);
    return res as { output_text?: string };
  };
}

/** zod → the plain JSON Schema object the API takes. */
export function toGeminiSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _drop, additionalProperties: _strict, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  return rest;
}

export async function geminiJson<T>(
  create: GeminiCreate,
  args: { system: string; input: string; schema: z.ZodType<T> },
): Promise<T> {
  const res = await create({
    model: GEMINI_MODEL,
    input: args.input,
    system_instruction: args.system,
    store: false,
    response_format: { type: "text", mime_type: "application/json", schema: toGeminiSchema(args.schema) },
  });
  if (!res.output_text) throw new GeminiFailed("no_text");
  let json: unknown;
  try {
    json = JSON.parse(res.output_text);
  } catch {
    throw new GeminiFailed("not_json");
  }
  const parsed = args.schema.safeParse(json);
  if (!parsed.success) throw new GeminiFailed("schema_mismatch");
  return parsed.data;
}
