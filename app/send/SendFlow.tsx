"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { CONTACTS } from "@/lib/contacts";
import { labelsFor, languageNameIn } from "@/lib/bridge/readback";
import { En } from "@/components/En";
import { ANSWER_MS, matchChoice, MAX_FOLLOW_UPS, mergeAnswer, nextQuestion, questionParts, questionText, SPEECH_TIMEOUT_MS, type Question } from "@/lib/speech/clarify";
import { useReadAloud } from "@/lib/speech/useReadAloud";
import { useSpeech, type SpeechProvider } from "@/lib/speech/useSpeech";
import { LanguagePicker } from "@/components/send/LanguagePicker";
import { MicButton } from "@/components/send/MicButton";
import { NameDiff } from "@/components/NameDiff";
import { ConfirmCard, type UnderstandResponse } from "@/components/send/ConfirmCard";
import { Stepper } from "@/components/send/Stepper";
import { PayNumber, type NumberResponse } from "@/components/send/PayNumber";
import dynamic from "next/dynamic";

const PeopleGrid = dynamic(() => import("@/components/send/PeopleGrid"), { ssr: false, loading: () => <p className="text-ink-3">Loading contacts…</p> });

/** Requests that show each check. Judges can say or type them. */
const TRY = [
  { say: "Send 40 dollars to Manuel Lopez", shows: "Names that sound alike, in Spanish and Portuguese" },
  { say: "Send 30 dollars to Mohamed Ali", shows: "Mohamed or Mohamad: Arabic or English" },
  { say: "Send 20 dollars to Ana Souza", shows: "Souza or Sousa: Portuguese or Spanish" },
  { say: "Send sixty dollars to Kiran Reddy", shows: "An amount in words must be typed in digits" },
  { say: "Send 900 dollars to Ana Souza right now, it's urgent", shows: "Pressure, a first payment and a large amount: held" },
];

type Phase = "input" | "understanding" | "review" | "creating" | "created" | "cancelled";

const PROBLEM_TEXT: Record<string, (p: Record<string, unknown>) => string> = {
  not_a_payment: () => "This doesn’t look like a payment. For example: “Send 20 dollars to Manuel Lopez”.",
  missing_recipient: () => "No contact name was found. Say a full name from your contacts.",
  recipient_not_found: (p) => `“${p.spoken}” isn’t in your contacts. Check the name.`,
  recipient_ambiguous: () => "Two contacts have similar names. Select the recipient:",
  missing_amount: () => "Please say or enter one amount.",
  amount_invalid: () => "The amount wasn’t clear. Use digits, e.g. 12.50.",
  amount_out_of_range: () => "This demo only sends between $0.01 and $10,000.",
  amount_not_in_transcript: () => "The amount doesn’t match the transcript. Please try again.",
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
  const heardByVoice = useRef("");
  const [typing, setTyping] = useState(false);
  const [question, setQuestion] = useState<Question | null>(null);
  const followUps = useRef(0);
  const chosenName = useRef<string | undefined>(undefined);
  // What has been understood so far. A failed answer is left out, so "banana" can't muddle the next attempt.
  const base = useRef("");
  const askedKind = useRef<Question["kind"] | null>(null);
  const L = labelsFor(lang);
  const [payingNumber, setPayingNumber] = useState(false);
  const askRef = useRef<HTMLHeadingElement>(null);
  const questionLine = question ? questionText(question, L) : "";
  const voice = useReadAloud(questionLine, L.usedLang, question ? questionParts(question) : undefined);
  const micStatus = useRef(mic.status);
  micStatus.current = mic.status;
  // Move focus to the question so screen readers and keyboards land on it, not on the page body.
  useEffect(() => {
    if (result && !result.ok) askRef.current?.focus();
  }, [result]);
  const step = phase === "created" ? 2 : phase === "review" || phase === "creating" ? 1 : 0;
  const working = phase === "understanding" || mic.status === "finishing";

  // English is the default; the sender picks their language with the picker.

  // When the mic finishes, check what was said.
  useEffect(() => {
    if (mic.status === "done" && mic.transcript) {
      if (question) {
        void answer(question, mic.transcript);
        return;
      }
      heardByVoice.current = mic.transcript;
      base.current = mic.transcript;
      followUps.current = 0;
      chosenName.current = undefined;
      void check(mic.transcript);
    }
    if (mic.status === "error") setQuestion(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mic.status]);

  // Ask aloud, then listen. Without a voice for this language the question stays on screen and the person taps the mic.
  useEffect(() => {
    if (!question) return;
    let done = false;
    const listen = () => {
      if (done || micStatus.current === "listening" || micStatus.current === "connecting") return;
      done = true;
      void mic.start();
    };
    if (new URLSearchParams(window.location.search).has("quiet")) {
      const t = setTimeout(listen, 400);
      return () => clearTimeout(t);
    }
    if (!voice.available) return;
    void voice.play(listen);
    const t = setTimeout(listen, SPEECH_TIMEOUT_MS);
    return () => {
      done = true;
      clearTimeout(t);
    };
    // Once per question.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question]);

  // A follow-up answer is short, so recording ends by itself. The person doesn't need to touch the screen.
  useEffect(() => {
    if (!question || mic.status !== "listening") return;
    const t = setTimeout(() => mic.stop(), ANSWER_MS[question.kind]);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, mic.status]);

  function ask(q: Question | null) {
    if (q && followUps.current < MAX_FOLLOW_UPS) {
      followUps.current += 1;
      setQuestion({ ...q });
    } else setQuestion(null);
  }

  function answer(q: Question, said: string) {
    const original = base.current;
    if (q.kind === "which") {
      heardByVoice.current = original;
      mic.setTranscript(original);
      const pick = matchChoice(said);
      if (!pick) return ask(q); // Unclear: ask again rather than guess.
      setQuestion(null);
      chosenName.current = pick === 1 ? q.a : q.b;
      return check(original);
    }
    setQuestion(null);
    const merged = mergeAnswer(original, said);
    heardByVoice.current = merged;
    askedKind.current = q.kind;
    mic.setTranscript(merged);
    return check(merged);
  }

  async function check(text: string, tapped?: string) {
    const chosenRecipient = tapped ?? chosenName.current;
    if (tapped) chosenName.current = tapped;
    setError(null);
    setPhase("understanding");
    try {
      const res = await fetch("/api/understand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: text, language: lang, chosenRecipient, fromVoice: text === heardByVoice.current }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "error");
      const data = (await res.json()) as UnderstandResponse;
      setResult(data);
      setNonce(crypto.randomUUID());
      setPhase(data.ok ? "review" : "input");
      const next = !data.ok && text === heardByVoice.current ? nextQuestion(data.problems) : null;
      if (askedKind.current && next?.kind !== askedKind.current) base.current = text;
      askedKind.current = null;
      ask(next);
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
    setTyping(false);
    setQuestion(null);
    followUps.current = 0;
    chosenName.current = undefined;
    setPhase("input");
  }

  const reviewable = result?.ok && result.draftId && result.recipient && result.amount;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 lang={L.usedLang} dir={L.dir} className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {L.t("s_heading")}
            <En L={L} k="s_heading" className="text-base font-normal tracking-normal" />
          </h1>
          <div className="mt-4">
            <Stepper current={step} L={L} />
          </div>
        </div>
        <LanguagePicker value={lang} onChange={setLang} />
      </div>

      {(phase === "input" || phase === "understanding") && (
        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="grid gap-6">
            {mic.status !== "unavailable" && (
              <section aria-label="Microphone" className="rounded-v-lg bg-card px-6 py-10 text-center shadow-v sm:py-12">
                {working ? (
                  <Working stage={phase === "understanding" ? 1 : 0} />
                ) : (
                  <>
                    {question ? (
                      <div role="status" className="mb-6">
                        <p lang={L.usedLang} dir={L.dir} className="text-sm text-ink-3">
                          {L.t(voice.speaking ? "s_asking" : "s_answer")}
                          <En L={L} k={voice.speaking ? "s_asking" : "s_answer"} className="text-xs" />
                        </p>
                        <p lang={L.usedLang} dir={L.dir} className="mx-auto mt-1 max-w-lg text-2xl font-medium leading-snug">
                          {questionLine}
                        </p>
                        {L.usedLang !== "en" && (
                          <p lang="en" dir="ltr" className="v-sub mx-auto max-w-lg text-base">
                            {questionText(question, labelsFor("en"))}
                          </p>
                        )}
                      </div>
                    ) : (
                    <p lang={L.usedLang} dir={L.dir} className="mb-6 text-xl font-medium">
                      {L.t("s_say")}
                      <En L={L} k="s_say" className="text-base" />
                    </p>
                    )}
                    <MicButton status={mic.status} analyser={mic.analyser} onStart={mic.start} onStop={mic.stop} />
                  </>
                )}
              </section>
            )}

            {(mic.status === "unavailable" || mic.status === "error") && (
              <p role="status" className="rounded-v border border-marigold/70 bg-marigold-soft p-4 text-center text-marigold-ink">
                {mic.error ?? "Your browser doesn’t support recording. Chrome, Edge and Safari do."} You can also type the payment.
              </p>
            )}

            {typing || mic.transcript || mic.status === "unavailable" || mic.status === "error" ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (mic.transcript.trim()) void check(mic.transcript.trim());
                }}
              >
                <label htmlFor="transcript" className="block text-sm font-semibold text-ink-3">
                  What you said (you can edit it)
                </label>
                <textarea
                  id="transcript"
                  lang={lang}
                  dir="auto"
                  rows={2}
                  value={mic.transcript}
                  onChange={(e) => mic.setTranscript(e.target.value)}
                  placeholder={EXAMPLES[lang] ?? EXAMPLES.en}
                  aria-live="polite"
                  className="mt-2 w-full resize-none rounded-v border border-line-strong bg-card px-4 py-3 text-lg leading-snug outline-none focus:border-sky"
                />
                <div className="mt-3 flex justify-end">
                  <button
                    type="submit"
                    disabled={!mic.transcript.trim() || phase === "understanding" || mic.status === "listening"}
                    className="min-h-12 shrink-0 rounded-full bg-brand px-6 font-semibold text-paper disabled:opacity-40"
                  >
                    {phase === "understanding" ? "…" : <span lang={L.usedLang}>{L.t("s_check")}</span>}
                    {phase !== "understanding" && <En L={L} k="s_check" className="v-sub-on-dark text-xs" />}
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap justify-center gap-2">
                <button type="button" onClick={() => setTyping(true)} className="min-h-12 rounded-full px-5 font-semibold text-brand hover:bg-brand-soft">
                  <span lang={L.usedLang}>{L.t("s_type")}</span>
                  <En L={L} k="s_type" className="text-xs" />
                </button>
                {!payingNumber && (
                  <button type="button" onClick={() => setPayingNumber(true)} className="min-h-12 rounded-full px-5 font-semibold text-brand hover:bg-brand-soft">
                    <span lang={L.usedLang}>{L.t("s_pay_number")}</span>
                    <En L={L} k="s_pay_number" className="text-xs" />
                  </button>
                )}
              </div>
            )}

          {result && !result.ok && (!question || question.kind === "which") && (
            <div className="mx-auto w-full max-w-xl rounded-v-lg bg-marigold-soft p-5 text-marigold-ink">
              <h2 ref={askRef} tabIndex={-1} lang={L.usedLang} dir={L.dir} className="text-lg font-semibold outline-none">
                {result.problems.some((p) => p.code === "recipient_ambiguous") ? L.t("s_which") : L.t("s_problem")}
                <En L={L} k={result.problems.some((p) => p.code === "recipient_ambiguous") ? "s_which" : "s_problem"} />
              </h2>
              <ul className="mt-2 space-y-1">
                {result.problems.map((p, i) => (
                  <li key={i}>
                    {p.code !== "recipient_ambiguous" && (PROBLEM_TEXT[p.code]?.(p) ?? p.code)}
                    {(p.code === "recipient_not_found" || p.code === "missing_recipient") && (
                      <span className="mt-2 block">
                        <span className="block">Or select a recipient:</span>
                        <span className="mt-2 flex flex-wrap gap-2">
                          {CONTACTS.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => void check(mic.transcript.trim(), c.name)}
                              className="min-h-12 rounded-full border-2 border-line-strong bg-card px-5 font-semibold hover:bg-paper-2"
                            >
                              {c.name}
                            </button>
                          ))}
                        </span>
                      </span>
                    )}
                    {p.code === "recipient_ambiguous" && (
                      <span className="mt-3 grid gap-2">
                        {(p.candidates as string[]).map((name, n) => {
                          const c = CONTACTS.find((x) => x.name === name);
                          return (
                            <button
                              key={name}
                              type="button"
                              onClick={() => void check(mic.transcript.trim(), name)}
                              className="flex min-h-14 items-center gap-3 rounded-v border-2 border-line bg-card px-4 py-2 text-start text-ink hover:border-brand"
                            >
                              <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-navy text-sm font-semibold text-navy-ink">{n + 1}</span>
                              <span>
                                <span className="block text-lg font-semibold">
                                  <NameDiff name={name} other={(p.candidates as string[]).find((x) => x !== name) ?? name} />
                                </span>
                                {c && (
                                  <span lang={L.usedLang} className="block text-sm text-ink-2">
                                    {languageNameIn(c.language, L.usedLang)} · {c.city} · {L.t(c.paidBefore ? "opt_paid" : "opt_new")}
                                  </span>
                                )}
                              </span>
                            </button>
                          );
                        })}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {payingNumber && (
          <section className="rounded-v-lg bg-card p-6 shadow-v">
            <PayNumber
              lang={lang}
              onClose={() => setPayingNumber(false)}
              onReview={(r: NumberResponse) => {
                heardByVoice.current = "";
                setResult(r);
                setNonce(crypto.randomUUID());
                setPhase("review");
              }}
            />
          </section>
          )}
          {error && (
            <p role="alert" className="mx-auto max-w-xl rounded-v border border-terracotta/50 bg-terracotta-soft p-4 text-center">
              {error}
            </p>
          )}
          </div>

          <aside className="grid content-start gap-6">
            <details className="group rounded-v-lg bg-navy p-6 text-navy-ink">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 text-lg font-semibold">
                Examples to try (simulated)
                <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
              </summary>
              <ul className="mt-3 grid gap-2">
                {TRY.map((t) => (
                  <li key={t.say}>
                    <button
                      type="button"
                      onClick={() => {
                        setTyping(true);
                        mic.setTranscript(t.say);
                      }}
                      className="w-full rounded-v bg-navy-2 px-4 py-3 text-left hover:bg-white/10"
                    >
                      <span className="block font-medium">“{t.say}”</span>
                      <span className="block text-sm text-navy-ink/75">{t.shows}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm text-navy-ink/75">
                Or pay +1 (408) 555-0139: one digit off Kiran Reddy&apos;s number, it reaches someone who reads Arabic.
              </p>
            </details>
          </aside>
        </div>
      )}

      {(phase === "input" || phase === "understanding") && (
        <details className="group mt-10">
          <summary className="flex min-h-12 cursor-pointer list-none flex-wrap items-baseline justify-between gap-3">
            <span className="text-2xl font-bold">
              People you can pay <span className="text-base font-normal text-ink-3">({CONTACTS.length}, simulated)</span>
            </span>
            <span className="text-sm font-semibold text-brand group-open:hidden">Show all</span>
          </summary>
          <p className="mb-3 text-sm text-ink-3">Grouped by how the names sound. Click a person to use their name.</p>
          <PeopleGrid
            onPick={(name) => {
              setTyping(true);
              mic.setTranscript(`${mic.transcript} ${name}`.trim());
            }}
          />
        </details>
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
        <div className="v-rise mx-auto mt-10 max-w-xl rounded-v-lg bg-card p-8 text-center shadow-v-lg">
          <p className="text-sm font-semibold text-brand">Confirmed</p>
          <h2 className="mt-2 text-2xl font-semibold">
            One last step on PayPal: approve ${result.amount.digits} to {result.recipient.name}
          </h2>
          <p className="mt-3 text-ink-2">
            PayPal only authorizes the payment at this point. Verbo sends it after approval
            {result.risk?.hold ? ` and a ${holdMinutes}-minute safety hold` : ""}.
            {created.mode === "mock" && " (Offline demo mode: no real sandbox call.)"}
          </p>
          <a
            href={created.approveUrl ?? `/send/t/${created.id}`}
            className="mt-6 inline-flex min-h-14 items-center rounded-full bg-brand px-8 text-lg font-semibold text-brand-ink shadow-v"
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

function Working({ stage }: { stage: 0 | 1 }) {
  const lines = ["Transcribing", "Checking recipient, amount and risk"];
  return (
    <div role="status" className="mx-auto flex max-w-sm flex-col gap-4 py-10 text-left">
      {lines.map((line, i) => (
        <p key={line} className={`flex items-center gap-3 text-xl font-semibold ${i > stage ? "text-ink-3" : ""}`}>
          {i < stage ? (
            <span aria-hidden className="grid h-7 w-7 place-items-center rounded-full bg-brand text-sm text-brand-ink">✓</span>
          ) : i === stage ? (
            <span aria-hidden className="v-spin h-7 w-7 rounded-full border-4 border-line-strong border-t-brand" />
          ) : (
            <span aria-hidden className="h-7 w-7 rounded-full border-2 border-line-strong" />
          )}
          {line}
        </p>
      ))}
      <p className="text-ink-3">No money moves until you confirm.</p>
    </div>
  );
}

function Done({ title, body, onAgain }: { title: string; body: string; onAgain: () => void }) {
  return (
    <div className="v-rise mx-auto mt-10 max-w-xl rounded-v-lg bg-card p-8 text-center shadow-v">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <p className="mt-2 text-ink-2">{body}</p>
      <button type="button" onClick={onAgain} className="mt-6 min-h-12 rounded-full bg-brand px-6 font-semibold text-brand-ink">
        Start again
      </button>
    </div>
  );
}
