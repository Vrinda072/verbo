/**
 * ElevenLabs text to speech, server side only.
 * Source: elevenlabs.io/docs/api-reference/text-to-speech/convert and /docs/overview/models (read Nov 11, 2026):
 * POST /v1/text-to-speech/{voice_id}?output_format=mp3_44100_128, header xi-api-key, body { text, model_id, language_code }.
 * eleven_v4_turbo is the low-latency model with 90+ languages, including Telugu and Hindi.
 */
import { log } from "@/lib/log";

const API = "https://api.elevenlabs.io/v1/text-to-speech";
export const VOICE_MODEL = "eleven_v4_turbo";
/** River (relaxed, neutral), chosen by ear on Nov 11, 2026. ELEVENLABS_VOICE_ID overrides it. */
export const DEFAULT_VOICE_ID = "SAz9YHcvj6GT2YYXdXww";

/**
 * A calm delivery for questions about money: steadier than the default (0.5), slightly slower, no added style.
 * Fields from the voice_settings object in the same API reference.
 */
export const VOICE_SETTINGS = { stability: 0.7, similarity_boost: 0.75, style: 0, speed: 0.92 };

const g = globalThis as unknown as { __verboVoiceCache?: Map<string, Buffer> };
const MAX_CACHED = 150;

export class VoiceFailed extends Error {
  constructor(public status: number) {
    super(`ElevenLabs failed (${status})`);
  }
}

/** MP3 for one sentence. Repeats come from memory, so replaying a demo spends no credits. */
export async function synthesize(
  text: string,
  lang: string,
  opts: { apiKey: string; voiceId?: string; fetchImpl?: typeof fetch },
): Promise<Buffer> {
  const voiceId = opts.voiceId || DEFAULT_VOICE_ID;
  const language = lang.split("-")[0];
  const key = JSON.stringify([voiceId, language, text]);
  g.__verboVoiceCache ??= new Map();
  const cached = g.__verboVoiceCache.get(key);
  if (cached) return cached;

  const res = await (opts.fetchImpl ?? fetch)(`${API}/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": opts.apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: VOICE_MODEL, language_code: language, voice_settings: VOICE_SETTINGS }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    log.warn("elevenlabs failed", { status: res.status });
    throw new VoiceFailed(res.status);
  }
  const audio = Buffer.from(await res.arrayBuffer());
  if (g.__verboVoiceCache.size >= MAX_CACHED) g.__verboVoiceCache.delete(g.__verboVoiceCache.keys().next().value as string);
  g.__verboVoiceCache.set(key, audio);
  return audio;
}
