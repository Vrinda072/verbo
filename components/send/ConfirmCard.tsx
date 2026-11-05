"use client";
import { useState } from "react";
import { labelsFor } from "@/lib/bridge/readback";
import { decimalToCents } from "@/lib/agents/numbers";

export interface UnderstandResponse {
  extractor: "anthropic" | "rules";
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
  busy,
  onConfirm,
  onCancel,
  onEdit,
}: {
  data: UnderstandResponse & { recipient: NonNullable<UnderstandResponse["recipient"]>; amount: NonNullable<UnderstandResponse["amount"]> };
  lang: string;
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

  return (
    <section
      aria-labelledby="confirm-title"
      className="v-rise mx-auto w-full max-w-xl rounded-v-lg border border-line bg-card p-6 shadow-v-lg sm:p-8"
    >
      <div lang={L.usedLang} dir={L.dir}>
        <h2 id="confirm-title" className="font-display text-2xl font-semibold">
          {L.t("title")}
        </h2>
        <p className="mt-2 text-xl text-ink-2">{L.t("readback", vars)}</p>
      </div>
      {showEnglish && <p className="mt-1 text-sm text-ink-3">{en.t("readback", vars)}</p>}

      <p className="v-digits mt-6 text-ink" aria-label={`${data.amount.currency} ${data.amount.digits}`}>
        ${whole}
        <span className="text-ink-3">.{frac}</span>
      </p>
      <p className="text-sm font-bold uppercase tracking-wider text-ink-3">{data.amount.currency}</p>

      <div className="mt-5 rounded-v border border-line bg-paper-2 p-4">
        <p className="text-sm text-ink-3">to</p>
        <p className="text-3xl font-bold">{data.recipient.name}</p>
        {data.heard.recipient && data.heard.recipient !== data.recipient.name && (
          <p className="mt-1 text-sm text-ink-3">
            You said: <span lang={L.usedLang}>“{data.heard.recipient}”</span>
          </p>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {data.lookAlikes.map((o) => (
          <Notice key={o.id} tone="warn" lang={L.usedLang} dir={L.dir} english={showEnglish ? en.t("lookalike", { other: o.name }) : undefined}>
            {L.t("lookalike", { other: o.name })}
          </Notice>
        ))}
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

      {needsTyped && (
        <div className="mt-5">
          <label htmlFor="typed-amount" className="block font-bold" lang={L.usedLang} dir={L.dir}>
            {L.t("typed_amount")}
          </label>
          <input
            id="typed-amount"
            inputMode="decimal"
            autoComplete="off"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            aria-invalid={typed !== "" && !typedOk}
            className="mt-2 w-full rounded-v border-2 border-line-strong bg-paper px-4 py-3 text-2xl font-bold tabular-nums outline-none focus:border-sky"
            placeholder="0.00"
          />
          {typed !== "" && !typedOk && <p className="mt-1 text-sm font-bold text-terracotta">That doesn’t match the amount above.</p>}
        </div>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <button
          type="button"
          disabled={busy || !typedOk}
          onClick={() => onConfirm(needsTyped ? typedCents ?? undefined : undefined)}
          className="min-h-14 rounded-full bg-evergreen px-6 text-lg font-bold text-evergreen-ink shadow-v transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50"
        >
          <span lang={L.usedLang}>{busy ? "…" : L.t("confirm")}</span>
        </button>
        <button type="button" onClick={onEdit} disabled={busy} className="min-h-14 rounded-full border-2 border-line-strong px-6 font-bold hover:bg-paper-2">
          <span lang={L.usedLang}>{L.t("edit")}</span>
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className="min-h-14 rounded-full px-6 font-bold text-terracotta hover:bg-terracotta-soft">
          <span lang={L.usedLang}>{L.t("cancel")}</span>
        </button>
      </div>

      <p className="mt-5 text-xs text-ink-3">
        {L.fallback
          ? "No written read-back in this language yet — shown in English."
          : L.machineTranslated && !L.reviewed
            ? "Read-back is machine-translated and not yet reviewed by a native speaker."
            : "Read-back reviewed."}{" "}
        Understood by {data.extractor === "anthropic" ? "Claude (checked by code)" : "rule-based parser (offline mode)"}.
      </p>
    </section>
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
  const cls = tone === "warn" ? "border-marigold/70 bg-marigold-soft text-marigold-ink" : "border-sky/40 bg-sky-soft text-ink";
  return (
    <div role="note" className={`flex gap-3 rounded-v border p-4 ${cls}`}>
      <span aria-hidden className="mt-0.5 font-bold">
        {tone === "warn" ? "!" : "i"}
      </span>
      <div>
        <p lang={lang} dir={dir} className="font-bold">
          {children}
        </p>
        {english && <p className="mt-1 text-sm opacity-80">{english}</p>}
      </div>
    </div>
  );
}
