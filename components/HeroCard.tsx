"use client";
import { useEffect, useState } from "react";
import { labelsFor, LANGUAGES } from "@/lib/bridge/readback";

const READBACK_LANGUAGES = LANGUAGES.filter((l) => !labelsFor(l.code).fallback);
const VARS = { amount: "$50.00", recipient: "Manuel Lopes", other: "Manuel Lopez" };

/** An example of the real read-back card, cycling through every language that has written templates. */
export function HeroCard() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((n) => (n + 1) % READBACK_LANGUAGES.length), 2800);
    return () => clearInterval(t);
  }, []);
  const lang = READBACK_LANGUAGES[i];
  const L = labelsFor(lang.code);

  return (
    <figure aria-label="Example of the read-back card" className="relative">
      <div className="rounded-v-lg border border-line bg-card p-6 shadow-v-lg sm:p-8">
        <div className="flex items-center justify-between gap-3 text-sm font-bold text-ink-3">
          <span>{lang.englishName}</span>
          <span aria-hidden className="flex gap-1">
            {READBACK_LANGUAGES.map((l, n) => (
              <span key={l.code} className={`h-1.5 w-1.5 rounded-full ${n === i ? "bg-evergreen" : "bg-line-strong"}`} />
            ))}
          </span>
        </div>
        <div key={lang.code} lang={L.usedLang} dir={L.dir} className="v-rise">
          <p className="mt-4 min-h-[4rem] text-xl font-bold leading-snug sm:text-2xl">{L.t("readback", VARS)}</p>
        </div>
        <p className="v-digits mt-4">
          $50<span className="text-ink-3">.00</span>
        </p>
        <div key={`${lang.code}-w`} lang={L.usedLang} dir={L.dir} className="v-rise mt-5 min-h-[6rem] rounded-v border border-marigold/70 bg-marigold-soft p-4 font-bold text-marigold-ink">
          {L.t("lookalike", VARS)}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3" lang={L.usedLang} dir={L.dir}>
          <span className="flex min-h-14 items-center justify-center rounded-v border-2 border-line-strong px-3 text-center font-bold">{L.t("cancel")}</span>
          <span className="flex min-h-14 items-center justify-center rounded-v bg-evergreen px-3 text-center font-bold text-evergreen-ink">{L.t("confirm")}</span>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-sm text-ink-3">Example with simulated people. Translations are machine-made and not yet reviewed.</figcaption>
    </figure>
  );
}
