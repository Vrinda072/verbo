"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { labelsFor } from "@/lib/bridge/readback";

export interface TransferView {
  id: string;
  state: string;
  cents: number;
  currency: string;
  recipientName: string;
  language: string;
  approveUrl?: string;
  holdUntil: string | null;
  holdMinutes: number;
  risk: { level: string; hold: boolean; signals: string[] } | null;
  serverNow: string;
  mode: string;
}

const SENDING = new Set(["APPROVED", "AUTHORIZED", "CAPTURED", "PAYOUT_PENDING"]);

/** Sender's live view of one transfer: waiting → (hold countdown with cancel) → sent / cancelled. */
export function TransferStatus({ initial }: { initial: TransferView }) {
  const [t, setT] = useState(initial);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const skew = useRef(Date.parse(initial.serverNow) - Date.now());
  const L = labelsFor(t.language);
  const en = labelsFor("en");
  const showEnglish = L.usedLang !== "en";
  const done = ["COMPLETED", "VOIDED", "CANCELLED", "PAYOUT_FAILED", "INVOICE_FALLBACK"].includes(t.state);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/transfers/${t.id}`, { cache: "no-store" });
    if (res.ok) {
      const v = (await res.json()) as TransferView;
      skew.current = Date.parse(v.serverNow) - Date.now();
      setT(v);
    }
  }, [t.id]);

  useEffect(() => {
    if (done) return;
    const poll = setInterval(refresh, 2500);
    const clock = setInterval(() => setNow(Date.now()), 250);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [done, refresh]);

  const remaining = t.holdUntil ? Math.max(0, Date.parse(t.holdUntil) - (now + skew.current)) : 0;
  const mm = String(Math.floor(remaining / 60000)).padStart(2, "0");
  const ss = String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0");
  const amount = (t.cents / 100).toFixed(2);

  async function cancel() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/transfers/${t.id}/cancel`, { method: "POST" });
    const body = await res.json();
    if (res.ok) setT(body);
    else setError(body.error === "too_late_to_cancel" ? "The hold had already ended — the payment was sent." : "Couldn’t cancel. Please try again.");
    setBusy(false);
    if (!res.ok) void refresh();
  }

  return (
    <section aria-live="polite" className="v-rise mx-auto max-w-xl rounded-v-lg border border-line bg-card p-6 text-center shadow-v-lg sm:p-10">
      <p className="text-sm font-bold uppercase tracking-wider text-ink-3">
        ${amount} → {t.recipientName}
      </p>

      {t.state === "CREATED" && (
        <>
          <h1 className="mt-3 font-display text-3xl font-semibold">Waiting for your approval on PayPal</h1>
          {t.approveUrl && (
            <a href={t.approveUrl} className="mt-6 inline-flex min-h-14 items-center rounded-full bg-evergreen px-8 text-lg font-bold text-evergreen-ink shadow-v">
              Approve on PayPal
            </a>
          )}
          <CancelButton label={L.t("cancel")} lang={L.usedLang} onClick={cancel} busy={busy} />
        </>
      )}

      {t.state === "ON_HOLD" && (
        <>
          <h1 lang={L.usedLang} dir={L.dir} className="mt-3 font-display text-3xl font-semibold text-terracotta">
            {L.t("hold_title")}
          </h1>
          <p className="v-digits mt-6 tabular-nums" role="timer" aria-label={`${mm} minutes ${ss} seconds left`}>
            {mm}:{ss}
          </p>
          <p lang={L.usedLang} dir={L.dir} className="mt-4 text-lg font-bold">
            {L.t("hold_notice", { minutes: String(t.holdMinutes) })}
          </p>
          {showEnglish && <p className="mt-1 text-sm text-ink-3">{en.t("hold_notice", { minutes: String(t.holdMinutes) })}</p>}
          <ul className="mt-5 space-y-2 text-left">
            {t.risk?.signals.map((s) => (
              <li key={s} className="rounded-v border border-marigold/60 bg-marigold-soft px-4 py-3 text-marigold-ink">
                {SIGNAL_TEXT[s] ?? s}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={cancel}
            disabled={busy}
            className="mt-6 min-h-16 w-full rounded-full bg-terracotta px-8 text-xl font-bold text-paper shadow-v disabled:opacity-60"
          >
            <span lang={L.usedLang}>{busy ? "…" : L.t("cancel_hold")}</span>
          </button>
          <p className="mt-3 text-sm text-ink-3">The money is authorized but not taken. Cancelling releases it — nothing moves.</p>
        </>
      )}

      {SENDING.has(t.state) && (
        <>
          <h1 className="mt-3 font-display text-3xl font-semibold">Sending…</h1>
          <p className="mt-2 text-ink-2">PayPal is moving the money. This usually takes under a minute in the sandbox.</p>
        </>
      )}

      {t.state === "COMPLETED" && (
        <>
          <Check />
          <h1 lang={L.usedLang} dir={L.dir} className="mt-3 font-display text-3xl font-semibold text-evergreen">
            {L.t("sent", { recipient: t.recipientName })}
          </h1>
          {showEnglish && <p className="mt-1 text-ink-3">{en.t("sent", { recipient: t.recipientName })}</p>}
          <p className="mt-6 text-ink-2">
            Sent to the wrong person? Verbo can ask them to send it back.{" "}
            <span className="text-ink-3">(Recovery arrives on Day 4.)</span>
          </p>
        </>
      )}

      {(t.state === "VOIDED" || t.state === "CANCELLED") && (
        <>
          <h1 lang={L.usedLang} dir={L.dir} className="mt-3 font-display text-3xl font-semibold">
            {L.t("cancelled")}
          </h1>
          {showEnglish && <p className="mt-1 text-ink-3">{en.t("cancelled")}</p>}
        </>
      )}

      {t.state === "PAYOUT_FAILED" && (
        <h1 className="mt-3 font-display text-3xl font-semibold text-terracotta">PayPal couldn’t deliver the payout. Verbo will retry.</h1>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-v bg-terracotta-soft p-3 text-terracotta">
          {error}
        </p>
      )}

      {done && (
        <Link href="/send" className="mt-8 inline-flex min-h-12 items-center rounded-full border-2 border-line-strong px-6 font-bold hover:bg-paper-2">
          Send another
        </Link>
      )}
      {t.mode === "mock" && <p className="mt-6 text-xs text-ink-3">Offline demo mode — no real sandbox calls.</p>}
    </section>
  );
}

const SIGNAL_TEXT: Record<string, string> = {
  similar_recipient: "Another contact has a very similar name.",
  first_time: "You have never paid this person before.",
  unusual_amount: "This is much more than you usually send.",
  pressure_language: "What you said sounded rushed or pressured.",
  language_mismatch: "This new contact speaks a different language than you.",
};

function CancelButton({ label, lang, onClick, busy }: { label: string; lang: string; onClick: () => void; busy: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={busy} className="mt-4 block w-full font-bold text-terracotta underline">
      <span lang={lang}>{label}</span>
    </button>
  );
}

function Check() {
  return (
    <svg aria-hidden viewBox="0 0 48 48" className="mx-auto h-16 w-16">
      <circle cx="24" cy="24" r="22" fill="var(--v-evergreen-soft)" />
      <path d="M14 25l7 7 13-15" fill="none" stroke="var(--v-evergreen)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
