/**
 * Pure helpers for recording the microphone ourselves. The person decides when they have finished, by tapping stop;
 * no speech service can end the sentence for them. Source: MDN MediaRecorder.isTypeSupported, getUserMedia exceptions,
 * OfflineAudioContext.decodeAudioData, AnalyserNode.getFloatTimeDomainData (read Nov 6, 2026).
 */

/** Safety cap on one recording. Far longer than a payment sentence. */
export const MAX_RECORDING_MS = 90_000;
/** A live microphone always carries some noise, so a peak of exactly 0 after this long means no sound is arriving at all. */
export const DEAD_MIC_AFTER_MS = 3_000;
/** Below this peak nothing was said. Speech recognisers can invent words from silence, so it is never sent. */
export const SILENCE_PEAK = 0.01;

const TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

export function pickMimeType(isSupported: (type: string) => boolean): string | null {
  return TYPES.find(isSupported) ?? null;
}

/** File extension for an audio type; the speech service reads the format from the file name. */
export function extensionFor(mimeType: string): string {
  if (mimeType.startsWith("audio/mp4")) return "mp4";
  if (mimeType.startsWith("audio/ogg")) return "ogg";
  return "webm";
}

export const DEAD_MIC_MESSAGE =
  "Your microphone is connected but isn’t sending any sound, so nothing can be heard. On a Mac: open System Settings → Privacy & Security → Microphone and turn on your browser, then quit and reopen it. If that doesn’t help, restart your computer.";

/** Plain words for each documented getUserMedia failure. */
export function micErrorMessage(errorName: string): string {
  switch (errorName) {
    case "NotAllowedError":
    case "SecurityError":
      return "Microphone access is blocked. Allow it for this site in your browser’s settings.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No microphone was found. Connect one, or choose another input in your computer’s sound settings.";
    case "NotReadableError":
    case "AbortError":
      return "Your microphone couldn’t start. Another app may be using it. Close that app and try again.";
    default:
      return "Your microphone couldn’t start.";
  }
}

/** Why a recording produced no text, in plain words. */
export function transcribeErrorMessage(code: string | undefined): string {
  switch (code) {
    case "empty":
      return "No speech was detected. Please try again.";
    case "busy":
      return "The speech service is busy. Wait a moment and try again.";
    case "not_configured":
      return "Speech is not configured on this server.";
    default:
      return "Transcription failed. Please try again or type the payment.";
  }
}

/**
 * Loudest sample in recorded audio, or null if the browser can't decode it. Uses OfflineAudioContext because it never
 * opens an audio device: on Nov 6, 2026 `new AudioContext()` froze the whole page for 10 s on a Mac with stalled audio.
 */
export async function recordedPeak(audio: Blob): Promise<number | null> {
  try {
    const decoded = await new OfflineAudioContext(1, 1, 48_000).decodeAudioData(await audio.arrayBuffer());
    let peak = 0;
    for (let c = 0; c < decoded.numberOfChannels; c++) {
      for (const v of decoded.getChannelData(c)) peak = Math.max(peak, Math.abs(v));
    }
    return peak;
  } catch {
    return null;
  }
}

/** Calls `onDead` if no sound at all arrives. Returns a function that cancels the check. */
export function watchForDeadMic(analyser: AnalyserNode, onDead: () => void, afterMs = DEAD_MIC_AFTER_MS): () => void {
  const buf = new Float32Array(analyser.fftSize);
  const started = Date.now();
  const timer = setInterval(() => {
    analyser.getFloatTimeDomainData(buf);
    if (buf.some((v) => v !== 0)) clearInterval(timer);
    else if (Date.now() - started >= afterMs) {
      clearInterval(timer);
      onDead();
    }
  }, 100);
  return () => clearInterval(timer);
}
