"use client";
import { En, EnText, Tpl } from "@/components/ui/En";
import { useCallback, useEffect, useState } from "react";
import { Logo } from "@/components/ui/SiteHeader";
import { LanguagePicker } from "@/components/send/LanguagePicker";
import { formatAmount, labelsFor } from "@/lib/bridge/readback";
import type { RecipientView } from "@/lib/recovery/views";

/**
 * The wrong recipient's page. Friendly, mobile-first, in their language. One big button to send the money back
 * (they approve it themselves on PayPal), a quieter "this money is mine", and a translated conversation below.
 */
export function RecoverView({ token, initial, initialLang }: { token: string; initial: RecipientView; initialLang: string }) {
  const [v, setV] = useState(initial);
  const [lang, setLang] = useState(initialLang);
  const [originals, setOriginals] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState<null | "return" | "refuse" | "message">(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const L = labelsFor(lang);
  const amount = formatAmount({ cents: v.cents, currency: "USD" }, L.usedLang);
  const [whole, frac] = amount.digits.split(".");
  const returned = v.state === "RETURNED" || v.state === "CLOSED";
  const returning = v.returnState && !returned && v.returnState !== "CANCELLED";

  const refresh = useCallback(async () => {
    const r = await fetch(`/api/recover/${token}`, { cache: "no-store" });
    if (r.ok) setV(await r.json());
  }, [token]);

  useEffect(() => {
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, [refresh]);

  async function act(action: "return" | "refuse" | "message") {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/recover/${token}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: action === "message" ? JSON.stringify({ text: draft, lang: L.usedLang }) : "{}",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      if (action === "return") {
        window.location.href = body.approveUrl;
        return;
      }
      setV(body);
      if (action === "message") setDraft("");
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setBusy(null);
  }

  return (
    <div lang={L.usedLang} dir={L.dir} className="min-h-dvh bg-paper">
      <header className="bg-navy text-navy-ink">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-3">
          <Logo />
          <div dir="ltr" className="text-ink">
            <LanguagePicker value={lang} onChange={setLang} />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-xl px-4 pb-16 pt-6">
        <section className="v-rise rounded-v-lg bg-card p-6 shadow-v-lg sm:p-8">
          {returned ? (
            <div className="text-center">
              <svg aria-hidden viewBox="0 0 48 48" className="mx-auto h-16 w-16">
                <circle cx="24" cy="24" r="22" fill="var(--v-success-soft)" />
                <path d="M14 25l7 7 13-15" fill="none" stroke="var(--v-success)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <h1 className="mt-3 text-2xl font-semibold text-success"><Tpl L={L} k="rc_returned" vars={{ sender: v.senderName }} /></h1>
              <En L={L} k="rc_returned" vars={{ sender: v.senderName }} className="text-base" />
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-semibold leading-tight">{L.t("rc_title")}</h1>
              <En L={L} k="rc_title" className="text-base" />
              <p className="mt-3 text-xl text-ink-2"><Tpl L={L} k="rc_body" vars={{ sender: v.senderName, amount: amount.localized }} /></p>
              <En L={L} k="rc_body" vars={{ sender: v.senderName, amount: amount.localized }} />
              <p dir="ltr" className="v-digits mt-6 text-center" aria-hidden>
                ${whole}
                <span className="text-ink-3">.{frac}</span>
              </p>
              <p className="mt-6 rounded-v bg-sky-soft p-4 text-ink">
                {L.t("rc_choice")}
                <En L={L} k="rc_choice" />
              </p>

              {v.state === "REFUSED" && (
                <p role="status" className="mt-4 rounded-v bg-paper-2 p-4 font-semibold">
                  {L.t("rc_refused", { sender: v.senderName })}
                  <En L={L} k="rc_refused" vars={{ sender: v.senderName }} className="font-normal" />
                </p>
              )}

              <button
                type="button"
                onClick={() => act("return")}
                disabled={busy !== null || Boolean(returning && v.returnState !== "CREATED")}
                className="mt-6 min-h-16 w-full rounded-full bg-brand px-8 text-xl font-semibold text-brand-ink shadow-v transition-transform hover:opacity-90 disabled:opacity-60"
              >
                {busy === "return" ? "…" : L.t("rc_return")}
                {busy !== "return" && <En L={L} k="rc_return" className="v-sub-on-dark" />}
              </button>
              {v.state !== "REFUSED" && (
                <button
                  type="button"
                  onClick={() => act("refuse")}
                  disabled={busy !== null}
                  className="mt-3 min-h-12 w-full rounded-full font-semibold text-ink-2 underline-offset-4 hover:underline"
                >
                  {busy === "refuse" ? "…" : L.t("rc_keep")}
                  {busy !== "refuse" && <En L={L} k="rc_keep" />}
                </button>
              )}
            </>
          )}
          {error && (
            <p role="alert" className="mt-4 rounded-v bg-terracotta-soft p-3 text-terracotta">
              {error}
            </p>
          )}
        </section>

        <section aria-labelledby="chat-title" className="mt-8">
          <h2 id="chat-title" className="text-lg font-semibold">
            {L.t("rc_chat", { sender: v.senderName })}
            <En L={L} k="rc_chat" vars={{ sender: v.senderName }} />
          </h2>
          <ol className="mt-3 space-y-3">
            {v.messages.map((m) => {
              const mine = m.author === "recipient";
              const original = originals.has(m.id);
              const shown = !mine && m.translatedText && !original ? m.translatedText : m.text;
              const showLang = !mine && m.translatedText && !original ? (m.translatedLang ?? m.lang) : m.lang;
              return (
                <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-v-lg px-4 py-3 ${mine ? "bg-brand text-brand-ink" : "bg-card shadow-v"}`}>
                    <p lang={showLang}>{shown}</p>
                    <EnText text={m.englishText} show={showLang.split("-")[0] !== "en" && m.englishText !== shown} className={mine ? "v-sub-on-dark" : ""} />
                    {!mine && (
                      <p className="mt-1 text-xs text-ink-3">
                        {m.translatedText ? L.t("rc_translated") : m.lang !== L.usedLang ? L.t("rc_untranslated") : ""}
                      </p>
                    )}
                    {!mine && m.translatedText && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        {m.numbers.length > 0 && (
                          <span className="rounded-full bg-success-soft px-2.5 py-1 font-medium text-success">
                            {L.t("numbers_checked", { numbers: m.numbers.join(", ") })}
                            <En L={L} k="numbers_checked" vars={{ numbers: m.numbers.join(", ") }} className="text-xs" />
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setOriginals((s) => {
                              const n = new Set(s);
                              if (n.has(m.id)) n.delete(m.id);
                              else n.add(m.id);
                              return n;
                            })
                          }
                          className="font-medium text-brand underline underline-offset-2"
                        >
                          {original ? L.t("show_translation") : L.t("show_original")}
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim()) void act("message");
            }}
          >
            <label htmlFor="msg" className="sr-only">
              {L.t("rc_placeholder")}
            </label>
            <input
              id="msg"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={L.t("rc_placeholder")}
              maxLength={1000}
              className="min-h-12 flex-1 rounded-full border-2 border-line bg-card px-5 outline-none focus:border-sky"
            />
            <button type="submit" disabled={!draft.trim() || busy !== null} className="min-h-12 rounded-full bg-brand px-5 font-semibold text-paper disabled:opacity-40">
              {L.t("rc_send")}
              <En L={L} k="rc_send" className="v-sub-on-dark text-xs" />
            </button>
          </form>
        </section>

        <p dir="ltr" className="mt-10 text-center text-xs text-ink-3">
          {L.machineTranslated && !L.reviewed ? "Page text is machine-translated and not yet reviewed by a native speaker. " : ""}
          PayPal sandbox demo — no real money. Verbo cannot take money from your account.
        </p>
      </main>
    </div>
  );
}
