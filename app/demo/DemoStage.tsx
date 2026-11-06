"use client";
import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { labelsFor } from "@/lib/bridge/readback";

/**
 * A scripted walkthrough of one mistaken payment, for people who want the story in a minute. It calls nothing and moves
 * nothing. Screen text comes from Verbo's own templates. The chat lines are real Gemini translations, generated on
 * Nov 6, 2026 and saved here so the walkthrough works without a key or quota.
 */
const hi = labelsFor("hi");
const pt = labelsFor("pt");
const AMOUNT = "$40.00";
const WRONG = "Manuel Lopes";
const RIGHT = "Manuel Lopez";
const SENDER = "Sreenivas";
const SAID = "मैनुअल लोपेज़ को 40 डॉलर भेज दो";

const CHAT = [
  {
    from: "sender" as const,
    hi: "मैंने गलती से आपको 40 डॉलर भेज दिए। वे मेरे दोस्त मैनुअल लोपेज़ के लिए थे। क्या आप कृपया उन्हें वापस कर सकते हैं?",
    pt: "Eu mandei 40 dólares para você por engano. Eles eram para o meu amigo Manuel López. Você poderia devolvê-los, por favor?",
  },
  {
    from: "recipient" as const,
    pt: "Oi! Eu vi o dinheiro e não sabia de quem era. Claro, vou devolver agora.",
    hi: "नमस्ते! मैंने पैसे देख लिए और मुझे नहीं पता था कि यह किसके हैं। बिल्कुल, मैं अभी वापस कर दूंगा।",
  },
];

type Where = "sender" | "hold" | "recipient";

interface Step {
  title: string;
  story: string;
  under: string;
  where: Where;
  active: "sender" | "recipient" | "both";
  sender: ReactNode;
  recipient: ReactNode;
}

const Asleep = () => (
  <div className="flex h-full items-center justify-center p-6 text-center text-ink-3">
    <p>Manuel hasn’t been contacted yet.</p>
  </div>
);

const Hi = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <span lang="hi" className={className}>
    {children}
  </span>
);
const Pt = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <span lang="pt" className={className}>
    {children}
  </span>
);

const Warn = ({ children }: { children: ReactNode }) => (
  <p className="rounded-v border border-marigold/70 bg-marigold-soft p-3 text-sm font-bold text-marigold-ink">{children}</p>
);

const PhoneButton = ({ children, tone = "plain", selected = false }: { children: ReactNode; tone?: "go" | "plain"; selected?: boolean }) => (
  <div
    className={`flex min-h-12 items-center justify-center rounded-full px-4 text-center font-bold ${
      tone === "go" ? "bg-evergreen text-evergreen-ink" : "border-2 border-line-strong"
    } ${selected ? "ring-4 ring-marigold" : ""}`}
  >
    {children}
  </div>
);

const Bubble = ({ mine, text, lang, translated }: { mine: boolean; text: string; lang: string; translated: boolean }) => (
  <div className={`max-w-[88%] rounded-v p-3 text-sm ${mine ? "self-end bg-evergreen-soft" : "self-start bg-paper-2"}`}>
    <p lang={lang}>{text}</p>
    {translated && (
      <p className="mt-1 text-xs text-ink-3" lang={lang}>
        {lang === "hi" ? hi.t("rc_translated") : pt.t("rc_translated")}
      </p>
    )}
  </div>
);

const STEPS: Step[] = [
  {
    title: "Sreenivas says the payment in Hindi",
    story: "Sreenivas speaks Hindi. He wants to pay his friend Manuel Lopez $40, so he taps the mic and says it.",
    under: "Verbo records until he taps stop, so a pause can't cut him off. Whisper writes down his words.",
    where: "sender",
    active: "sender",
    sender: (
      <div className="flex h-full flex-col items-center justify-center gap-5 p-5 text-center">
        <div className="grid h-24 w-24 place-items-center rounded-full bg-terracotta text-paper">
          <span className="v-pulse absolute h-24 w-24 rounded-full border-4 border-terracotta" aria-hidden />
          <span aria-hidden className="h-8 w-8 rounded-md bg-paper" />
        </div>
        <Hi className="font-display text-2xl leading-snug">“{SAID}”</Hi>
        <p className="text-xs text-ink-3">“Send 40 dollars to Manuel Lopez”</p>
      </div>
    ),
    recipient: <Asleep />,
  },
  {
    title: "He chooses between two similar names",
    story: `He has two contacts: ${RIGHT} and ${WRONG}. Speech can't reliably tell them apart, so Verbo won't guess. He has to choose, and in a hurry he taps the wrong one.`,
    under: "AI only fills in fields. Code matches the name against his contacts, and a person makes the final choice.",
    where: "sender",
    active: "sender",
    sender: (
      <div className="flex h-full flex-col justify-center gap-3 p-5">
        <p className="font-bold">These names sound alike, so Verbo won’t guess. Tap the right person:</p>
        <PhoneButton>{RIGHT}</PhoneButton>
        <PhoneButton selected>{WRONG}</PhoneButton>
      </div>
    ),
    recipient: <Asleep />,
  },
  {
    title: "Verbo reads it back in Hindi",
    story: "The read-back appears and is spoken aloud in Hindi, with big digits. He has never paid this person, and the name is nearly identical to a friend's, so the risk score is high.",
    under: "The sentence comes from a fixed template, never from AI. Code inserts the name and amount, so a model can't change what he hears.",
    where: "sender",
    active: "sender",
    sender: (
      <div className="flex h-full flex-col gap-3 p-5">
        <Hi className="text-lg font-bold">{hi.t("readback", { amount: AMOUNT, recipient: WRONG })}</Hi>
        <p className="v-digits !text-5xl">$40<span className="text-ink-3">.00</span></p>
        <Warn>
          <Hi>{hi.t("lookalike", { other: RIGHT })}</Hi>
        </Warn>
        <Warn>
          <Hi>{hi.t("hold_notice", { minutes: "10" })}</Hi>
        </Warn>
        <div className="mt-auto">
          <PhoneButton tone="go" selected>
            <Hi>{hi.t("confirm")}</Hi>
          </PhoneButton>
        </div>
      </div>
    ),
    recipient: <Asleep />,
  },
  {
    title: "The payment is held for 10 minutes",
    story: "He approves on PayPal, but Verbo doesn't send it yet. For 10 minutes he can cancel, and the money never leaves.",
    under: "This is a PayPal authorization with no capture yet. Cancelling voids it.",
    where: "hold",
    active: "sender",
    sender: (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-5 text-center">
        <Hi className="text-xl font-bold">{hi.t("hold_title")}</Hi>
        <p className="v-digits !text-5xl tabular-nums">10:00</p>
        <Hi className="text-sm text-ink-2">{hi.t("hold_notice", { minutes: "10" })}</Hi>
        <PhoneButton>
          <Hi>{hi.t("cancel_hold")}</Hi>
        </PhoneButton>
      </div>
    ),
    recipient: <Asleep />,
  },
  {
    title: "The hold ends and the payment goes through",
    story: "He doesn't check in time. The hold ends and $40 reaches the wrong Manuel, who speaks Portuguese.",
    under: "The authorization is captured and paid out with a safe-to-retry request, so it can't be sent twice.",
    where: "recipient",
    active: "both",
    sender: (
      <div className="flex h-full flex-col justify-center gap-4 p-5">
        <Hi className="font-bold">{hi.t("sent", { recipient: WRONG })}</Hi>
        <PhoneButton tone="go" selected>
          <Hi>{hi.t("ask_back")}</Hi>
        </PhoneButton>
      </div>
    ),
    recipient: (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-5 text-center">
        <p className="text-sm text-ink-3">PayPal</p>
        <p className="v-digits !text-5xl text-evergreen">+$40</p>
        <p className="text-ink-2">from someone he doesn’t know</p>
      </div>
    ),
  },
  {
    title: "Manuel gets a link in Portuguese",
    story: "With one tap, Sreenivas asks for it back. Manuel gets a private link in Portuguese that explains what happened. The decision is his.",
    under: "Verbo can't take money from anyone's account or force a refund. It makes doing the right thing easy.",
    where: "recipient",
    active: "recipient",
    sender: (
      <div className="flex h-full items-center p-5">
        <Hi className="font-bold">{hi.t("case_sent", { recipient: WRONG })}</Hi>
      </div>
    ),
    recipient: (
      <div className="flex h-full flex-col gap-3 p-5">
        <Pt className="font-display text-2xl font-semibold leading-tight">{pt.t("rc_title")}</Pt>
        <Pt className="text-sm">{pt.t("rc_body", { sender: SENDER, amount: AMOUNT })}</Pt>
        <Pt className="text-sm text-ink-2">{pt.t("rc_choice")}</Pt>
        <div className="mt-auto grid gap-2">
          <PhoneButton tone="go">
            <Pt>{pt.t("rc_return")}</Pt>
          </PhoneButton>
          <PhoneButton>
            <Pt>{pt.t("rc_keep")}</Pt>
          </PhoneButton>
        </div>
      </div>
    ),
  },
  {
    title: "They message each other, with translation",
    story: "He writes in Hindi and Manuel reads Portuguese, and the reply comes back the other way.",
    under: "Gemini translates, and code drops any translation where a number changed, so $40 can't become $400.",
    where: "recipient",
    active: "both",
    sender: (
      <div className="flex h-full flex-col justify-end gap-2 p-4">
        <Bubble mine text={CHAT[0].hi} lang="hi" translated={false} />
        <Bubble mine={false} text={CHAT[1].hi} lang="hi" translated />
      </div>
    ),
    recipient: (
      <div className="flex h-full flex-col justify-end gap-2 p-4">
        <Bubble mine={false} text={CHAT[0].pt} lang="pt" translated />
        <Bubble mine text={CHAT[1].pt} lang="pt" translated={false} />
      </div>
    ),
  },
  {
    title: "Manuel sends the money back",
    story: "Manuel taps once and approves it himself on PayPal, and the $40 goes back to Sreenivas. Every step is recorded on the Case Desk, in an evidence packet with a SHA-256 fingerprint.",
    under: "It's a new payment that Manuel approves, followed by a payout to Sreenivas, each safe to retry.",
    where: "sender",
    active: "both",
    sender: (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-5 text-center">
        <p className="v-digits !text-5xl text-evergreen">+$40</p>
        <Hi className="text-lg font-bold">{hi.t("returned_sender", { recipient: WRONG })}</Hi>
      </div>
    ),
    recipient: (
      <div className="flex h-full items-center p-5 text-center">
        <Pt className="text-lg font-bold">{pt.t("rc_returned", { sender: SENDER })}</Pt>
      </div>
    ),
  },
];

const AUTO_MS = 7000;

export function DemoStage() {
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(false);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  const go = useCallback((n: number) => setI(Math.max(0, Math.min(STEPS.length - 1, n))), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(i + 1);
      if (e.key === "ArrowLeft") go(i - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, i]);

  useEffect(() => {
    if (!auto) return;
    if (last) return setAuto(false);
    const t = setTimeout(() => go(i + 1), AUTO_MS);
    return () => clearTimeout(t);
  }, [auto, go, i, last]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">Example: a payment sent to the wrong person</h1>
          <p className="mt-2 text-sm text-ink-3">
            A scripted walkthrough with simulated people. No money moves and nothing is sent. Hindi and Portuguese are machine translations.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (last) go(0);
            setAuto((a) => !a);
          }}
          aria-pressed={auto}
          className="min-h-11 rounded-full border-2 border-line-strong px-5 font-bold hover:bg-paper-2"
        >
          {auto ? "Pause" : "Play"}
        </button>
      </div>

      <div className="mt-6 grid items-stretch gap-6 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)_minmax(0,19rem)]">
        <Phone who="Sreenivas" speaks="Hindi" dim={step.active === "recipient"} hideOnSmall={step.active === "recipient"}>
          <div key={i} className="v-rise h-full">{step.sender}</div>
        </Phone>

        <section aria-live="polite" className="order-first flex flex-col gap-5 lg:order-none lg:px-2">
          <div key={i} className="v-rise">
            <p className="text-sm font-bold uppercase tracking-wider text-ink-3">
              Step {i + 1} of {STEPS.length}
            </p>
            <h2 className="mt-1 font-display text-3xl font-semibold leading-tight tracking-tight">{step.title}</h2>
            <p className="mt-3 text-lg text-ink-2">{step.story}</p>
            <p className="mt-4 rounded-v border border-line bg-paper-2 p-4 text-base">
              <strong>Under the hood: </strong>
              {step.under}
            </p>
          </div>

          <MoneyTrack where={step.where} />

          <div className="mt-auto">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => go(i - 1)}
                disabled={i === 0}
                className="min-h-12 rounded-full border-2 border-line-strong px-5 font-bold hover:bg-paper-2 disabled:opacity-40"
              >
                Back
              </button>
              {last ? (
                <Link href="/send" className="flex min-h-12 flex-1 items-center justify-center rounded-full bg-evergreen px-6 font-bold text-evergreen-ink shadow-v">
                  Now try it with your own voice
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setAuto(false);
                    go(i + 1);
                  }}
                  className="min-h-12 flex-1 rounded-full bg-evergreen px-6 font-bold text-evergreen-ink shadow-v transition-transform hover:-translate-y-0.5"
                >
                  Next
                </button>
              )}
            </div>
            {last && (
              <Link href="/desk" className="mt-3 block text-center font-bold text-ink-2 underline underline-offset-4 hover:text-ink">
                Open the Case Desk
              </Link>
            )}
            <ol className="mt-4 flex justify-center gap-1" aria-label="Jump to a step">
              {STEPS.map((s, n) => (
                <li key={s.title}>
                  <button
                    type="button"
                    onClick={() => {
                      setAuto(false);
                      go(n);
                    }}
                    aria-label={`Step ${n + 1}: ${s.title}`}
                    aria-current={n === i ? "step" : undefined}
                    className="grid h-8 w-8 place-items-center"
                  >
                    <span className={`block h-2 rounded-full transition-all ${n === i ? "w-6 bg-evergreen" : n < i ? "w-2 bg-evergreen/50" : "w-2 bg-line-strong"}`} />
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <Phone who="Manuel Lopes" speaks="Portuguese" dim={step.active === "sender"} hideOnSmall={step.active === "sender"}>
          <div key={i} className="v-rise h-full">{step.recipient}</div>
        </Phone>
      </div>
    </div>
  );
}

function Phone({ who, speaks, dim, hideOnSmall, children }: { who: string; speaks: string; dim: boolean; hideOnSmall: boolean; children: ReactNode }) {
  return (
    <figure className={`${hideOnSmall ? "hidden lg:block" : ""} transition-opacity duration-300 ${dim ? "lg:opacity-55" : ""}`}>
      <figcaption className="mb-2 flex items-baseline justify-between gap-2 px-2">
        <span className="whitespace-nowrap font-bold">{who}</span>
        <span className="whitespace-nowrap text-sm text-ink-3">{speaks}, simulated</span>
      </figcaption>
      <div className="h-[32rem] overflow-hidden rounded-[2.25rem] border-[6px] border-ink bg-card shadow-v-lg">{children}</div>
    </figure>
  );
}

const STOPS: { id: Where; label: string; x: string }[] = [
  { id: "sender", label: "Sreenivas", x: "0%" },
  { id: "hold", label: "On hold", x: "50%" },
  { id: "recipient", label: "Manuel Lopes", x: "100%" },
];

/** Where the $40 is right now, the thing people most want to know. */
function MoneyTrack({ where }: { where: Where }) {
  const here = STOPS.find((s) => s.id === where)!;
  return (
    <div aria-label={`The $40 is with: ${here.label}`} role="img" className="rounded-v-lg border border-line bg-card p-5">
      <p className="text-sm font-bold uppercase tracking-wider text-ink-3">Where the $40 is</p>
      <div className="relative mx-7 mt-6 h-1 rounded-full bg-line-strong">
        {STOPS.map((s) => (
          <span key={s.id} aria-hidden className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-line-strong" style={{ left: s.x }} />
        ))}
        <span
          aria-hidden
          className={`absolute top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full font-bold shadow-v transition-all duration-700 ${
            where === "recipient" ? "bg-terracotta text-paper" : where === "hold" ? "bg-marigold text-marigold-ink" : "bg-evergreen text-evergreen-ink"
          }`}
          style={{ left: here.x, transitionTimingFunction: "var(--v-ease)" }}
        >
          $40
        </span>
      </div>
      <div className="mt-7 flex justify-between text-sm font-bold">
        {STOPS.map((s) => (
          <span key={s.id} className={s.id === where ? "text-ink" : "text-ink-3"}>
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
