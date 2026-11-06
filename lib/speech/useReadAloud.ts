"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { pickVoice } from "./speak";

/** Speaks `text` in `lang` when asked. `available` stays false when this device has no voice for the language. */
export function useReadAloud(text: string, lang: string) {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const textRef = useRef(text);
  textRef.current = text;

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

  const play = useCallback(() => {
    if (!voice) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(textRef.current);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = 0.95;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(u);
  }, [voice]);

  return { available: Boolean(voice), speaking, play };
}
