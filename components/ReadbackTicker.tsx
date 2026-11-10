"use client";
import { useEffect, useState } from "react";
import { labelsFor, LANGUAGES } from "@/lib/bridge/readback";

const READBACK_LANGUAGES = LANGUAGES.filter((l) => !labelsFor(l.code).fallback);
const VARS = { amount: "$50.00", recipient: "Manuel Lopes" };

/** The real read-back sentence, cycling through every language with a written template. */
export function ReadbackTicker() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((n) => (n + 1) % READBACK_LANGUAGES.length), 2600);
    return () => clearInterval(t);
  }, []);
  const lang = READBACK_LANGUAGES[i];
  const L = labelsFor(lang.code);
  return (
    <figure aria-label="Example of a read-back" className="rounded-v-lg bg-navy-2 p-5">
      <figcaption className="flex items-center justify-between text-sm text-navy-ink/75">
        <span>Read back in {lang.englishName}</span>
        <span>Example</span>
      </figcaption>
      <p key={lang.code} lang={L.usedLang} dir={L.dir} className="v-rise mt-2 min-h-[4.5rem] text-xl font-medium leading-snug sm:text-2xl">
        {L.t("readback", VARS)}
      </p>
    </figure>
  );
}
