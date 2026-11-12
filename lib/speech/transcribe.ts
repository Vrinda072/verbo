/**
 * Recorded audio → text with Whisper on Groq. Runs on the server so the key never reaches the browser.
 * Source: console.groq.com/docs/speech-to-text (read Nov 6, 2026): POST /openai/v1/audio/transcriptions with multipart
 * fields file, model, language (optional ISO-639-1), prompt (optional, 224 tokens, guides spelling), response_format,
 * temperature; webm, ogg, mp4 and m4a accepted; 25 MB on the free tier.
 * No `prompt` of contact names: tested Nov 6, 2026 with synthetic audio, it made Whisper write Latin names into other
 * scripts and invent contact names in Chinese. Without it, Japanese, Korean and Hindi came back in their own scripts.
 * Gemini's audio models are not a backup: on Nov 6, 2026 our free key got 503s or 20-a-day limits, and the answers it did
 * give invented words. A wrong name is worse than asking the person to type.
 */
const GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
export const GROQ_MODEL = process.env.GROQ_STT_MODEL || "whisper-large-v3-turbo";

export type TranscribeError = "not_configured" | "busy" | "empty" | "failed";

/**
 * Why a call failed, safe to log: the HTTP status, or the network error's name and code. Never the error message, because
 * Node's message for a malformed header quotes the header, which here is the API key.
 */
export interface TranscribeDetail {
  status?: number;
  error?: string;
}

export class TranscribeFailed extends Error {
  constructor(
    public code: TranscribeError,
    public detail: TranscribeDetail = {},
  ) {
    super(`Transcription failed: ${code}`);
  }
}

function networkError(err: unknown): string {
  const e = err as { name?: string; cause?: { code?: string; name?: string } };
  return [e?.name, e?.cause?.code ?? e?.cause?.name].filter(Boolean).join(" ") || "unknown";
}

export interface TranscribeInput {
  audio: Blob;
  fileName: string;
  /** Language the person chose, as a BCP-47 tag. A hint: it improves accuracy, and is dropped if the service rejects it. */
  language: string;
}

export async function transcribe(
  { audio, fileName, language }: TranscribeInput,
  fetcher: typeof fetch = fetch,
  rawKey = process.env.GROQ_API_KEY,
): Promise<string> {
  // A key pasted into a hosting dashboard can pick up a newline or spaces, which makes the request header invalid.
  const apiKey = rawKey?.trim();
  if (!apiKey) throw new TranscribeFailed("not_configured");

  const attempt = (withLanguage: boolean) => {
    const form = new FormData();
    form.set("file", audio, fileName);
    form.set("model", GROQ_MODEL);
    form.set("temperature", "0");
    form.set("response_format", "json");
    if (withLanguage) form.set("language", language.split("-")[0]);
    return fetcher(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
  };

  let res: Response;
  try {
    res = await attempt(true);
    // A language code Whisper doesn't know shouldn't stop the person: let it detect the language instead.
    if (res.status === 400) res = await attempt(false);
  } catch (err) {
    throw new TranscribeFailed("busy", { error: networkError(err) });
  }
  if (res.status === 429 || res.status >= 500) throw new TranscribeFailed("busy", { status: res.status });
  if (!res.ok) throw new TranscribeFailed("failed", { status: res.status });
  const body = (await res.json().catch(() => ({}))) as { text?: string };
  const text = body.text?.replace(/\s+/g, " ").trim();
  if (!text) throw new TranscribeFailed("empty");
  return text;
}
