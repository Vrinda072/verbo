"use client";
import { useState } from "react";
import { decimalToCents } from "@/lib/agents/numbers";
import type { UnderstandResponse } from "./ConfirmCard";
import { labelsFor, languageNameIn } from "@/lib/bridge/readback";
import { En, Tpl } from "@/components/En";

export type NumberResponse = UnderstandResponse & {
  number: {
    typed: string;
    owner: { name: string; language: string; languageCode: string; city: string; timeZone: string };
    near: { name: string; phone: string; digits: string; positions: number[] } | null;
  };
};

const localTime = (tz: string) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz }).format(new Date());

/** A phone number with the digits that differ from another number marked. */
function Digits({ digits, positions }: { digits: string; positions: number[] }) {
  // US numbers read as +1 (408) 555-0139; others fall back to plain digits.
  const sep: Record<number, string> = digits.length === 11 && digits[0] === "1" ? { 1: " (", 4: ") ", 7: "-" } : {};
  return (
    <span dir="ltr" className="font-semibold tabular-nums tracking-wide">
      +
      {digits.split("").map((d, i) => (
        <span key={i}>
          {sep[i]}
          {positions.includes(i) ? (
            <mark className="rounded-[4px] bg-marigold-soft px-0.5 text-marigold-ink underline decoration-marigold decoration-2 underline-offset-2">{d}</mark>
          ) : (
            d
          )}
        </span>
      ))}
    </span>
  );
}

/**
 * Pay a phone number. Code checks the number against every contact's: one digit off stops here, shows who the number
 * really reaches and the language they read, and offers the contact instead.
 */
export function PayNumber({ lang, onReview, onClose }: { lang: string; onReview: (r: NumberResponse) => void; onClose?: () => void }) {
  const L = labelsFor(lang);
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [near, setNear] = useState<NumberResponse | null>(null);

  async function check(number = phone) {
    const cents = decimalToCents(amount.replace(",", "."));
    if (!cents) return setError("Enter the amount in digits, for example 60 or 12.50.");
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/pay-number", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: number, cents, language: lang }),
      });
      const body = await r.json();
      if (r.status === 404) {
        setError(body.near ? `No PayPal account uses this number in this demo. Did you mean ${body.near.name}, ${body.near.phone}?` : "No PayPal account uses this number in this demo.");
      } else if (!r.ok) setError("Couldn't check that number. Nothing was sent.");
      else if ((body as NumberResponse).number.near) setNear(body);
      else onReview(body);
    } catch {
      setError("Couldn't check that number. Nothing was sent.");
    }
    setBusy(false);
  }

  if (near?.number.near) {
    const n = near.number;
    const v = { contact: n.near!.name, owner: n.owner.name, city: n.owner.city, language: languageNameIn(n.owner.languageCode, L.usedLang) };
    const vEn = { ...v, language: n.owner.language };
    return (
      <section aria-labelledby="near-title" className="v-rise">
        <h2 id="near-title" lang={L.usedLang} dir={L.dir} className="text-2xl font-bold">
          <Tpl L={L} k="near_title" vars={v} />
          <En L={L} k="near_title" vars={vEn} className="text-base" />
        </h2>
        <dl className="mt-4 grid gap-3 text-lg">
          <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-v bg-paper p-3">
            <dt className="text-sm text-ink-3">You typed</dt>
            <dd>
              <Digits digits={n.typed} positions={n.near!.positions} />
            </dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-v bg-paper p-3">
            <dt className="text-sm text-ink-3">{n.near!.name}</dt>
            <dd>
              <Digits digits={n.near!.digits} positions={n.near!.positions} />
            </dd>
          </div>
        </dl>
        <p lang={L.usedLang} dir={L.dir} className="mt-4 rounded-v bg-marigold-soft p-4 text-marigold-ink">
          <Tpl L={L} k="near_body" vars={v} />
          <En L={L} k="near_body" vars={vEn} />
          <span dir="ltr" className="v-sub">
            {n.owner.city}: {localTime(n.owner.timeZone)}
          </span>
        </p>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button type="button" disabled={busy} onClick={() => { setNear(null); setPhone(n.near!.phone); void check(n.near!.phone); }} className="min-h-14 rounded-full bg-brand px-6 font-semibold text-brand-ink disabled:opacity-60 sm:col-span-2">
            <span lang={L.usedLang}><Tpl L={L} k="near_pay" vars={v} /></span>
            <En L={L} k="near_pay" vars={vEn} className="v-sub-on-dark text-xs" />
          </button>
          <button type="button" disabled={busy} onClick={() => setNear(null)} className="min-h-12 rounded-full px-6 font-semibold text-brand hover:bg-brand-soft">
            <span lang={L.usedLang}>{L.t("near_edit")}</span>
            <En L={L} k="near_edit" className="text-xs" />
          </button>
          <button type="button" disabled={busy} onClick={() => onReview(near)} className="min-h-12 rounded-full px-6 font-semibold text-terracotta hover:bg-terracotta-soft">
            <span lang={L.usedLang}><Tpl L={L} k="near_anyway" vars={v} /></span>
            <En L={L} k="near_anyway" vars={vEn} className="text-xs" />
          </button>
        </div>
      </section>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void check();
      }}
      className="grid gap-3"
      aria-labelledby="pay-number-title"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id="pay-number-title" lang={L.usedLang} dir={L.dir} className="text-lg font-semibold">
          {L.t("s_pay_number")}
          <En L={L} k="s_pay_number" className="text-xs" />
        </h2>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-paper-2">
            <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
        <label lang={L.usedLang} className="grid min-w-0 gap-1 text-sm text-ink-3">
          <span>
            {L.t("s_phone")}
            <En L={L} k="s_phone" className="text-xs" />
          </span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" dir="ltr" autoComplete="off" placeholder="+1 (408) 555-0139" className="min-h-12 w-full min-w-0 rounded-v border-2 border-line bg-card px-4 text-lg text-ink tabular-nums outline-none focus:border-brand" />
        </label>
        <label lang={L.usedLang} className="grid min-w-0 gap-1 text-sm text-ink-3">
          <span>
            {L.t("s_amount")}
            <En L={L} k="s_amount" className="text-xs" />
          </span>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" dir="ltr" autoComplete="off" placeholder="60" className="min-h-12 w-full min-w-0 rounded-v border-2 border-line bg-card px-4 text-lg text-ink tabular-nums outline-none focus:border-brand" />
        </label>
      </div>
      <button type="submit" disabled={busy || phone.trim().length < 6} className="min-h-12 justify-self-end rounded-full bg-brand px-8 font-semibold text-brand-ink disabled:bg-line-strong disabled:text-ink-2">
        {busy ? "…" : <span lang={L.usedLang}>{L.t("s_check")}</span>}
        {!busy && <En L={L} k="s_check" className="v-sub-on-dark text-xs" />}
      </button>
      {error && (
        <p role="alert" className="text-terracotta">
          {error}
        </p>
      )}
    </form>
  );
}
