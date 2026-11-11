"use client";
import { useState } from "react";
import { decimalToCents } from "@/lib/agents/numbers";
import type { UnderstandResponse } from "./ConfirmCard";

export type NumberResponse = UnderstandResponse & {
  number: {
    typed: string;
    owner: { name: string; language: string; city: string; timeZone: string };
    near: { name: string; phone: string; digits: string; positions: number[] } | null;
  };
};

const localTime = (tz: string) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz }).format(new Date());

/** A phone number with the digits that differ from another number marked. */
function Digits({ digits, positions }: { digits: string; positions: number[] }) {
  return (
    <span className="font-semibold tabular-nums tracking-wide">
      +
      {digits.split("").map((d, i) =>
        positions.includes(i) ? (
          <mark key={i} className="rounded-[4px] bg-marigold-soft px-0.5 text-marigold-ink underline decoration-marigold decoration-2 underline-offset-2">
            {d}
          </mark>
        ) : (
          <span key={i}>{d}</span>
        ),
      )}
    </span>
  );
}

/**
 * Pay a phone number. Code checks the number against every contact's: one digit off stops here, shows who the number
 * really reaches and the language they read, and offers the contact instead.
 */
export function PayNumber({ lang, onReview }: { lang: string; onReview: (r: NumberResponse) => void }) {
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
    return (
      <section aria-labelledby="near-title" className="v-rise rounded-v-lg bg-card p-6 shadow-v-lg">
        <h2 id="near-title" className="text-2xl font-bold">
          This number is one digit off {n.near!.name}&apos;s
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
        <p className="mt-4 rounded-v bg-marigold-soft p-4 text-marigold-ink">
          The number you typed belongs to <strong>{n.owner.name}</strong> in {n.owner.city}, who reads PayPal in <strong>{n.owner.language}</strong>.
          It is {localTime(n.owner.timeZone)} there now. If you send it, getting it back means asking a stranger in another language.
        </p>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button type="button" disabled={busy} onClick={() => { setNear(null); setPhone(n.near!.phone); void check(n.near!.phone); }} className="min-h-12 rounded-full bg-brand px-6 font-semibold text-brand-ink disabled:opacity-60">
            Pay {n.near!.name} instead
          </button>
          <button type="button" disabled={busy} onClick={() => onReview(near)} className="min-h-12 rounded-full px-6 font-semibold text-terracotta hover:bg-terracotta-soft">
            Send to {n.owner.name} anyway
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
      <h2 id="pay-number-title" className="font-semibold">
        Or pay a phone number
      </h2>
      <div className="grid gap-3 sm:grid-cols-[1fr_9rem_auto]">
        <label className="grid min-w-0 gap-1 text-sm text-ink-3">
          Phone number
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="off" placeholder="+91 98480 22339" className="min-h-12 w-full min-w-0 rounded-v border-2 border-line bg-card px-4 text-lg text-ink tabular-nums outline-none focus:border-brand" />
        </label>
        <label className="grid min-w-0 gap-1 text-sm text-ink-3">
          Amount (USD)
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" autoComplete="off" placeholder="60" className="min-h-12 w-full min-w-0 rounded-v border-2 border-line bg-card px-4 text-lg text-ink tabular-nums outline-none focus:border-brand" />
        </label>
        <button type="submit" disabled={busy || phone.trim().length < 6} className="min-h-12 self-end rounded-full bg-navy px-6 font-semibold text-navy-ink disabled:opacity-50">
          {busy ? "Checking…" : "Check"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-terracotta">
          {error}
        </p>
      )}
    </form>
  );
}
