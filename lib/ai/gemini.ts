/**
 * Gemini client for typed JSON. It only fills fields or translates text; code decides money.
 * Source: aistudio.google.com/docs/structured-output, /docs/models (read Nov 6, 2026) and @google/genai 3.0.0 genai.d.ts:
 * client.interactions.create({ model, input, system_instruction, response_format, store }) → interaction.output_text.
 * gemini-3.6-flash is marked Stable and listed with a free tier. store:false: not kept for later retrieval. Free-tier
 * content is still used by Google to improve its products, so only synthetic demo data belongs here.
 * Free quota is small and per model (the API answered "limit: 20 requests per day on Free Tier" for gemini-3.6-flash on
 * Nov 6, 2026), so requests walk a list of models, skip any at quota until its stated retry time, and reuse answers.
 */
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

/** Tried in order. GEMINI_MODEL pins one model, which the eval uses to test a model on its own. */
export const GEMINI_MODELS = process.env.GEMINI_MODEL
  ? [process.env.GEMINI_MODEL]
  : ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];

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
  constructor(public reason: "no_text" | "not_json" | "schema_mismatch" | "quota" | "unavailable") {
    super(`Gemini failed: ${reason}`);
  }
}

/** One attempt on one model. No SDK retries: `withModelFallback` moves to the next model, so a speaker never waits long. */
function directCreate(apiKey = process.env.GEMINI_API_KEY): GeminiCreate {
  const client = new GoogleGenAI({ apiKey });
  return async (req) => {
    const res = await client.interactions.create(req as never, { maxRetries: 0, timeout: 20_000 } as never);
    return res as { output_text?: string };
  };
}

/** "Please retry in 21h1m48s" → milliseconds. A minute if the API doesn't say. */
export function retryAfterMs(message: string): number {
  const m = /retry in (?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?/i.exec(message);
  const ms = m ? (Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)) * 1000 : 0;
  return ms || 60_000;
}

export interface FallbackState {
  /** Model → the time it may be tried again. */
  blockedUntil: Map<string, number>;
  /** Same request → same answer, so repeating a sentence in a demo costs no quota. In memory only. */
  answers: Map<string, { output_text?: string }>;
}
const MAX_ANSWERS = 200;
export const newFallbackState = (): FallbackState => ({ blockedUntil: new Map(), answers: new Map() });

const isJson = (text?: string) => {
  try {
    return text !== undefined && (JSON.parse(text), true);
  } catch {
    return false;
  }
};

/**
 * Tries each model in turn. 429 parks that model until its retry time; 503 or a timeout just moves on. Any other error
 * is thrown for the caller's own fallback. Ends in GeminiFailed("quota") when every model is parked, without a network call.
 */
export function withModelFallback(
  base: GeminiCreate,
  models: string[] = GEMINI_MODELS,
  state: FallbackState = newFallbackState(),
  now: () => number = Date.now,
): GeminiCreate {
  return async (req) => {
    const key = JSON.stringify([req.system_instruction, req.input]);
    const known = state.answers.get(key);
    if (known) return known;
    let sawOutage = false;
    for (const model of models) {
      if ((state.blockedUntil.get(model) ?? 0) > now()) continue;
      try {
        const res = await base({ ...req, model });
        if (isJson(res.output_text)) {
          if (state.answers.size >= MAX_ANSWERS) state.answers.delete(state.answers.keys().next().value as string);
          state.answers.set(key, res);
        }
        return res;
      } catch (err) {
        const { status, name, message } = err as { status?: number; name?: string; message?: string };
        if (status === 429) state.blockedUntil.set(model, now() + retryAfterMs(message ?? ""));
        else if (status === 503 || status === 500 || /timeout|abort/i.test(`${name} ${message}`)) sawOutage = true;
        else throw err;
      }
    }
    throw new GeminiFailed(sawOutage ? "unavailable" : "quota");
  };
}

// Shared across Next.js route bundles, so one route learning a model is at quota saves the others a wasted call.
const g = globalThis as unknown as { __verboGemini?: FallbackState };

export function realGeminiCreate(apiKey?: string): GeminiCreate {
  g.__verboGemini ??= newFallbackState();
  return withModelFallback(directCreate(apiKey), GEMINI_MODELS, g.__verboGemini);
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
    model: GEMINI_MODELS[0],
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
