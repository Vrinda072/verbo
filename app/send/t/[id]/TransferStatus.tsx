"use client";
import { En } from "@/components/En";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { labelsFor } from "@/lib/bridge/readback";
import { MoneyPath, type PathTone } from "@/components/MoneyPath";
import { SenderCase } from "./SenderCase";
import type { TrailStep } from "@/lib/paypal/trail";

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
  trail?: TrailStep[];
}

const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** Every PayPal operation behind this payment, in order, with the idempotency key each money call carries. */
function PayPalCalls({ steps, mock }: { steps: TrailStep[]; mock: boolean }) {
  const calls = steps.filter((s) => s.operation).length;
  // Times use the viewer's own clock, so they are filled in after hydration to match the server's HTML.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <details className="mt-8 rounded-v-lg border border-line bg-paper text-left">
      <summary className="cursor-pointer px-4 py-3 font-semibold">
        PayPal calls for this payment ({calls})
        <span className="ml-2 text-sm font-normal text-ink-3">{mock ? "offline demo: the same calls, answered locally" : "PayPal sandbox"}</span>
      </summary>
      <ol className="grid gap-px border-t border-line">
        {steps.map((s, i) => (
          <li key={i} className="grid gap-1 bg-card px-4 py-3 sm:grid-cols-[5.5rem_1fr]">
            <span className="text-sm tabular-nums text-ink-3">{mounted ? clock(s.at) : ""}</span>
            <div>
              {s.operation ? (
                <p className="flex flex-wrap items-center gap-2">
                  <code className="font-semibold">{s.operation}</code>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${s.via === "APIMatic SDK" ? "bg-navy text-navy-ink" : "bg-paper-2 text-ink-2"}`}>{s.via}</span>
                  {s.idempotency && <span className="rounded-full bg-sky-soft px-2 py-0.5 text-xs text-navy">{s.idempotency}</span>}
                </p>
              ) : (
                <p className="font-semibold text-ink-2">No PayPal call</p>
              )}
              {s.endpoint && <p className="text-sm text-ink-3"><code>{s.endpoint}</code></p>}
              <p className="text-sm text-ink-2">{s.note}</p>
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}

const SENDING = new Set(["APPROVED", "AUTHORIZED", "CAPTURED", "PAYOUT_PENDING"]);

/** Sender's live view of one transfer: waiting → (hold countdown with cancel) → sent / cancelled. */
export function TransferStatus({ initial, caseId }: { initial: TransferView; caseId: string | null }) {
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

  const path: { at: 0 | 1 | 2; tone: PathTone } =
    t.state === "COMPLETED"
      ? { at: 2, tone: "away" }
      : t.state === "ON_HOLD"
        ? { at: 1, tone: "hold" }
        : SENDING.has(t.state)
          ? { at: 1, tone: "moving" }
          : { at: 0, tone: "safe" };

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
    <section aria-live="polite" className="v-rise mx-auto max-w-xl rounded-v-lg bg-card p-6 text-center shadow-v-lg sm:p-10">
      <MoneyPath stops={["You", "Safety hold", t.recipientName]} at={path.at} amount={`$${Math.round(t.cents / 100)}`} tone={path.tone} />

      {t.state === "CREATED" && (
        <>
          <h1 className="mt-3 text-2xl font-semibold">Waiting for your approval on PayPal</h1>
          {t.approveUrl && (
            <a href={t.approveUrl} className="mt-6 inline-flex min-h-14 items-center rounded-full bg-brand px-8 text-lg font-semibold text-brand-ink shadow-v">
              Approve on PayPal
            </a>
          )}
          <CancelButton label={L.t("cancel")} lang={L.usedLang} onClick={cancel} busy={busy} english={<En L={L} k="cancel" />} />
        </>
      )}

      {t.state === "ON_HOLD" && (
        <>
          <h1 lang={L.usedLang} dir={L.dir} className="mt-5 text-2xl font-semibold">
            {L.t("hold_title")}
            <En L={L} k="hold_title" className="text-base" />
          </h1>
          <HoldRing fraction={remaining / (t.holdMinutes * 60000)} label={`${mm}:${ss}`} srLabel={`${mm} minutes ${ss} seconds left`} />
          <p lang={L.usedLang} dir={L.dir} className="mt-4 text-lg font-semibold">
            {L.t("hold_notice", { minutes: String(t.holdMinutes) })}
          </p>
          {showEnglish && <p className="mt-1 text-sm text-ink-3">{en.t("hold_notice", { minutes: String(t.holdMinutes) })}</p>}
          <ul className="mt-5 space-y-2 text-left">
            {t.risk?.signals.map((s) => (
              <li key={s} className="rounded-v bg-marigold-soft px-4 py-3 text-marigold-ink">
                {SIGNAL_TEXT[s] ?? s}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={cancel}
            disabled={busy}
            className="mt-6 min-h-16 w-full rounded-full bg-terracotta px-8 text-xl font-semibold text-paper shadow-v disabled:opacity-60"
          >
            <span lang={L.usedLang}>{busy ? "…" : L.t("cancel_hold")}</span>
            {!busy && <En L={L} k="cancel_hold" className="v-sub-on-dark" />}
          </button>
          <p className="mt-3 text-sm text-ink-3">The money is authorized but not taken. Cancelling releases it — nothing moves.</p>
        </>
      )}

      {SENDING.has(t.state) && (
        <>
          <h1 className="mt-3 text-2xl font-semibold">Sending…</h1>
          <p className="mt-2 text-ink-2">PayPal is moving the money. This usually takes under a minute in the sandbox.</p>
        </>
      )}

      {t.state === "COMPLETED" && (
        <>
          <Check />
          <h1 lang={L.usedLang} dir={L.dir} className="mt-3 text-2xl font-semibold text-success">
            {L.t("sent", { recipient: t.recipientName })}
          </h1>
          {showEnglish && <p className="mt-1 text-ink-3">{en.t("sent", { recipient: t.recipientName })}</p>}
          <SenderCase transferId={t.id} lang={t.language} initialCaseId={caseId} />
        </>
      )}

      {(t.state === "VOIDED" || t.state === "CANCELLED") && (
        <>
          <h1 lang={L.usedLang} dir={L.dir} className="mt-3 text-2xl font-semibold">
            {L.t("cancelled")}
          </h1>
          {showEnglish && <p className="mt-1 text-ink-3">{en.t("cancelled")}</p>}
        </>
      )}

      {t.state === "PAYOUT_FAILED" && (
        <h1 className="mt-3 text-2xl font-semibold text-terracotta">PayPal couldn’t deliver the payout. Verbo will retry.</h1>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-v bg-terracotta-soft p-3 text-terracotta">
          {error}
        </p>
      )}

      {done && (
        <Link href="/send" className="mt-8 inline-flex min-h-12 items-center rounded-full border-2 border-line-strong px-6 font-semibold hover:bg-paper-2">
          Send another
        </Link>
      )}
      {t.trail && t.trail.length > 0 && <PayPalCalls steps={t.trail} mock={t.mode === "mock"} />}
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
  number_near_contact: "This number is one digit away from a contact's number.",
};

function CancelButton({ label, lang, onClick, busy, english }: { label: string; lang: string; onClick: () => void; busy: boolean; english?: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={busy} className="mt-4 block w-full font-semibold text-terracotta underline">
      <span lang={lang}>{label}</span>
      {english}
    </button>
  );
}

function Check() {
  return (
    <svg aria-hidden viewBox="0 0 48 48" className="mx-auto mt-6 h-16 w-16">
      <circle cx="24" cy="24" r="22" fill="var(--v-success-soft)" />
      <path d="M14 25l7 7 13-15" fill="none" stroke="var(--v-success)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HoldRing({ fraction, label, srLabel }: { fraction: number; label: string; srLabel: string }) {
  const c = 2 * Math.PI * 54;
  return (
    <div className="relative mx-auto mt-5 h-44 w-44" role="timer" aria-label={srLabel}>
      <svg aria-hidden viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r="54" fill="none" stroke="var(--v-line)" strokeWidth="7" />
        <circle cx="60" cy="60" r="54" fill="none" stroke="var(--v-marigold)" strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, fraction))} className="transition-[stroke-dashoffset] duration-300" />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-4xl font-medium tabular-nums">{label}</span>
    </div>
  );
}
