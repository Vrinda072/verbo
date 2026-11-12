"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { pickVoice } from "./speak";
import type { SpokenPart } from "./spoken";

/** null until the first answer; false once the server says no cloud voice is set up, so later sentences go straight to the browser. */
let cloudVoice: boolean | null = null;
const clips = new Map<string, Promise<string | null>>();

function fetchClip(parts: SpokenPart[], lang: string): Promise<string | null> {
  const key = JSON.stringify([lang, parts]);
  let clip = clips.get(key);
  if (!clip) {
    clip = fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lang, parts }) })
      .then(async (r) => {
        if (r.status === 404) cloudVoice = false;
        if (!r.ok) return null;
        cloudVoice = true;
        return URL.createObjectURL(await r.blob());
      })
      .catch(() => null);
    clip.then((url) => !url && clips.delete(key));
    clips.set(key, clip);
  }
  return clip;
}

/**
 * Speaks `text` in `lang`. With `parts`, it first tries the ElevenLabs voice for the same fixed sentence, and falls back to
 * the browser's own voice. `available` is false only when neither can speak.
 */
export function useReadAloud(text: string, lang: string, parts?: SpokenPart[]) {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const textRef = useRef(text);
  textRef.current = text;
  const partsKey = parts?.length ? JSON.stringify(parts) : "";
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const synth = window.speechSynthesis;
    const load = () => setVoice(pickVoice(synth.getVoices(), lang));
    load();
    synth.addEventListener("voiceschanged", load);
    return () => {
      synth.removeEventListener("voiceschanged", load);
      synth.cancel();
    };
  }, [lang]);

  // Start fetching as soon as the sentence is known, so it is ready when it is played.
  useEffect(() => {
    if (partsKey && cloudVoice !== false) void fetchClip(JSON.parse(partsKey), lang);
  }, [partsKey, lang]);

  useEffect(() => () => audio.current?.pause(), []);

  const browserSay = useCallback(
    (onEnd?: () => void) => {
      if (!voice) return onEnd?.();
      const synth = window.speechSynthesis;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(textRef.current);
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = 0.95;
      const finished = () => {
        setSpeaking(false);
        onEnd?.();
      };
      u.onend = finished;
      u.onerror = finished;
      setSpeaking(true);
      synth.speak(u);
    },
    [voice],
  );

  const play = useCallback(
    async (onEnd?: () => void) => {
      audio.current?.pause();
      window.speechSynthesis?.cancel();
      const url = partsKey && cloudVoice !== false ? await fetchClip(JSON.parse(partsKey), lang) : null;
      if (!url) return browserSay(onEnd);
      const a = new Audio(url);
      audio.current = a;
      let done = false;
      const finished = () => {
        if (done) return;
        done = true;
        setSpeaking(false);
        onEnd?.();
      };
      a.onended = finished;
      a.onerror = finished;
      setSpeaking(true);
      await a.play().catch(() => {
        // Playback refused (for example, no tap on the page yet): use the browser voice instead.
        done = true;
        setSpeaking(false);
        browserSay(onEnd);
      });
    },
    [partsKey, lang, browserSay],
  );

  return { available: Boolean(voice) || (Boolean(partsKey) && cloudVoice !== false), speaking, play };
}
