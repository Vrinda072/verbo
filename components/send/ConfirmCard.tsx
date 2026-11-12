"use client";
import { CONTACTS } from "@/lib/contacts";
import { En, Tpl } from "@/components/En";
import { NameDiff } from "@/components/NameDiff";
import { useEffect, useState } from "react";
import { labelsFor, languageNameIn, LANGUAGES } from "@/lib/bridge/readback";
import { decimalToCents } from "@/lib/agents/numbers";
import { useReadAloud } from "@/lib/speech/useReadAloud";
import type { SpokenPart } from "@/lib/speech/spoken";

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
  /** Paying a typed number one digit away from this contact's number. */
  nearContact?: string;
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
  const parts: SpokenPart[] = [
    { key: "readback", vars },
    ...data.lookAlikes.map((o) => ({ key: "lookalike" as const, vars: { other: o.name } })),
  ];
  const voice = useReadAloud(spoken, L.usedLang, parts);
  useEffect(() => {
    if (voice.available && !muted()) void voice.play();
    // Once per card, as soon as a voice is ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.available]);

  return (
    <section
      aria-labelledby="confirm-title"
      className="v-rise mx-auto w-full max-w-xl rounded-v-lg bg-card p-6 shadow-v-lg sm:p-8"
    >
      {/* The read-back stage: the sentence in the sender's language leads; English and the checked facts follow. */}
      <div lang={L.usedLang} dir={L.dir} className="v-stage rounded-[24px] bg-navy p-6 text-navy-ink sm:p-7">
        <h2 id="confirm-title" className="text-sm font-medium text-navy-ink/80">
          {L.t("title")}
          <En L={L} k="title" className="v-sub-on-dark text-xs" />
        </h2>
        <p className="mt-3 text-2xl font-semibold leading-snug sm:text-[1.75rem]">
          <Tpl L={L} k="readback" vars={vars} />
        </p>
        {showEnglish && (
          <p lang="en" dir="ltr" className="v-sub v-sub-on-dark text-base">
            {en.t("readback", vars)}
          </p>
        )}
        {voice.available && (
          <button type="button" dir="ltr" onClick={() => void voice.play()} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-navy-2 px-4 text-sm font-medium text-navy-ink hover:bg-white/15">
            <SpeakerIcon />
            {voice.speaking ? "Speaking…" : "Hear it again"}
          </button>
        )}
        <dl dir="ltr" className="mt-5 grid grid-cols-2 gap-4 border-t border-navy-2 pt-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-navy-ink/75">To</dt>
            <dd className="text-lg font-semibold">{data.recipient.name}</dd>
          </div>
          <div>
            <dt className="text-navy-ink/75">Amount checked</dt>
            <dd className="text-lg font-semibold tabular-nums" aria-label={`${data.amount.currency} ${data.amount.digits}`}>
              ${whole}.{frac} <span className="text-sm font-normal text-navy-ink/75">{data.amount.currency}</span>
            </dd>
          </div>
          <div>
            <dt className="text-navy-ink/75">PayPal opens in</dt>
            <dd lang={L.usedLang} className="text-lg font-semibold">
              {LANGUAGES.find((l) => l.code === L.usedLang)?.nativeName ?? "English"}
            </dd>
          </div>
        </dl>
        {data.heard.recipient && data.heard.recipient !== data.recipient.name && (
          <p dir="ltr" className="mt-3 text-sm text-navy-ink/75">
            You said: <span lang={L.usedLang}>“{data.heard.recipient}”</span>
          </p>
        )}
      </div>

      {data.lookAlikes.length > 0 && (
        <div role="note" lang={L.usedLang} dir={L.dir} className="mt-4 rounded-v bg-marigold-soft p-4 text-marigold-ink">
          {data.lookAlikes.map((o) => (
            <p key={o.id} className="font-medium">
              <Tpl L={L} k="lookalike" vars={{ other: o.name }} />
              <En L={L} k="lookalike" vars={{ other: o.name }} />
            </p>
          ))}
          <ul dir="ltr" className="mt-3 grid gap-2">
            {[{ name: data.recipient.name, now: true }, ...data.lookAlikes.map((o) => ({ name: o.name, now: false }))].map((row, i, all) => {
              const c = CONTACTS.find((x) => x.name === row.name);
              return (
                <li key={row.name} className={`flex flex-wrap items-baseline justify-between gap-x-3 rounded-v px-3 py-2 ${row.now ? "bg-card text-ink" : "text-ink-2"}`}>
                  <NameDiff name={row.name} other={all[i === 0 ? 1 : 0].name} className="text-xl font-semibold" />
                  <span lang={L.usedLang} className="text-sm">
                    {c ? `${languageNameIn(c.language, L.usedLang)} · ${c.city} · ${L.t(c.paidBefore ? "opt_paid" : "opt_new")}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {data.nearContact && (
          <Notice tone="warn" lang={L.usedLang} dir={L.dir} english={showEnglish ? en.t("number_near", { contact: data.nearContact }) : undefined}>
            <Tpl L={L} k="number_near" vars={{ contact: data.nearContact }} />
          </Notice>
        )}
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
        <p lang={L.usedLang} dir={L.dir} className="mt-4 rounded-v bg-sky-soft px-4 py-3 font-medium text-ink">
          {L.t("hold_notice", { minutes: String(holdMinutes) })}
          <En L={L} k="hold_notice" vars={{ minutes: String(holdMinutes) }} />
        </p>
      )}

      {needsTyped && (
        <div className="mt-5">
          <label htmlFor="typed-amount" className="block font-semibold" lang={L.usedLang} dir={L.dir}>
            {L.t("typed_amount")}
            <En L={L} k="typed_amount" />
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

      {/* Pinned to the bottom of the screen on phones, so the decision is always within thumb reach. */}
      <div className="sticky bottom-0 -mx-6 mt-6 grid gap-2 border-t border-line bg-card px-6 pb-4 pt-3 grid-cols-2 sm:static sm:mx-0 sm:border-0 sm:p-0">
        <button
          type="button"
          disabled={busy || !typedOk}
          onClick={() => onConfirm(needsTyped ? typedCents ?? undefined : undefined)}
          className="col-span-2 min-h-14 rounded-full bg-brand px-6 text-lg font-semibold text-brand-ink shadow-v transition-transform hover:opacity-90 disabled:translate-y-0 disabled:opacity-50"
        >
          <span lang={L.usedLang}>{busy ? "…" : L.t("confirm")}</span>
          {!busy && <En L={L} k="confirm" className="v-sub-on-dark" />}
        </button>
        <button type="button" onClick={onEdit} disabled={busy} className="min-h-12 rounded-full px-6 font-semibold text-brand hover:bg-brand-soft">
          <span lang={L.usedLang}>{L.t("edit")}</span>
          <En L={L} k="edit" />
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className="min-h-12 rounded-full px-6 font-semibold text-terracotta hover:bg-terracotta-soft">
          <span lang={L.usedLang}>{L.t("cancel")}</span>
          <En L={L} k="cancel" />
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
    <div role="note" dir={dir} className={`flex gap-3 rounded-v p-4 ${cls}`}>
      <span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-card text-sm font-semibold">
        {tone === "warn" ? "!" : "i"}
      </span>
      <div>
        <p lang={lang} dir={dir} className="font-medium">
          {children}
        </p>
        {english && <p lang="en" dir="ltr" className="v-sub">{english}</p>}
      </div>
    </div>
  );
}
