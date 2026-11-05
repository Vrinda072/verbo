/**
 * Soniox real-time STT protocol, shared by the browser hook and the Node spike script.
 * Source: docs.soniox.com/stt/api-reference/websocket-api, /authentication/websocket-authentication,
 * /stt/rt/connection-keepalive, /stt/api-reference/auth/create_temporary_api_key (read Nov 5, 2026).
 *  - URL wss://stt-rt.soniox.com/transcribe-websocket
 *  - auth: protocols ["soniox-api-key", <temporary key>] (browsers can't set headers); `api_key` in the start message is deprecated
 *  - first text frame = JSON config; then binary audio frames; empty text frame ends the stream
 *  - responses: { tokens[{text,is_final,language,...}], finished?: true } or { error_code, error_message, ... }
 *  - keepalive: {"type":"keepalive"} at least every 40 s
 */

export const SONIOX_WS_URL = "wss://stt-rt.soniox.com/transcribe-websocket";
export const SONIOX_TEMP_KEY_URL = "https://api.soniox.com/v1/auth/temporary-api-key";
export const SONIOX_RT_MODEL = "stt-rt-v6";
export const SONIOX_AUTH_PROTOCOL = "soniox-api-key";

export type AudioFormat =
  | { audio_format: "auto" }
  | { audio_format: "pcm_s16le"; sample_rate: number; num_channels: number };

export interface SonioxConfig {
  model: string;
  audio_format: string;
  sample_rate?: number;
  num_channels?: number;
  language_hints?: string[];
  enable_language_identification?: boolean;
  enable_endpoint_detection?: boolean;
  context?: { terms?: string[]; general?: { key: string; value: string }[] };
}

export function buildConfig(opts: { language?: string; audio: AudioFormat; terms?: string[] }): SonioxConfig {
  return {
    model: SONIOX_RT_MODEL,
    ...opts.audio,
    language_hints: opts.language ? [opts.language.split("-")[0]] : undefined,
    enable_language_identification: true,
    enable_endpoint_detection: true,
    context: opts.terms?.length ? { terms: opts.terms } : undefined,
  };
}

export interface SonioxToken {
  text: string;
  is_final?: boolean;
  language?: string;
  confidence?: number;
  translation_status?: "none" | "original" | "translation";
}

export interface SonioxResponse {
  tokens?: SonioxToken[];
  finished?: boolean;
  error_code?: number;
  error_type?: string;
  error_message?: string;
}

/** Accumulates final tokens; non-final tokens are replaced on every response (they may change). */
export class TranscriptAccumulator {
  private finalText = "";
  private interim = "";
  private langCounts = new Map<string, number>();

  push(res: SonioxResponse): void {
    this.interim = "";
    for (const t of res.tokens ?? []) {
      if (t.translation_status === "translation") continue;
      if (t.text === "<end>") continue; // endpoint marker
      if (t.is_final) {
        this.finalText += t.text;
        if (t.language) this.langCounts.set(t.language, (this.langCounts.get(t.language) ?? 0) + t.text.length);
      } else this.interim += t.text;
    }
  }

  get final(): string {
    return this.finalText.trim();
  }
  get live(): string {
    return (this.finalText + this.interim).trim();
  }
  /** Most-spoken language by characters of final text. */
  get detectedLanguage(): string | undefined {
    return [...this.langCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  }
}

/** Server-side: mint a short-lived single-use key for one browser session. Never returns the project key. */
export async function mintTemporaryKey(projectKey: string, seconds = 300): Promise<{ apiKey: string; expiresAt: string }> {
  const res = await fetch(SONIOX_TEMP_KEY_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${projectKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      usage_type: "transcribe_websocket",
      expires_in_seconds: seconds,
      single_use: true,
      max_session_duration_seconds: seconds,
    }),
  });
  if (!res.ok) throw new Error(`Soniox temporary key failed: HTTP ${res.status}`);
  const body = (await res.json()) as { api_key: string; expires_at: string };
  return { apiKey: body.api_key, expiresAt: body.expires_at };
}
