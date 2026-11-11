"use client";
import { useState } from "react";

/** The three language mistakes Verbo guards against, each tied to a real check in the app. */
const TRAPS = [
  {
    id: "names",
    label: "Names that sound alike",
    hint: "Lopez or Lopes",
    figure: [
      { lang: "en", a: "Lope", mark: "z", note: "paid before", strong: true },
      { lang: "en", a: "Lope", mark: "s", note: "never paid", strong: false },
    ],
    figureLabel: "Lopez and Lopes differ only in the last letter",
    saidLang: "hi",
    said: "मैनुअल लोपेज़ को 40 डॉलर भेज दो",
    saidEnglish: "Send 40 dollars to Manuel Lopez",
    risk: "Spoken aloud, the two names are identical. If speech chose the person, $40 could go to a stranger who speaks Portuguese.",
    fix: "Verbo never lets speech choose the person. It asks aloud: say one for Lopez, spelled with Z, who you have paid before, or two for Lopes, spelled with S, who you have never paid.",
  },
  {
    id: "numbers",
    label: "Numbers said as words",
    hint: "sesenta or setenta",
    figure: [
      { lang: "es", a: "se", mark: "s", rest: "enta", note: "60", strong: true },
      { lang: "es", a: "se", mark: "t", rest: "enta", note: "70", strong: false },
    ],
    figureLabel: "Sesenta and setenta differ by one letter and mean 60 and 70",
    saidLang: "es",
    said: "Envía sesenta dólares a Ana Souza",
    saidEnglish: "Send sixty dollars to Ana Souza",
    risk: "In a noisy room, sixty and seventy are one sound apart. The wrong amount could be sent without anyone noticing.",
    fix: "When an amount is spoken as a word, Verbo shows the number and asks you to type it in digits before anything is sent. Code compares the two.",
  },
  {
    id: "currency",
    label: "Currency words",
    hint: "rupees or dollars",
    figure: [
      { lang: "en", a: "₹500", mark: "", note: "what was said", strong: true },
      { lang: "en", a: "$500", mark: "", note: "not the same", strong: false },
    ],
    figureLabel: "Five hundred rupees is not five hundred dollars",
    saidLang: "hi",
    said: "किरण को 500 रुपये भेजो",
    saidEnglish: "Send 500 rupees to Kiran",
    risk: "If the currency word were dropped, ₹500 would become $500, far more than was meant.",
    fix: "Code reads currency words itself in every language. This demo sends US dollars only, so Verbo stops and says so instead of converting quietly.",
  },
] as const;

export function TrapExplorer() {
  const [id, setId] = useState<(typeof TRAPS)[number]["id"]>("names");
  const t = TRAPS.find((x) => x.id === id)!;
  return (
    <section aria-labelledby="traps" className="flex flex-col gap-8">
      <div className="flex max-w-3xl flex-col gap-4">
        <h1 id="traps" className="text-5xl font-bold leading-[1.02] tracking-tight sm:text-6xl">
          Three ways money gets lost in translation
        </h1>
        <p className="text-lg leading-relaxed text-ink-2">
          Pick one to see what was said, what could have gone wrong, and what Verbo does instead.
        </p>
      </div>

      <div role="tablist" aria-label="Kinds of mistake" className="flex flex-wrap gap-2.5">
        {TRAPS.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={x.id === id}
            aria-controls="trap-panel"
            onClick={() => setId(x.id)}
            className={`min-w-56 rounded-v-lg px-5 py-3.5 text-left transition-colors ${
              x.id === id ? "bg-navy text-navy-ink" : "bg-card shadow-v hover:bg-brand-soft"
            }`}
          >
            <span className="block text-lg font-semibold">{x.label}</span>
            <span className={`block text-sm ${x.id === id ? "text-navy-ink/75" : "text-ink-3"}`}>{x.hint}</span>
          </button>
        ))}
      </div>

      <div id="trap-panel" role="tabpanel" aria-live="polite" className="grid items-center gap-10 rounded-[32px] bg-navy p-8 text-navy-ink sm:p-12 lg:grid-cols-2">
        <div key={`${t.id}-fig`} role="img" aria-label={t.figureLabel} className="v-rise flex flex-col gap-1">
          {t.figure.map((f, i) => (
            <p key={i} lang={f.lang} className={`font-display text-6xl font-bold leading-[1.05] tracking-tight sm:text-7xl ${f.strong ? "" : "text-navy-ink/60"}`}>
              {f.a}
              {f.mark && <span className="text-[#F2A93B]">{f.mark}</span>}
              {"rest" in f ? f.rest : ""}
              <span className="ml-4 align-middle font-sans text-2xl font-medium text-signal">{f.note}</span>
            </p>
          ))}
        </div>
        <div key={`${t.id}-text`} className="v-rise flex flex-col gap-6">
          <div>
            <p className="text-signal">What was said</p>
            <p lang={t.saidLang} className="mt-1 text-2xl leading-snug">
              “{t.said}”
            </p>
            <p className="text-navy-ink/75">“{t.saidEnglish}”</p>
          </div>
          <div>
            <p className="text-[#F2A93B]">What could go wrong</p>
            <p className="mt-1 text-lg leading-relaxed">{t.risk}</p>
          </div>
          <div>
            <p className="text-signal">What Verbo does</p>
            <p className="mt-1 text-lg leading-relaxed">{t.fix}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
