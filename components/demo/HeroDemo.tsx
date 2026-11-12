"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatAmount, labelsFor, LANGUAGES } from "@/lib/bridge/readback";
import { money } from "@/lib/paypal/money";
import { En, Tpl } from "@/components/En";
import { NameDiff } from "@/components/NameDiff";
import { Logo } from "@/components/SiteHeader";
import { IPhone } from "./IPhone";

const CODES = ["en", "hi", "te", "ar", "pt", "es"] as const;
const RIGHT = "Manuel Lopez";
const OTHER = "Manuel Lopes";
const AMOUNT = formatAmount(money(4000), "en").localized;

/** What the sender says in each language. Example sentences for the demo, machine-written, not templates. */
const SAID: Record<(typeof CODES)[number], string> = {
  en: "Send 40 dollars to Manuel Lopez",
  hi: "मैनुअल लोपेज़ को 40 डॉलर भेज दो",
  te: "మాన్యుయెల్ లోపెజ్ కి 40 డాలర్లు పంపండి",
  ar: "أرسل 40 دولارًا إلى مانويل لوبيز",
  pt: "Envie 40 dólares para Manuel Lopez",
  es: "Envía 40 dólares a Manuel López",
};

/** The four screens, in order, and how long each stays up (ms). */
const SCENES = [
  { title: "Speak", body: "The sender says the payment in their own language.", ms: 4600 },
  { title: "Answer one question", body: "Two contacts sound the same, so Verbo asks which one, in the same language.", ms: 4200 },
  { title: "Check the read-back", body: "A fixed template states the name and amount. Code checked both before this screen.", ms: 4200 },
  { title: "Sent", body: "The sender confirmed. PayPal moves the money (sandbox).", ms: 3600 },
] as const;

const TICK = 100;

function Steps({ L, at }: { L: ReturnType<typeof labelsFor>; at: number }) {
  const keys = ["s_step_speak", "s_step_check", "s_step_approve"] as const;
  const cur = at === 0 ? 0 : at < 3 ? 1 : 2;
  return (
    <ol dir={L.dir} className="grid grid-cols-3 gap-1.5" aria-hidden>
      {keys.map((k, i) => (
        <li key={k} className="grid gap-1">
          <span className={`h-1 rounded-full ${i <= cur ? "bg-brand" : "bg-line"}`} />
          <span lang={L.usedLang} className={`truncate text-[11px] ${i === cur ? "font-semibold text-ink" : "text-ink-3"}`}>
            {L.t(k)}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** One screen of the simulated app, for a scene and how far into it we are. */
function Screen({ code, scene, t }: { code: (typeof CODES)[number]; scene: number; t: number }) {
  const L = labelsFor(code);
  const vars = { amount: AMOUNT, recipient: RIGHT };

  if (scene === 0) {
    const said = SAID[code];
    const shown = said.slice(0, Math.ceil(said.length * Math.min(1, Math.max(0, (t - 500) / 2600))));
    return (
      <div className="flex h-full flex-col gap-4 p-4">
        <Steps L={L} at={0} />
        <p lang={L.usedLang} dir={L.dir} className="text-xl font-bold">
          {L.t("s_heading")}
          <En L={L} k="s_heading" className="text-xs" />
        </p>
        <div className="flex flex-col items-center gap-4 rounded-v-lg border border-line bg-card p-5 text-center">
          <span className="relative grid h-20 w-20 place-items-center rounded-full bg-brand text-brand-ink">
            <span aria-hidden className="v-pulse absolute inset-0 rounded-full border-4 border-brand" />
            <svg aria-hidden viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
          </span>
          <span aria-hidden className="flex h-5 items-center gap-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className="v-bar h-5 w-1 rounded-full bg-brand" style={{ animationDelay: `${i * 120}ms` }} />
            ))}
          </span>
          <p lang={L.usedLang} dir={L.dir} className="text-sm text-ink-2">
            {L.t("s_say")}
            <En L={L} k="s_say" className="text-xs" />
          </p>
        </div>
        <p lang={code} dir={L.dir} className="min-h-[4.5rem] rounded-v bg-paper-2 p-3 text-lg font-semibold leading-snug">
          {shown}
          <span aria-hidden className="ms-0.5 inline-block h-5 w-0.5 translate-y-0.5 animate-pulse bg-brand" />
        </p>
      </div>
    );
  }

  if (scene === 1) {
    const picked = t > 2300;
    const opts = [
      { name: RIGHT, other: OTHER, k: "opt_paid" as const, n: 1 },
      { name: OTHER, other: RIGHT, k: "opt_new" as const, n: 2 },
    ];
    return (
      <div className="flex h-full flex-col gap-4 p-4">
        <Steps L={L} at={1} />
        <div lang={L.usedLang} dir={L.dir} className="v-rise rounded-v-lg bg-marigold-soft p-4 text-marigold-ink">
          <p className="text-xs font-semibold">
            {L.t("s_asking")}
          </p>
          <p className="mt-1 text-lg font-bold leading-snug">
            {L.t("ask_same_sound")}
            <En L={L} k="ask_same_sound" className="text-xs" />
          </p>
        </div>
        <div className="grid gap-2.5">
          {opts.map((o) => {
            const on = picked && o.n === 1;
            return (
              <div
                key={o.n}
                className={`flex min-h-14 items-center gap-3 rounded-v-lg border-2 bg-card px-3 py-2.5 transition-all duration-300 ${
                  on ? "border-brand ring-4 ring-signal" : "border-line"
                } ${picked && !on ? "opacity-60" : ""}`}
              >
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${on ? "bg-brand text-brand-ink" : "bg-paper-2 text-ink-2"}`}>
                  {o.n}
                </span>
                <span className="min-w-0 flex-1">
                  <NameDiff name={o.name} other={o.other} className="block font-semibold" />
                  <span lang={L.usedLang} className="block text-xs text-ink-3">
                    {L.t(o.k)}
                  </span>
                </span>
                {on && (
                  <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 text-brand" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
        <p lang={L.usedLang} dir={L.dir} className="text-center text-xs text-ink-3">
          {L.t("s_answer")}
        </p>
      </div>
    );
  }

  if (scene === 2) {
    const pressed = t > 2700;
    return (
      <div className="flex h-full flex-col gap-4 p-4">
        <Steps L={L} at={2} />
        <div className="v-stage v-rise flex flex-col gap-4 rounded-[24px] bg-navy p-5 text-navy-ink">
          <p className="text-xs text-navy-ink/75" lang={L.usedLang}>
            {L.t("title")}
          </p>
          <p lang={L.usedLang} dir={L.dir} className="text-2xl font-semibold leading-snug">
            <Tpl L={L} k="readback" vars={vars} />
            <En L={L} k="readback" vars={vars} className="v-sub-on-dark text-xs" />
          </p>
          <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success">
            <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
            <span lang={L.usedLang}>
              <Tpl L={L} k="numbers_checked" vars={{ numbers: AMOUNT }} />
            </span>
          </span>
          <span
            lang={L.usedLang}
            className={`mt-1 grid min-h-12 place-items-center rounded-full bg-card px-5 py-2 text-center font-semibold text-navy transition-transform duration-150 ${
              pressed ? "scale-95 ring-4 ring-signal" : ""
            }`}
          >
            <span>
              {L.t("confirm")}
              <En L={L} k="confirm" className="text-[11px]" />
            </span>
          </span>
        </div>
        <dl className="grid gap-2 rounded-v bg-paper-2 p-3 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-ink-3">To</dt>
            <dd className="font-semibold">
              <NameDiff name={RIGHT} other={OTHER} /> · <span className="font-normal text-success">Paid before</span>
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-ink-3">PayPal opens in</dt>
            <dd lang={code} className="font-semibold">
              {LANGUAGES.find((l) => l.code === code)?.nativeName}
            </dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <Steps L={L} at={3} />
      <div className="v-rise flex flex-col items-center gap-3 rounded-v-lg border border-line bg-card p-6 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-success text-white">
          <svg aria-hidden viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
        <p className="v-digits !text-5xl">{AMOUNT}</p>
        <p lang={L.usedLang} dir={L.dir} className="font-semibold">
          <Tpl L={L} k="sent" vars={vars} />
          <En L={L} k="sent" vars={vars} className="text-xs" />
        </p>
      </div>
      <div className="grid gap-2 rounded-v bg-paper-2 p-3 text-sm">
        <div className="flex justify-between gap-2">
          <span className="text-ink-3">To</span>
          <span className="font-semibold">{RIGHT}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-ink-3">Read back in</span>
          <span lang={code} className="font-semibold">
            {LANGUAGES.find((l) => l.code === code)?.nativeName}
          </span>
        </div>
      </div>
      <p lang={L.usedLang} dir={L.dir} className="text-center text-sm font-semibold text-brand">
        {L.t("ask_back")}
        <En L={L} k="ask_back" className="text-xs" />
      </p>
    </div>
  );
}

/** Home hero: what Verbo does, and a simulated phone that plays one payment in the language you pick. */
export function HeroDemo() {
  const [code, setCode] = useState<(typeof CODES)[number]>("en");
  const [{ scene, t }, setPos] = useState({ scene: 0, t: 0 });
  const [playing, setPlaying] = useState(false);
  const setT = (x: number) => setPos((p) => ({ ...p, t: x }));

  // Plays on its own unless the reader asked for reduced motion; then every screen shows its finished state.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setT(99_999);
    else setPlaying(true);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setPos((p) => (p.t + TICK < SCENES[p.scene].ms ? { ...p, t: p.t + TICK } : { scene: (p.scene + 1) % SCENES.length, t: 0 }));
    }, TICK);
    return () => clearInterval(id);
  }, [playing]);

  const go = (i: number) => setPos({ scene: i, t: playing ? 0 : 99_999 });
  const pickLanguage = (c: (typeof CODES)[number]) => {
    setCode(c);
    go(0);
  };

  const langs = useMemo(() => CODES.map((c) => LANGUAGES.find((l) => l.code === c)!), []);
  const progress = playing ? Math.min(1, t / SCENES[scene].ms) : 1;

  return (
    <section aria-labelledby="hero" className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-x-16 lg:gap-y-8">
      <div className="flex max-w-xl flex-col gap-6 lg:col-start-1 lg:row-start-1">
        <h1 id="hero" className="text-5xl font-bold leading-[1.02] tracking-tight [text-wrap:balance] sm:text-6xl">
          The words change. The money doesn&apos;t.
        </h1>
        <p className="text-lg leading-relaxed text-ink-2">
          Say a payment in your language. Verbo reads it back in your language, and checks that the name and the amount survive every
          translation before anything moves.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/send" className="inline-flex min-h-14 items-center gap-2 rounded-full bg-brand px-7 py-3 text-lg font-semibold text-brand-ink shadow-v hover:opacity-90">
            <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
            Start speaking
          </Link>
          <Link href="/demo" className="inline-flex min-h-12 items-center rounded-full px-6 font-semibold text-brand hover:bg-brand-soft">
            See the examples
          </Link>
        </div>
      </div>

      <div className="relative lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center">
        <IPhone
          label={`Simulated phone screen, step ${scene + 1} of ${SCENES.length}: ${SCENES[scene].title}`}
          top={
            <div className="flex items-center justify-between px-5 pb-3 pt-1">
              <Logo className="[&_svg]:h-6 [&_svg]:w-6 [&>span:last-child]:text-base" />
              <span className="rounded-full bg-navy-2 px-2.5 py-0.5 text-[11px] font-semibold">Sandbox</span>
            </div>
          }
        >
          <div key={`${code}-${scene}`} className="h-full">
            <Screen code={code} scene={scene} t={t} />
          </div>
        </IPhone>
        <p className="mt-4 text-center text-sm text-ink-3">Simulated screen. No money moves.</p>
      </div>

      <div className="flex max-w-xl flex-col gap-6 lg:col-start-1 lg:row-start-2">
        <div className="border-t border-line pt-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">On the phone</h2>
            <button
              type="button"
              onClick={() => {
                setPlaying((p) => !p);
                if (playing) setT(99_999);
                else setT(0);
              }}
              className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-brand hover:bg-brand-soft"
            >
              {playing ? (
                <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
              ) : (
                <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M7 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L8.5 4.64A1 1 0 0 0 7 5.5z" /></svg>
              )}
              {playing ? "Pause" : "Play"}
            </button>
          </div>
          <ol className="mt-3 grid gap-1">
            {SCENES.map((s, i) => (
              <li key={s.title}>
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-current={i === scene ? "step" : undefined}
                  className={`grid w-full grid-cols-[2rem_1fr] items-start gap-x-3 rounded-v px-3 py-2.5 text-left transition-colors ${
                    i === scene ? "bg-card shadow-v" : "hover:bg-paper-2"
                  }`}
                >
                  <span
                    className={`grid h-8 w-8 place-items-center rounded-full text-sm font-semibold tabular-nums ${
                      i < scene ? "bg-brand-soft text-brand" : i === scene ? "bg-navy text-navy-ink" : "bg-paper-2 text-ink-3"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span>
                    <span className={`block font-semibold ${i === scene ? "text-ink" : "text-ink-2"}`}>{s.title}</span>
                    {i === scene && <span className="block text-sm text-ink-2">{s.body}</span>}
                    {i === scene && (
                      <span aria-hidden className="mt-2 block h-1 overflow-hidden rounded-full bg-line">
                        <span className="block h-full rounded-full bg-brand" style={{ width: `${progress * 100}%`, transition: `width ${TICK}ms linear` }} />
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>

        <fieldset>
          <legend className="text-sm text-ink-3">Language on the phone</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {langs.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => pickLanguage(l.code as (typeof CODES)[number])}
                aria-pressed={l.code === code}
                className={`min-h-11 rounded-full border-2 px-4 text-sm font-semibold transition-colors ${
                  l.code === code ? "border-navy bg-navy text-navy-ink" : "border-line-strong bg-card text-ink hover:border-brand"
                }`}
              >
                <span lang={l.code}>{l.nativeName}</span>
                {l.code !== "en" && <span className={`ms-1.5 font-normal ${l.code === code ? "text-navy-ink/80" : "text-ink-3"}`}>{l.englishName}</span>}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

    </section>
  );
}
