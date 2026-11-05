"use client";
/**
 * Browser microphone → Soniox real-time STT. Mints a temporary key via /api/stt/token,
 * streams MediaRecorder chunks (audio_format "auto"), and exposes the live transcript and an AnalyserNode
 * for the waveform. If speech isn't available, `status` becomes "unavailable" and the UI offers typing.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { buildConfig, SONIOX_AUTH_PROTOCOL, SONIOX_WS_URL, TranscriptAccumulator, type SonioxResponse } from "./soniox";

export type MicStatus = "idle" | "connecting" | "listening" | "finishing" | "done" | "unavailable" | "error";

export function useSoniox(language: string, terms: string[] = []) {
  const [status, setStatus] = useState<MicStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const acc = useRef(new TranscriptAccumulator());

  const cleanup = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    void ctx.current?.close().catch(() => {});
    ctx.current = null;
    setAnalyser(null);
  }, []);

  useEffect(() => () => {
    ws.current?.close();
    cleanup();
  }, [cleanup]);

  const start = useCallback(async () => {
    setError(null);
    setTranscript("");
    acc.current = new TranscriptAccumulator();
    setStatus("connecting");
    try {
      const tokenRes = await fetch("/api/stt/token", { method: "POST" });
      const token = (await tokenRes.json()) as { available: boolean; apiKey?: string };
      if (!token.available || !token.apiKey) {
        setStatus("unavailable");
        return;
      }
      const media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      stream.current = media;
      const audioCtx = new AudioContext();
      ctx.current = audioCtx;
      const node = audioCtx.createAnalyser();
      node.fftSize = 1024;
      audioCtx.createMediaStreamSource(media).connect(node);
      setAnalyser(node);

      const socket = new WebSocket(SONIOX_WS_URL, [SONIOX_AUTH_PROTOCOL, token.apiKey]);
      ws.current = socket;
      socket.onopen = () => {
        socket.send(JSON.stringify(buildConfig({ language, audio: { audio_format: "auto" }, terms })));
        const recorder = new MediaRecorder(media);
        rec.current = recorder;
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0 && socket.readyState === WebSocket.OPEN) socket.send(e.data);
        };
        recorder.onstop = () => {
          if (socket.readyState === WebSocket.OPEN) socket.send(""); // end of stream
        };
        recorder.start(250);
        setStatus("listening");
      };
      socket.onmessage = (ev) => {
        const res = JSON.parse(String(ev.data)) as SonioxResponse;
        if (res.error_code) {
          setError(res.error_code === 402 ? "Speech service is out of credit." : res.error_message ?? "Speech error");
          setStatus("error");
          cleanup();
          return;
        }
        acc.current.push(res);
        setTranscript(acc.current.live);
        if (res.finished) {
          setTranscript(acc.current.final);
          setStatus("done");
          socket.close();
        }
      };
      socket.onerror = () => {
        setError("Could not reach the speech service.");
        setStatus("error");
        cleanup();
      };
    } catch (e) {
      const name = (e as DOMException).name;
      setError(name === "NotAllowedError" ? "Microphone permission was denied." : "Could not start the microphone.");
      setStatus("error");
      cleanup();
    }
  }, [language, terms, cleanup]);

  const stop = useCallback(() => {
    if (rec.current?.state === "recording") rec.current.stop();
    setStatus("finishing");
    cleanup();
  }, [cleanup]);

  return { status, transcript, setTranscript, error, analyser, start, stop };
}
