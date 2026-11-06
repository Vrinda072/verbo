/**
 * Reads text aloud with the browser's own voices (free, no key, nothing leaves the device).
 * Source: MDN SpeechSynthesis, SpeechSynthesisUtterance, voiceschanged (read Nov 6, 2026).
 * Which languages have a voice depends on the device, so callers must cope with "no voice".
 */
export interface VoiceLike {
  lang: string;
  localService?: boolean;
}

/** The best voice for a language: exact tag, then same base language, on-device first. Null if there is none. */
export function pickVoice<V extends VoiceLike>(voices: readonly V[], lang: string): V | null {
  const want = lang.toLowerCase().replace("_", "-");
  const base = want.split("-")[0];
  const same = voices.filter((v) => v.lang.toLowerCase().replace("_", "-").split("-")[0] === base);
  const exact = same.filter((v) => v.lang.toLowerCase().replace("_", "-") === want);
  const pool = exact.length ? exact : same;
  return pool.find((v) => v.localService) ?? pool[0] ?? null;
}
