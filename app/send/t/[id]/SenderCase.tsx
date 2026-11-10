"use client";
import { useCallback, useEffect, useState } from "react";
import { labelsFor, LANGUAGES } from "@/lib/bridge/readback";
import type { SenderCaseView } from "@/lib/recovery/views";

const EVENT_TEXT: Record<string, string> = {
  OPENED: "You asked for the money back",
  LINK_SENT: "Link sent (simulated delivery)",
  VIEWED: "They opened the link",
  REPLIED: "They replied",
  MESSAGE: "You wrote",
  RETURN_STARTED: "They started returning it on PayPal",
  RETURNED: "They returned the money",
  REFUSED: "They said the money is theirs",
  REMINDER_SENT: "Reminder sent (24 h)",
  ESCALATED: "Escalated to the Case Desk (72 h)",
  CLOSED: "Case closed",
};

/** Sender side of a recovery case: ask for it back → status timeline + translated conversation. */
export function SenderCase({ transferId, lang, initialCaseId }: { transferId: string; lang: string; initialCaseId: string | null }) {
  const [c, setC] = useState<SenderCaseView | null>(null);
  const [caseId, setCaseId] = useState(initialCaseId);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<string[]>([]);
  const [drafting, setDrafting] = useState(false);
  const L = labelsFor(lang);
  const nameOf = (code: string) => LANGUAGES.find((l) => l.code === code)?.englishName ?? code;

  const refresh = useCallback(async () => {
    if (!caseId) return;
    const r = await fetch(`/api/cases/${caseId}`, { cache: "no-store" });
    if (r.ok) setC(await r.json());
  }, [caseId]);

  useEffect(() => {
    void refresh();
    if (!caseId) return;
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, [caseId, refresh]);

  const suggest = useCallback(async () => {
    if (!caseId) return;
    setDrafting(true);
    const r = await fetch(`/api/cases/${caseId}/coach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lang: L.usedLang }),
    }).catch(() => null);
    const body = r?.ok ? await r.json() : null;
    setIdeas(body?.suggestions ?? []);
    setDrafting(false);
  }, [caseId, L.usedLang]);

  // New suggestions only when the conversation or status changes, not on every status poll.
  const turn = c ? `${c.messages.length}:${c.state}` : null;
  useEffect(() => {
    if (turn) void suggest();
  }, [turn, suggest]);

  async function open() {
    setBusy(true);
    setError(null);
    const r = await fetch("/api/cases", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transferId }) });
    const body = await r.json();
    if (r.ok) {
      setC(body);
      setCaseId(body.id);
    } else setError("Couldn’t open a case. Please try again.");
    setBusy(false);
  }

  async function send() {
    if (!caseId || !draft.trim()) return;
    setBusy(true);
    const r = await fetch(`/api/cases/${caseId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: draft, lang: L.usedLang }),
    });
    if (r.ok) {
      setC(await r.json());
      setDraft("");
    }
    setBusy(false);
  }

  if (!caseId)
    return (
      <div className="mt-8 border-t border-line pt-6">
        <button
          type="button"
          onClick={open}
          disabled={busy}
          className="min-h-14 w-full rounded-v border-2 border-terracotta/60 px-6 text-lg font-semibold text-terracotta hover:bg-terracotta-soft disabled:opacity-60"
        >
          <span lang={L.usedLang}>{busy ? "…" : L.t("ask_back")}</span>
        </button>
        {error && <p className="mt-2 text-terracotta">{error}</p>}
      </div>
    );

  if (!c) return <p className="mt-8 text-ink-3">Loading case…</p>;
  const returned = c.state === "RETURNED" || c.state === "CLOSED";

  return (
    <div className="mt-8 border-t border-line pt-6 text-left">
      {returned ? (
        <p lang={L.usedLang} dir={L.dir} className="rounded-v bg-brand-soft p-4 text-lg font-semibold text-brand">
          {L.t("returned_sender", { recipient: c.recipientName })}
        </p>
      ) : (
        <p lang={L.usedLang} dir={L.dir} className="rounded-v bg-sky-soft p-4 font-semibold">
          {L.t("case_sent", { recipient: c.recipientName })}
        </p>
      )}
      <p className="mt-2 text-sm text-ink-3">
        Their page is in {nameOf(c.recipientLanguage)}. Delivery is simulated in this demo —{" "}
        {c.link && (
          <a href={c.link} target="_blank" rel="noreferrer" className="font-semibold text-sky underline">
            open their page
          </a>
        )}
        .
      </p>

      <ol className="mt-5 space-y-2 border-l-2 border-line pl-4">
        {c.events.map((e, i) => (
          <li key={i} className="text-sm">
            <span className="font-semibold">{EVENT_TEXT[e.event] ?? e.event}</span>{" "}
            <time className="text-ink-3" dateTime={e.at}>
              {new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </time>
          </li>
        ))}
      </ol>

      <h3 className="mt-6 font-semibold">Messages</h3>
      <ol className="mt-2 space-y-2">
        {c.messages.map((m) => {
          const mine = m.author === "sender";
          const shown = !mine && m.translatedText ? m.translatedText : m.text;
          return (
            <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-v-lg px-4 py-2 ${mine ? "bg-brand-soft" : "border border-line bg-card"}`}>
                <p lang={!mine && m.translatedText ? (m.translatedLang ?? m.lang) : m.lang}>{shown}</p>
                {!mine && (
                  <p className="mt-1 text-xs text-ink-3">
                    {m.translatedText ? `Translated from ${nameOf(m.lang)}` : m.lang !== L.usedLang ? `Not translated (${nameOf(m.lang)})` : ""}
                  </p>
                )}
              </div>
            </li>
          );
        })}
        {!c.messages.length && <li className="text-sm text-ink-3">No messages yet.</li>}
      </ol>
      {!returned && (drafting || ideas.length > 0) && (
        <section aria-label="Suggested messages" className="mt-4 rounded-v bg-paper p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h4 className="text-sm font-semibold">Suggested by AI</h4>
            {!drafting && (
              <button type="button" onClick={() => void suggest()} className="text-sm font-medium text-brand">
                Try other wording
              </button>
            )}
          </div>
          {drafting ? (
            <p role="status" className="mt-2 text-sm text-ink-3">Writing suggestions…</p>
          ) : (
            <ul className="mt-2 grid gap-2">
              {ideas.map((idea) => (
                <li key={idea}>
                  <button
                    type="button"
                    lang={L.usedLang}
                    dir={L.dir}
                    onClick={() => setDraft(idea)}
                    aria-pressed={draft === idea}
                    className={`w-full rounded-v bg-card px-4 py-3 text-left shadow-v ${draft === idea ? "ring-2 ring-brand" : ""}`}
                  >
                    {idea}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-ink-3">Choose one to edit it. Nothing is sent until you press send.</p>
        </section>
      )}
      <form
        className="mt-3 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <label htmlFor="sender-msg" className="sr-only">
          Message to {c.recipientName}
        </label>
        <textarea
          id="sender-msg"
          rows={draft.length > 50 ? 4 : 1}
          lang={L.usedLang}
          dir={L.dir}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={L.t("rc_placeholder")}
          className="min-h-12 flex-1 resize-none rounded-v border-2 border-line bg-card px-4 py-2.5 outline-none focus:border-sky"
        />
        <button type="submit" disabled={!draft.trim() || busy} className="min-h-12 rounded-full bg-brand px-5 font-semibold text-paper disabled:opacity-40">
          <span lang={L.usedLang}>{L.t("rc_send")}</span>
        </button>
      </form>
    </div>
  );
}
