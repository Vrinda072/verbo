"use client";
/**
 * The microphone for the Send screen. "recorder": we record until the person taps stop, then Whisper writes it down.
 * "browser": the browser's built-in recognition, which can end on its own. "soniox": needs paid credit.
 * Falls back to Soniox when the browser has neither recording nor recognition.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useSoniox, type MicStatus } from "./useSoniox";
import { useRecorder } from "./useRecorder";
import { DEAD_MIC_MESSAGE, watchForDeadMic } from "./recorder";
import {
  collectTranscript,
  speechErrorMessage,
  speechLocale,
  speechRecognitionCtor,
  type SpeechRecognitionLike,
} from "./browser";

export type SpeechProvider = "recorder" | "browser" | "soniox";

function useBrowserSpeech(language: string) {
  const [status, setStatus] = useState<MicStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const rec = useRef<SpeechRecognitionLike | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const heard = useRef("");
  const failed = useRef(false);
  const cancelDeadCheck = useRef<(() => void) | null>(null);

  const stopMeter = useCallback(() => {
    cancelDeadCheck.current?.();
    cancelDeadCheck.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    void ctx.current?.close().catch(() => {});
    ctx.current = null;
    setAnalyser(null);
  }, []);

  useEffect(
    () => () => {
      rec.current?.abort();
      stopMeter();
    },
    [stopMeter],
  );

  /** Waveform only, so it must never block listening. Skipped on touch devices, where it can steal the mic. */
  const startMeter = useCallback(async () => {
    if (window.matchMedia?.("(pointer: coarse)").matches) return;
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      const audioCtx = new AudioContext();
      ctx.current = audioCtx;
      const node = audioCtx.createAnalyser();
      node.fftSize = 1024;
      audioCtx.createMediaStreamSource(media).connect(node);
      setAnalyser(node);
      cancelDeadCheck.current = watchForDeadMic(node, () => {
        failed.current = true;
        setError(DEAD_MIC_MESSAGE);
        setStatus("error");
        rec.current?.abort();
      });
    } catch {
      // No waveform. Recognition reports its own permission errors.
    }
  }, []);

  const start = useCallback(async () => {
    const Ctor = speechRecognitionCtor(window);
    if (!Ctor) {
      setStatus("unavailable");
      return;
    }
    setError(null);
    setTranscript("");
    heard.current = "";
    failed.current = false;
    setStatus("connecting");
    await startMeter();

    const r = new Ctor();
    r.lang = speechLocale(language, navigator.languages ?? []);
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      heard.current = collectTranscript(e.results);
      setTranscript(heard.current);
      setStatus((s) => (s === "connecting" ? "listening" : s));
    };
    r.onerror = (e) => {
      const message = speechErrorMessage(e.error);
      if (!message) return;
      // A pause after real words is not a failure: keep what was heard.
      if (e.error === "no-speech" && heard.current) return;
      failed.current = true;
      setError(message);
      setStatus("error");
    };
    r.onend = () => {
      rec.current = null;
      stopMeter();
      if (failed.current) return;
      if (heard.current) setStatus("done");
      else {
        setError(speechErrorMessage("no-speech"));
        setStatus("error");
      }
    };
    rec.current = r;
    try {
      r.start();
      setStatus("listening");
    } catch {
      setError(speechErrorMessage("other"));
      setStatus("error");
      stopMeter();
    }
  }, [language, startMeter, stopMeter]);

  const stop = useCallback(() => {
    setStatus("finishing");
    rec.current?.stop();
  }, []);

  return { status, transcript, setTranscript, error, analyser, start, stop };
}

export function useSpeech(provider: SpeechProvider, language: string, terms: string[]) {
  const [browserSupported, setBrowserSupported] = useState(true);
  useEffect(() => setBrowserSupported(Boolean(speechRecognitionCtor(window))), []);
  const browser = useBrowserSpeech(language);
  const soniox = useSoniox(language, terms);
  const recorder = useRecorder(language);
  if (provider === "recorder") return recorder;
  return provider === "browser" && browserSupported ? browser : soniox;
}
