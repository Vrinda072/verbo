"use client";
/**
 * Records the microphone until the person taps stop (or MAX_RECORDING_MS), then sends the audio to /api/stt/transcribe.
 * Pauses can't cut a sentence short, because nothing is listening for the end of speech. There is deliberately no
 * AudioContext or live waveform here: creating one can freeze the page while the computer opens its audio device.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { MicStatus } from "./useSoniox";
import {
  DEAD_MIC_MESSAGE,
  extensionFor,
  MAX_RECORDING_MS,
  DEAD_MIC_AFTER_MS,
  micErrorMessage,
  pickMimeType,
  recordedPeak,
  SILENCE_PEAK,
  transcribeErrorMessage,
} from "./recorder";

export function useRecorder(language: string) {
  const [status, setStatus] = useState<MicStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timers = useRef<(() => void)[]>([]);
  const discard = useRef(false);

  const release = useCallback(() => {
    timers.current.forEach((cancel) => cancel());
    timers.current = [];
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  useEffect(
    () => () => {
      discard.current = true;
      if (rec.current?.state === "recording") rec.current.stop();
      release();
    },
    [release],
  );

  const fail = useCallback((message: string) => {
    setError(message);
    setStatus("error");
  }, []);

  const send = useCallback(
    async (audio: Blob, mimeType: string) => {
      const form = new FormData();
      form.set("audio", audio, `speech.${extensionFor(mimeType)}`);
      form.set("language", language);
      try {
        const res = await fetch("/api/stt/transcribe", { method: "POST", body: form });
        const body = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
        if (!res.ok || !body.text) return fail(transcribeErrorMessage(body.error));
        setTranscript(body.text);
        setStatus("done");
      } catch {
        fail(transcribeErrorMessage(undefined));
      }
    },
    [fail, language],
  );

  const start = useCallback(async () => {
    const mimeType = typeof MediaRecorder === "undefined" ? null : pickMimeType((t) => MediaRecorder.isTypeSupported(t));
    if (!mimeType || !navigator.mediaDevices?.getUserMedia) return setStatus("unavailable");
    setError(null);
    setTranscript("");
    discard.current = false;
    setStatus("connecting");

    let media: MediaStream;
    try {
      media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (err) {
      return fail(micErrorMessage((err as Error).name));
    }
    stream.current = media;

    const recorder = new MediaRecorder(media, { mimeType });
    rec.current = recorder;
    const chunks: Blob[] = [];
    const cap = setTimeout(() => {
      if (recorder.state === "recording") {
        setStatus("finishing");
        recorder.stop();
      }
    }, MAX_RECORDING_MS);
    const check = setTimeout(async () => {
      if (rec.current !== recorder) return;
      // No data at all is the same failure as pure silence: a stalled system mic can look connected and deliver nothing.
      if (chunks.length && (await recordedPeak(new Blob(chunks, { type: mimeType }))) !== 0) return;
      if (rec.current !== recorder) return;
      // Tear down now rather than in onstop, so tapping again straight away can't have its new recording cleaned up.
      recorder.onstop = null;
      if (recorder.state === "recording") recorder.stop();
      rec.current = null;
      release();
      fail(DEAD_MIC_MESSAGE);
    }, DEAD_MIC_AFTER_MS);
    timers.current = [() => clearTimeout(cap), () => clearTimeout(check)];

    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    recorder.onstop = async () => {
      rec.current = null;
      release();
      if (discard.current) return;
      if (!chunks.length) return fail(DEAD_MIC_MESSAGE);
      const audio = new Blob(chunks, { type: mimeType });
      const peak = await recordedPeak(audio);
      if (peak === 0) return fail(DEAD_MIC_MESSAGE);
      if (peak !== null && peak < SILENCE_PEAK) return fail(transcribeErrorMessage("empty"));
      void send(audio, mimeType);
    };
    recorder.start(250);
    setStatus("listening");
  }, [fail, release, send]);

  const stop = useCallback(() => {
    if (rec.current?.state !== "recording") return;
    setStatus("finishing");
    rec.current.stop();
  }, []);

  return { status, transcript, setTranscript, error, analyser: null as AnalyserNode | null, start, stop };
}
