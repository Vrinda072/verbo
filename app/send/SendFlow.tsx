"use client";
import { useEffect, useMemo, useState } from "react";
import { CONTACTS } from "@/lib/contacts";
import { LANGUAGES } from "@/lib/bridge/readback";
import { useSpeech, type SpeechProvider } from "@/lib/speech/useSpeech";
import { LanguagePicker } from "@/components/send/LanguagePicker";
import { MicButton } from "@/components/send/MicButton";
import { ConfirmCard, type UnderstandResponse } from "@/components/send/ConfirmCard";

type Phase = "input" | "understanding" | "review" | "creating" | "created" | "cancelled";

const PROBLEM_TEXT: Record<string, (p: Record<string, unknown>) => string> = {
  not_a_payment: () => "That didn’t sound like a payment. Try: “Send 20 dollars to Manuel Lopez”.",
  missing_recipient: () => "I couldn’t find a contact’s name in that. Say a full name from the list, or tap one.",
  recipient_not_found: (p) => `“${p.spoken}” isn’t in your contacts. Check the name.`,
  recipient_ambiguous: () => "More than one contact matches. Tap the right person:",
  missing_amount: () => "How much? Say or type the amount.",
  amount_invalid: () => "The amount wasn’t clear. Use digits, e.g. 12.50.",
  amount_out_of_range: () => "This demo only sends between $0.01 and $10,000.",
  amount_not_in_transcript: () => "The amount didn’t match what you said, so Verbo stopped. Please say it again.",
  currency_unsupported: (p) => `This demo sends US dollars only. Verbo won’t convert ${p.currency} for you.`,
};

const EXAMPLES: Record<string, string> = {
  en: "Send 12.34 dollars to Manuel Lopez",
  te: "మాన్యుయెల్ లోపెజ్ కి 12.34 డాలర్లు పంపండి",
  hi: "मैनुअल लोपेज़ को 25 डॉलर भेजो",
  es: "Envía 20 dólares a Manuel López",
  pt: "Envie 15 dólares para Manuel Lopes",
  ar: "أرسل 30 دولارا إلى مانويل لوبيز",
};

export function SendFlow({ holdMinutes, speechProvider }: { holdMinutes: number; speechProvider: SpeechProvider }) {
  const [lang, setLang] = useState("en");
  const [phase, setPhase] = useState<Phase>("input");
  const [result, setResult] = useState<UnderstandResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; approveUrl?: string; mode: string } | null>(null);
  const [nonce, setNonce] = useState("");
  const terms = useMemo(() => CONTACTS.map((c) => c.name), []);
  const mic = useSpeech(speechProvider, lang, terms);
  const langInfo = LANGUAGES.find((l) => l.code === lang);

  // Default to the browser language when we support it.
  useEffect(() => {
    const nav = navigator.language?.split("-")[0];
    if (nav && LANGUAGES.some((l) => l.code === nav)) setLang(nav);
  }, []);

  // When the mic finishes, check what was said.
  useEffect(() => {
    if (mic.status === "done" && mic.transcript) void check(mic.transcript);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mic.status]);

  async function check(text: string, chosenRecipient?: string) {
    setError(null);
    setPhase("understanding");
    try {
      const res = await fetch("/api/understand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: text, language: lang, chosenRecipient }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "error");
      const data = (await res.json()) as UnderstandResponse;
      setResult(data);
      setNonce(crypto.randomUUID());
      setPhase(data.ok ? "review" : "input");
    } catch {
      setError("Verbo couldn’t check that just now. Nothing was sent. Please try again.");
      setPhase("input");
    }
  }

  async function confirm(typedCents?: number) {
    if (!result?.draftId) return;
    setPhase("creating");
    setError(null);
    try {
      const res = await fetch("/api/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: result.draftId, nonce, typedCents }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setCreated(body);
      setPhase("created");
    } catch (e) {
      setError(
        (e as Error).message === "recipient_not_payable_in_demo"
          ? "This contact is part of the simulated address book and can’t receive sandbox money. Try Manuel Lopez or Manuel Lopes."
          : (e as Error).message === "draft_expired"
            ? "This check is more than 15 minutes old. Please say it again."
            : "PayPal didn’t accept the request. Nothing was sent.",
      );
      setPhase("review");
    }
  }

  function reset() {
    setResult(null);
    setCreated(null);
    setError(null);
    mic.setTranscript("");
    setPhase("input");
  }

  const reviewable = result?.ok && result.draftId && result.recipient && result.amount;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">Send by voice</h1>
          <p className="mt-2 text-lg text-ink-2">Say who and how much, in your language. You’ll check it before anything moves.</p>
        </div>
        <LanguagePicker value={lang} onChange={setLang} />
      </div>

      {(phase === "input" || phase === "understanding") && (
        <div className="mt-10 grid gap-8">
          {mic.status !== "unavailable" && (
            <div>
              <p className="mb-4 text-center text-lg">
                Listening in{" "}
                <strong lang={lang} dir={langInfo?.dir}>
                  {langInfo?.nativeName ?? lang}
                </strong>
                {langInfo && langInfo.nativeName !== langInfo.englishName && <span className="text-ink-3"> ({langInfo.englishName})</span>}
                <span className="block text-sm text-ink-3">Speak this language, or change it with the language button above.</span>
              </p>
              <MicButton status={mic.status} analyser={mic.analyser} onStart={mic.start} onStop={mic.stop} />
            </div>
          )}

          <section aria-labelledby="contacts-title" className="mx-auto w-full max-w-xl text-center">
            <h2 id="contacts-title" className="text-sm font-bold uppercase tracking-wider text-ink-3">
              People you can pay (simulated)
            </h2>
            <ul className="mt-2 flex flex-wrap justify-center gap-2">
              {CONTACTS.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => mic.setTranscript(`${mic.transcript} ${c.name}`.trim())}
                    className="min-h-11 rounded-full border border-line-strong bg-card px-4 font-bold hover:bg-paper-2"
                  >
                    {c.name}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {(mic.status === "unavailable" || mic.status === "error") && (
            <p role="status" className="mx-auto max-w-xl rounded-v border border-marigold/70 bg-marigold-soft p-4 text-center text-marigold-ink">
              {mic.error ?? "Your browser doesn’t support speech recognition. Chrome, Edge and Safari do."} You can also type — everything else works the same.
            </p>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (mic.transcript.trim()) void check(mic.transcript.trim());
            }}
            className="mx-auto w-full max-w-xl"
          >
            <label htmlFor="transcript" className="block text-sm font-bold uppercase tracking-wider text-ink-3">
              {mic.status === "listening" ? "Hearing…" : "What you said (you can edit it)"}
            </label>
            <textarea
              id="transcript"
              lang={lang}
              dir={langInfo?.dir}
              rows={2}
              value={mic.transcript}
              onChange={(e) => mic.setTranscript(e.target.value)}
              placeholder={EXAMPLES[lang] ?? EXAMPLES.en}
              aria-live="polite"
              className="mt-2 w-full resize-none rounded-v-lg border-2 border-line bg-card px-5 py-4 text-2xl leading-snug outline-none focus:border-sky"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-sm text-ink-3">Try: “{EXAMPLES[lang] ?? EXAMPLES.en}”</p>
              <button
                type="submit"
                disabled={!mic.transcript.trim() || phase === "understanding" || mic.status === "listening"}
                className="min-h-12 shrink-0 rounded-full bg-ink px-6 font-bold text-paper disabled:opacity-40"
              >
                {phase === "understanding" ? "Checking…" : "Check"}
              </button>
            </div>
          </form>

          {result && !result.ok && (
            <div role="alert" className="mx-auto w-full max-w-xl rounded-v-lg border border-terracotta/50 bg-terracotta-soft p-5">
              <p className="font-bold text-terracotta">Nothing was sent. Verbo needs a bit more:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {result.problems.map((p, i) => (
                  <li key={i}>
                    {PROBLEM_TEXT[p.code]?.(p) ?? p.code}
                    {p.code === "recipient_ambiguous" && (
                      <span className="mt-2 flex flex-wrap gap-2">
                        {(p.candidates as string[]).map((name) => (
                          <button
                            key={name}
                            type="button"
                            onClick={() => void check(mic.transcript.trim(), name)}
                            className="min-h-12 rounded-full border-2 border-line-strong bg-card px-5 font-bold hover:bg-paper-2"
                          >
                            {name}
                          </button>
                        ))}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {error && (
            <p role="alert" className="mx-auto max-w-xl rounded-v border border-terracotta/50 bg-terracotta-soft p-4 text-center">
              {error}
            </p>
          )}
        </div>
      )}

      {(phase === "review" || phase === "creating") && reviewable && (
        <div className="mt-10">
          <ConfirmCard
            data={result as Parameters<typeof ConfirmCard>[0]["data"]}
            lang={lang}
            holdMinutes={holdMinutes}
            busy={phase === "creating"}
            onConfirm={confirm}
            onEdit={() => setPhase("input")}
            onCancel={() => setPhase("cancelled")}
          />
          {error && (
            <p role="alert" className="mx-auto mt-4 max-w-xl rounded-v border border-terracotta/50 bg-terracotta-soft p-4 text-center">
              {error}
            </p>
          )}
        </div>
      )}

      {phase === "cancelled" && (
        <Done title="Cancelled. No money moved." body="Nothing was sent to PayPal." onAgain={reset} />
      )}

      {phase === "created" && created && result?.recipient && result.amount && (
        <div className="v-rise mx-auto mt-10 max-w-xl rounded-v-lg border border-line bg-card p-8 text-center shadow-v-lg">
          <p className="text-sm font-bold uppercase tracking-wider text-evergreen">Confirmed</p>
          <h2 className="mt-2 font-display text-3xl font-semibold">
            One last step on PayPal: approve ${result.amount.digits} to {result.recipient.name}
          </h2>
          <p className="mt-3 text-ink-2">
            PayPal only authorizes the payment at this point. Verbo sends it after approval
            {result.risk?.hold ? ` and a ${holdMinutes}-minute safety hold` : ""}.
            {created.mode === "mock" && " (Offline demo mode: no real sandbox call.)"}
          </p>
          <a
            href={created.approveUrl ?? `/send/t/${created.id}`}
            className="mt-6 inline-flex min-h-14 items-center rounded-full bg-evergreen px-8 text-lg font-bold text-evergreen-ink shadow-v"
          >
            Approve on PayPal
          </a>
          <button type="button" onClick={reset} className="mt-4 block w-full text-ink-3 underline">
            Start again
          </button>
        </div>
      )}
    </div>
  );
}

function Done({ title, body, onAgain }: { title: string; body: string; onAgain: () => void }) {
  return (
    <div className="v-rise mx-auto mt-10 max-w-xl rounded-v-lg border border-line bg-card p-8 text-center shadow-v">
      <h2 className="font-display text-3xl font-semibold">{title}</h2>
      <p className="mt-2 text-ink-2">{body}</p>
      <button type="button" onClick={onAgain} className="mt-6 min-h-12 rounded-full bg-evergreen px-6 font-bold text-evergreen-ink">
        Start again
      </button>
    </div>
  );
}
