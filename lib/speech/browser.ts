/**
 * Pure helpers for the browser's built-in speech recognition (free, no API key).
 * Source: MDN SpeechRecognition, SpeechRecognitionErrorEvent.error, "Using the Web Speech API" (read Nov 6, 2026):
 *  - constructor: window.SpeechRecognition || window.webkitSpeechRecognition
 *  - lang, continuous, interimResults; start(), stop(), abort(); result, error, end events
 *  - which languages work is browser-dependent and cannot be queried; Chrome sends audio to a web service
 */

export interface SpeechResultLike {
  isFinal: boolean;
  length: number;
  [i: number]: { transcript: string };
}
export interface SpeechResultListLike {
  length: number;
  [i: number]: SpeechResultLike;
}

export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: SpeechResultListLike }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

export type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export function speechRecognitionCtor(w: unknown): SpeechRecognitionCtor | null {
  const g = w as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor } | undefined;
  return g?.SpeechRecognition ?? g?.webkitSpeechRecognition ?? null;
}

/** All results so far, final and interim, as one string. */
export function collectTranscript(results: SpeechResultListLike): string {
  let out = "";
  for (let i = 0; i < results.length; i++) out += results[i][0]?.transcript ?? "";
  return out.replace(/\s+/g, " ").trim();
}

/**
 * Picks the tag to listen with: the browser's own regional variant when it is the same language (es-MX for a
 * Mexican browser), otherwise the language's likely region from Intl (te → te-IN). No hardcoded language list.
 */
export function speechLocale(code: string, browserLanguages: readonly string[] = []): string {
  const base = code.split("-")[0];
  const own = browserLanguages.find((l) => l.split("-")[0] === base && l.includes("-"));
  if (own) return own;
  try {
    const m = new Intl.Locale(base).maximize();
    return m.region ? `${m.language}-${m.region}` : base;
  } catch {
    return base;
  }
}

/** Plain words for each documented error. "aborted" is what we cause ourselves, so it stays silent. */
export function speechErrorMessage(error: string): string | null {
  switch (error) {
    case "aborted":
      return null;
    case "no-speech":
      return "No speech was detected. Please try again.";
    case "audio-capture":
      return "No working microphone was found.";
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access is blocked. Allow it for this site in your browser’s settings.";
    case "language-not-supported":
      return "Your browser can’t listen in this language.";
    case "network":
      return "Your browser’s speech service couldn’t be reached.";
    default:
      return "Speech recognition stopped unexpectedly.";
  }
}
