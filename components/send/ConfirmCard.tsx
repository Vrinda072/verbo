"use client";
import { NameDiff } from "@/components/NameDiff";
import { useEffect, useState } from "react";
import { labelsFor } from "@/lib/bridge/readback";
import { decimalToCents } from "@/lib/agents/numbers";
import { useReadAloud } from "@/lib/speech/useReadAloud";

export interface UnderstandResponse {
  draftId: string | null;
  risk: { level: "low" | "medium" | "high"; hold: boolean; signals: string[] } | null;
  extractor: "anthropic" | "gemini" | "rules";
  fellBack?: boolean;
  ok: boolean;
  problems: { code: string; [k: string]: unknown }[];
  heard: { recipient: string | null; amount: string | null };
  recipient: { id: string; name: string; paidBefore: boolean } | null;
  lookAlikes: { id: string; name: string }[];
  amount: { cents: number; currency: string; localized: string; digits: string } | null;
  amountSource: "numerals" | "words" | null;
  currencyAssumed: boolean;
}

/**
 * The fixed read-back card. Every sentence comes from a pre-written template for the chosen language;
 * names and amounts are inserted by code. Large digits are always shown in plain numerals.
 */
export function ConfirmCard({
  data,
  lang,
  holdMinutes,
  busy,
  onConfirm,
  onCancel,
  onEdit,
}: {
  data: UnderstandResponse & { recipient: NonNullable<UnderstandResponse["recipient"]>; amount: NonNullable<UnderstandResponse["amount"]> };
  lang: string;
  holdMinutes: number;
  busy: boolean;
  onConfirm: (typedCents?: number) => void;
  onCancel: () => void;
  onEdit: () => void;
}) {
  const L = labelsFor(lang);
  const en = labelsFor("en");
  const showEnglish = L.usedLang !== "en";
  const [typed, setTyped] = useState("");
  const needsTyped = data.amountSource === "words";
  const typedCents = decimalToCents(typed.replace(",", "."));
  const typedOk = !needsTyped || typedCents === data.amount.cents;
  const [whole, frac] = data.amount.digits.split(".");
  const vars = { amount: data.amount.localized, recipient: data.recipient.name };
  // Same fixed templates as the screen, so the voice can never say anything the card doesn't.
  const spoken = [L.t("readback", vars), ...data.lookAlikes.map((o) => L.t("lookalike", { other: o.name }))].join(" ");
  const voice = useReadAloud(spoken, L.usedLang);
  useEffect(() => {
    if (voice.available && !muted()) voice.play();
    // Once per card, as soon as a voice is ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.available]);

  return (
    <section
      aria-labelledby="confirm-title"
      className="v-rise mx-auto w-full max-w-xl rounded-v-lg bg-card p-6 shadow-v-lg sm:p-8"
    >
      <div className="text-center">
        <span aria-hidden className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-navy text-2xl font-semibold text-navy-ink">
          {data.recipient.name[0]}
        </span>
        <p className="mt-3 text-2xl font-semibold">{data.recipient.name}</p>
        {data.heard.recipient && data.heard.recipient !== data.recipient.name && (
          <p className="text-sm text-ink-3">
            You said: <span lang={L.usedLang}>“{data.heard.recipient}”</span>
          </p>
        )}
        <p className="v-digits mt-5" aria-label={`${data.amount.currency} ${data.amount.digits}`}>
          ${whole}
          <span className="text-ink-3">.{frac}</span>
        </p>
        <p className="mt-1 text-sm text-ink-3">{data.amount.currency}</p>
      </div>

      <div className="mt-5 rounded-v bg-paper p-4">
        <div lang={L.usedLang} dir={L.dir}>
          <h2 id="confirm-title" className="text-sm text-ink-3">
            {L.t("title")}
          </h2>
          <p className="mt-1 text-xl font-medium leading-snug">{L.t("readback", vars)}</p>
        </div>
        {showEnglish && <p className="mt-1 text-sm text-ink-3">{en.t("readback", vars)}</p>}
        {voice.available && (
          <button type="button" onClick={voice.play} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-full bg-card px-4 text-sm font-medium text-brand shadow-v">
            <SpeakerIcon />
            {voice.speaking ? "Speaking…" : "Hear it again"}
          </button>
        )}
      </div>

      {data.lookAlikes.length > 0 && (
        <div className="mt-4 rounded-v border border-marigold/50 p-4">
          <p className="text-sm font-medium text-ink-2">Compare the names</p>
          <ul className="mt-2 space-y-1.5 text-xl">
            <li className="flex items-baseline justify-between gap-3">
              <NameDiff name={data.recipient.name} other={data.lookAlikes[0].name} className="font-medium" />
              <span className="text-sm text-ink-3">Paying now</span>
            </li>
            {data.lookAlikes.map((o) => (
              <li key={o.id} className="flex items-baseline justify-between gap-3">
                <NameDiff name={o.name} other={data.recipient.name} />
                <span className="text-sm text-ink-3">Also in contacts</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {data.lookAlikes.map((o) => (
          <Notice key={o.id} tone="warn" lang={L.usedLang} dir={L.dir} english={showEnglish ? en.t("lookalike", { other: o.name }) : undefined}>
            {L.t("lookalike", { other: o.name })}
          </Notice>
        ))}
        {data.risk?.signals.includes("pressure_language") && (
          <Notice tone="warn" lang={L.usedLang} dir={L.dir} english={showEnglish ? en.t("pressure") : undefined}>
            {L.t("pressure")}
          </Notice>
        )}
        {data.risk?.signals.includes("unusual_amount") && (
          <Notice tone="warn" lang={L.usedLang} dir={L.dir} english={showEnglish ? en.t("unusual_amount") : undefined}>
            {L.t("unusual_amount")}
          </Notice>
        )}
        {!data.recipient.paidBefore && (
          <Notice tone="info" lang={L.usedLang} dir={L.dir} english={showEnglish ? en.t("first_time") : undefined}>
            {L.t("first_time")}
          </Notice>
        )}
        {data.currencyAssumed && (
          <Notice tone="info" lang={L.usedLang} dir={L.dir} english={showEnglish ? en.t("currency_assumed") : undefined}>
            {L.t("currency_assumed")}
          </Notice>
        )}
      </div>

      {data.risk?.hold && (
        <div className="mt-4 rounded-v bg-marigold-soft p-4 text-marigold-ink">
          <p className="text-sm font-semibold">Safety hold</p>
          <p lang={L.usedLang} dir={L.dir} className="mt-1 font-semibold">
            {L.t("hold_notice", { minutes: String(holdMinutes) })}
          </p>
          {showEnglish && <p className="mt-1 text-sm opacity-80">{en.t("hold_notice", { minutes: String(holdMinutes) })}</p>}
        </div>
      )}

      {needsTyped && (
        <div className="mt-5">
          <label htmlFor="typed-amount" className="block font-semibold" lang={L.usedLang} dir={L.dir}>
            {L.t("typed_amount")}
          </label>
          <input
            id="typed-amount"
            inputMode="decimal"
            autoComplete="off"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            aria-invalid={typed !== "" && !typedOk}
            className="mt-2 w-full rounded-full border-2 border-line-strong bg-paper px-4 py-3 text-2xl font-semibold tabular-nums outline-none focus:border-sky"
            placeholder="0.00"
          />
          {typed !== "" && !typedOk && <p className="mt-1 text-sm font-semibold text-terracotta">That doesn’t match the amount above.</p>}
        </div>
      )}

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          disabled={busy || !typedOk}
          onClick={() => onConfirm(needsTyped ? typedCents ?? undefined : undefined)}
          className="min-h-14 sm:col-span-2 rounded-full bg-brand px-6 text-lg font-semibold text-brand-ink shadow-v transition-transform hover:opacity-90 disabled:translate-y-0 disabled:opacity-50"
        >
          <span lang={L.usedLang}>{busy ? "…" : L.t("confirm")}</span>
        </button>
        <button type="button" onClick={onEdit} disabled={busy} className="min-h-12 rounded-full px-6 font-semibold text-brand hover:bg-brand-soft">
          <span lang={L.usedLang}>{L.t("edit")}</span>
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className="min-h-12 rounded-full px-6 font-semibold text-terracotta hover:bg-terracotta-soft">
          <span lang={L.usedLang}>{L.t("cancel")}</span>
        </button>
      </div>

      <p className="mt-5 text-xs text-ink-3">
        {L.fallback
          ? "No written read-back in this language yet — shown in English."
          : L.machineTranslated && !L.reviewed
            ? "Read-back is machine-translated and not yet reviewed by a native speaker."
            : "Read-back reviewed."}{" "}
        Understood by {data.extractor === "anthropic" ? "Claude (checked by code)" : data.extractor === "gemini" ? "Gemini AI (checked by code)" : data.fellBack ? "rule-based parser, because the AI was unavailable" : "rule-based parser (offline mode)"}.
      </p>
    </section>
  );
}

/** Add ?quiet to the URL to stop the card speaking by itself, e.g. while recording a demo. */
function muted() {
  return new URLSearchParams(window.location.search).has("quiet");
}

function SpeakerIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 10v4h3l5 4V6L7 10H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />
    </svg>
  );
}

function Notice({
  tone,
  children,
  english,
  lang,
  dir,
}: {
  tone: "warn" | "info";
  children: React.ReactNode;
  english?: string;
  lang: string;
  dir: "ltr" | "rtl";
}) {
  const cls = tone === "warn" ? "bg-marigold-soft text-marigold-ink" : "bg-sky-soft text-ink";
  return (
    <div role="note" className={`flex gap-3 rounded-v p-4 ${cls}`}>
      <span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-card text-sm font-semibold">
        {tone === "warn" ? "!" : "i"}
      </span>
      <div>
        <p lang={lang} dir={dir} className="font-medium">
          {children}
        </p>
        {english && <p className="mt-1 text-sm opacity-80">{english}</p>}
      </div>
    </div>
  );
}
