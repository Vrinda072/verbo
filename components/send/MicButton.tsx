"use client";
import { useEffect, useRef } from "react";
import type { MicStatus } from "@/lib/speech/useSoniox";

/** The big microphone with a live ring + waveform driven by an AnalyserNode. */
export function MicButton({
  status,
  analyser,
  onStart,
  onStop,
}: {
  status: MicStatus;
  analyser: AnalyserNode | null;
  onStart: () => void;
  onStop: () => void;
}) {
  const listening = status === "listening";
  const busy = status === "connecting" || status === "finishing";
  const label = listening ? "Stop and check" : busy ? (status === "connecting" ? "Connecting…" : "Finishing…") : "Tap and speak";

  return (
    <div className="flex flex-col items-center gap-5">
      <button
        type="button"
        onClick={listening ? onStop : onStart}
        disabled={busy}
        aria-pressed={listening}
        aria-label={label}
        className={`relative grid h-36 w-36 place-items-center rounded-full shadow-v-lg transition-transform duration-200 focus-visible:outline-offset-8 disabled:opacity-70 sm:h-44 sm:w-44 ${
          listening ? "bg-terracotta text-paper" : "bg-evergreen text-evergreen-ink hover:scale-[1.03]"
        }`}
      >
        {listening && <span aria-hidden className="v-pulse absolute inset-0 rounded-full border-4 border-terracotta" />}
        {listening ? <StopIcon /> : <MicIcon />}
      </button>
      <p className="text-xl font-bold" aria-live="polite">
        {label}
      </p>
      <Waveform analyser={analyser} active={listening} />
    </div>
  );
}

function Waveform({ analyser, active }: { analyser: AnalyserNode | null; active: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const g = c.getContext("2d")!;
    const color = getComputedStyle(document.documentElement).getPropertyValue("--v-evergreen").trim() || "currentColor";
    const muted = getComputedStyle(document.documentElement).getPropertyValue("--v-line-strong").trim() || "currentColor";
    const data = new Uint8Array(analyser?.frequencyBinCount ?? 0);
    const bars = 40;
    let raf = 0;
    const draw = () => {
      const { width, height } = c;
      g.clearRect(0, 0, width, height);
      if (analyser && active) analyser.getByteFrequencyData(data);
      const w = width / bars;
      for (let i = 0; i < bars; i++) {
        const v = analyser && active ? data[Math.floor((i / bars) * data.length * 0.6)] / 255 : 0.06;
        const h = Math.max(4, v * height);
        g.fillStyle = active ? color : muted;
        g.beginPath();
        g.roundRect(i * w + w * 0.2, (height - h) / 2, w * 0.6, h, 3);
        g.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [analyser, active]);
  return <canvas ref={canvas} width={320} height={56} aria-hidden className="h-14 w-full max-w-xs" />;
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-16 w-16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}
function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-14 w-14" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2.5" />
    </svg>
  );
}
