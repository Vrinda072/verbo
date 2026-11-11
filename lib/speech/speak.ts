/**
 * Reads text aloud with the browser's own voices (free, no key, nothing leaves the device).
 * Source: MDN SpeechSynthesis, SpeechSynthesisUtterance, voiceschanged (read Nov 6, 2026).
 * Which languages have a voice depends on the device, so callers must cope with "no voice".
 */
export interface VoiceLike {
  name?: string;
  lang: string;
  localService?: boolean;
}

/** macOS lists joke voices alphabetically alongside real ones, so "first on-device voice" can be Albert or Bad News. */
const NOVELTY = /^(albert|bad news|bahh|bells|boing|bubbles|cellos|wobble|fred|good news|jester|junior|kathy|organ|ralph|superstar|trinoids|whisper|zarvox|eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley)\b/i;
const NATURAL = /^(samantha|ava|allison|susan|zoe|lekha|luciana|joana|monica|paulina|majed|maged)\b/i;

function voiceScore(v: VoiceLike): number {
  const name = v.name ?? "";
  const quality = /premium/i.test(name) ? 5 : /enhanced/i.test(name) ? 4 : NOVELTY.test(name) ? 0 : NATURAL.test(name) ? 3 : 2;
  return quality + (v.localService ? 0.5 : 0);
}

/** The best voice for a language: exact tag, then same base language, on-device first. Null if there is none. */
export function pickVoice<V extends VoiceLike>(voices: readonly V[], lang: string): V | null {
  const want = lang.toLowerCase().replace("_", "-");
  const base = want.split("-")[0];
  const same = voices.filter((v) => v.lang.toLowerCase().replace("_", "-").split("-")[0] === base);
  const exact = same.filter((v) => v.lang.toLowerCase().replace("_", "-") === want);
  const pool = exact.length ? exact : same;
  return pool.reduce<V | null>((best, v) => (!best || voiceScore(v) > voiceScore(best) ? v : best), null);
}
