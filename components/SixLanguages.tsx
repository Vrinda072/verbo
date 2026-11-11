"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatAmount, labelsFor, LANGUAGES } from "@/lib/bridge/readback";
import { money } from "@/lib/paypal/money";

const CODES = ["hi", "te", "ar", "pt", "es", "en"];
const AMOUNT = money(4000);
const RECIPIENT = "Manuel Lopes";
const EN = labelsFor("en");

/** One payment in each read-back language. The written amount changes by language; the checked value never does. */
function line(code: string) {
  const L = labelsFor(code);
  const info = LANGUAGES.find((l) => l.code === code)!;
  const amount = formatAmount(AMOUNT, code).localized;
  const text = L.t("readback", { amount, recipient: RECIPIENT });
  const at = text.indexOf(amount);
  return {
    code,
    dir: L.dir,
    english: info.englishName,
    native: info.nativeName,
    confirm: L.t("confirm"),
    // The English subtitle, with the amount written the way this language writes it.
    subtitle: code === "en" ? null : EN.t("readback", { amount: formatAmount(AMOUNT, "en").localized, recipient: RECIPIENT }),
    confirmEn: code === "en" ? null : EN.t("confirm"),
    before: at < 0 ? text : text.slice(0, at),
    amount: at < 0 ? "" : amount,
    after: at < 0 ? "" : text.slice(at + amount.length),
  };
}

export function SixLanguages() {
  const [code, setCode] = useState("hi");
  // One orchestrated movement on the page: the read-back steps through the six languages.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setCode((c) => CODES[(CODES.indexOf(c) + 1) % CODES.length]), 3200);
    return () => clearInterval(t);
  }, []);
  const lines = CODES.map(line);
  const cur = lines.find((l) => l.code === code)!;

  return (
    <>
      <section aria-labelledby="hero" className="grid items-start gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-14">
        <div className="flex max-w-xl flex-col gap-5">
          <h1 id="hero" className="text-5xl font-bold leading-[1.02] tracking-tight sm:text-6xl">
            The words change. The money doesn&apos;t.
          </h1>
          <p className="text-lg leading-relaxed text-ink-2">
            Say a payment in your language. Verbo reads it back in your language, and checks that the name and the amount survive every
            translation before anything moves.
          </p>
          <Link href="/send" className="inline-flex min-h-13 items-center gap-2 self-start rounded-full bg-brand px-7 py-3 text-lg font-semibold text-brand-ink">
            <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
            Start speaking
          </Link>
        </div>

        <div className="flex flex-col gap-6 rounded-[28px] bg-navy p-7 text-navy-ink sm:p-9">
          <p className="text-navy-ink/75">Read back to you in {cur.english}</p>
          <p key={cur.code} lang={cur.code} dir={cur.dir} className="v-rise text-3xl font-semibold leading-snug sm:text-4xl">
            {cur.before}
            {cur.amount && <bdi dir="ltr" className="whitespace-nowrap rounded-[10px] bg-signal px-2.5 text-navy">{cur.amount.replace(/[\u200e\u200f]/g, "")}</bdi>}
            {cur.after}
          </p>
          {cur.subtitle && (
            <p key={`${cur.code}-en`} lang="en" className="v-sub v-sub-on-dark -mt-3 text-lg">
              {cur.subtitle}
            </p>
          )}
          <dl className="grid gap-4 border-t border-navy-2 pt-5 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-navy-ink/75">Amount checked</dt>
              <dd className="text-xl font-semibold">40.00 US dollars</dd>
            </div>
            <div>
              <dt className="text-sm text-navy-ink/75">Recipient</dt>
              <dd className="text-xl font-semibold">
                Manuel Lope<span className="text-mark-on-dark">s</span>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-navy-ink/75">PayPal opens in</dt>
              <dd lang={cur.code} className="text-xl font-semibold">
                {cur.native}
              </dd>
            </div>
          </dl>
          <span lang={cur.code} className="self-start rounded-full bg-white px-7 py-3 text-lg font-semibold text-navy">
            {cur.confirm}
            {cur.confirmEn && <span lang="en" className="v-sub text-sm">{cur.confirmEn}</span>}
          </span>
        </div>
      </section>

      <section aria-labelledby="six" className="mt-16">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 id="six" className="text-3xl font-bold tracking-tight">
            One payment, six languages
          </h2>
          <p className="max-w-lg text-ink-2">
            Every sentence is a fixed template. Code writes the name and the amount into it, so no AI wording ever reaches you.
          </p>
        </div>
        <ul className="mt-5 border-t-2 border-navy">
          {lines.map((l) => (
            <li
              key={l.code}
              className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-1 border-b border-line px-3 py-4 sm:grid-cols-[8rem_minmax(0,1fr)_9rem] ${
                l.code === code ? "bg-brand-soft" : ""
              }`}
            >
              <span className="text-sm text-ink-3 max-sm:col-span-2">{l.english}</span>
              <span lang={l.code} dir={l.dir} className="text-xl leading-snug">
                {l.before}
                <bdi dir="ltr" className="border-b-[3px] border-signal">{l.amount.replace(/[\u200e\u200f]/g, "")}</bdi>
                {l.after}
                {l.subtitle && (
                  <span lang="en" dir="ltr" className="v-sub">
                    {l.subtitle}
                  </span>
                )}
              </span>
              <span className="text-right font-semibold tabular-nums">40.00 USD</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-ink-3">The right-hand column is the value code checks. How it is written changes by language. The value never does.</p>
      </section>
    </>
  );
}
