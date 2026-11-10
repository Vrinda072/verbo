"use client";
import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { MoneyPath, type PathTone } from "@/components/MoneyPath";
import { NameDiff } from "@/components/NameDiff";
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
    <p>No activity yet.</p>
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
  <p className="rounded-v bg-marigold-soft p-3 text-sm font-semibold text-marigold-ink">{children}</p>
);

const PhoneButton = ({ children, tone = "plain", selected = false }: { children: ReactNode; tone?: "go" | "plain"; selected?: boolean }) => (
  <div
    className={`flex min-h-12 items-center justify-center rounded-full px-4 text-center font-semibold ${
      tone === "go" ? "bg-brand text-brand-ink" : "border-2 border-line-strong"
    } ${selected ? "ring-4 ring-signal" : ""}`}
  >
    {children}
  </div>
);

const Bubble = ({ mine, text, lang, translated }: { mine: boolean; text: string; lang: string; translated: boolean }) => (
  <div className={`max-w-[88%] rounded-v p-3 text-sm ${mine ? "self-end bg-brand text-brand-ink" : "self-start bg-paper-2"}`}>
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
    title: "Voice input",
    story: "Sreenivas speaks Hindi and intends to pay his friend Manuel Lopez $40. He starts recording and says the payment.",
    under: "Audio is recorded until he stops it, then transcribed by Whisper.",
    where: "sender",
    active: "sender",
    sender: (
      <div className="flex h-full flex-col items-center justify-center gap-5 p-5 text-center">
        <div className="grid h-24 w-24 place-items-center rounded-full bg-terracotta text-paper">
          <span className="v-pulse absolute h-24 w-24 rounded-full border-4 border-terracotta" aria-hidden />
          <span aria-hidden className="h-8 w-8 rounded-md bg-paper" />
        </div>
        <Hi className="text-xl font-semibold leading-snug">“{SAID}”</Hi>
        <p className="text-xs text-ink-3">“Send 40 dollars to Manuel Lopez”</p>
      </div>
    ),
    recipient: <Asleep />,
  },
  {
    title: "Recipient selection",
    story: "He has two contacts with similar names, Manuel Lopez and Manuel Lopes. Speech recognition cannot reliably distinguish them, so he must select one. In this example he selects the wrong contact.",
    under: "The model only fills in fields. Code matches the name against contacts, and the sender makes the final choice.",
    where: "sender",
    active: "sender",
    sender: (
      <div className="flex h-full flex-col justify-center gap-3 p-5">
        <p className="font-semibold">Two contacts have similar names. Select the recipient:</p>
        <PhoneButton><NameDiff name={RIGHT} other={WRONG} /></PhoneButton>
        <PhoneButton selected><NameDiff name={WRONG} other={RIGHT} /></PhoneButton>
      </div>
    ),
    recipient: <Asleep />,
  },
  {
    title: "Read-back and risk check",
    story: "The payment is shown and read aloud in Hindi. The recipient is new and has a name similar to another contact, so the payment is scored high risk.",
    under: "The sentence is a fixed template. Code inserts the name and amount, so no model output is read to the sender.",
    where: "sender",
    active: "sender",
    sender: (
      <div className="flex h-full flex-col gap-3 p-5">
        <Hi className="text-lg font-semibold">{hi.t("readback", { amount: AMOUNT, recipient: WRONG })}</Hi>
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
    title: "Safety hold",
    story: "He approves on PayPal, but the payment is not sent yet. He can cancel at any point during the 10-minute hold.",
    under: "This is a PayPal authorization with no capture yet. Cancelling voids it.",
    where: "hold",
    active: "sender",
    sender: (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-5 text-center">
        <Hi className="text-xl font-semibold">{hi.t("hold_title")}</Hi>
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
    title: "Payment released",
    story: "He does not cancel, so the hold ends and $40 is paid to Manuel Lopes, who speaks Portuguese.",
    under: "The authorization is captured and paid out using idempotency keys, so a retry cannot pay twice.",
    where: "recipient",
    active: "both",
    sender: (
      <div className="flex h-full flex-col justify-center gap-4 p-5">
        <Hi className="font-semibold">{hi.t("sent", { recipient: WRONG })}</Hi>
        <PhoneButton tone="go" selected>
          <Hi>{hi.t("ask_back")}</Hi>
        </PhoneButton>
      </div>
    ),
    recipient: (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-5 text-center">
        <p className="text-sm text-ink-3">PayPal</p>
        <p className="v-digits !text-5xl text-success">+$40</p>
        <p className="text-ink-2">from Sreenivas</p>
      </div>
    ),
  },
  {
    title: "Recovery request",
    story: "Sreenivas requests the money back. Manuel receives a private link in Portuguese that explains what happened. The decision is his.",
    under: "AI drafts a polite request for him to edit. Code rejects any draft with a link or a wrong amount. Verbo cannot force a refund, so any return is voluntary.",
    where: "recipient",
    active: "recipient",
    sender: (
      <div className="flex h-full flex-col justify-center gap-4 p-5">
        <Hi className="font-semibold">{hi.t("case_sent", { recipient: WRONG })}</Hi>
        <div className="rounded-v bg-paper p-3">
          <p className="text-xs text-ink-3">Suggested by AI</p>
          <Hi className="mt-1 block text-sm">{CHAT[0].hi}</Hi>
        </div>
      </div>
    ),
    recipient: (
      <div className="flex h-full flex-col gap-3 p-5">
        <Pt className="text-xl font-semibold leading-tight">{pt.t("rc_title")}</Pt>
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
    title: "Translated messages",
    story: "Sreenivas writes in Hindi and Manuel reads Portuguese. Manuel's reply is translated back into Hindi.",
    under: "Gemini translates. Code rejects any translation in which a number changed.",
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
    title: "Funds returned",
    story: "Manuel approves the return on PayPal and the $40 goes back to Sreenivas. The case is recorded on the Case Desk, with an evidence packet that carries a SHA-256 hash.",
    under: "The return is a new order approved by Manuel, followed by a payout to Sreenivas, both using idempotency keys.",
    where: "sender",
    active: "both",
    sender: (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-5 text-center">
        <p className="v-digits !text-5xl text-success">+$40</p>
        <Hi className="text-lg font-semibold">{hi.t("returned_sender", { recipient: WRONG })}</Hi>
      </div>
    ),
    recipient: (
      <div className="flex h-full items-center p-5 text-center">
        <Pt className="text-lg font-semibold">{pt.t("rc_returned", { sender: SENDER })}</Pt>
      </div>
    ),
  },
];

const AUTO_MS = 6500;

export function DemoStage() {
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(false);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  useEffect(() => {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) setAuto(true);
  }, []);

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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-semibold tracking-tight">How a wrong payment gets recovered</h1>
          <p className="mt-1 text-sm text-ink-3">Scripted with simulated people. No money moves. Hindi and Portuguese are machine translations.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (last) go(0);
            setAuto((a) => !a);
          }}
          aria-pressed={auto}
          className="min-h-11 rounded-full bg-navy px-6 font-semibold text-navy-ink"
        >
          {auto ? "Pause" : last ? "Replay" : "Play"}
        </button>
      </div>

      <ol className="mt-5 flex gap-1.5" aria-label="Jump to a step">
        {STEPS.map((s, n) => (
          <li key={s.title} className="flex-1">
            <button
              type="button"
              onClick={() => {
                setAuto(false);
                go(n);
              }}
              aria-label={`Step ${n + 1}: ${s.title}`}
              aria-current={n === i ? "step" : undefined}
              className="block w-full py-2"
            >
              <span className="block h-1.5 overflow-hidden rounded-full bg-line-strong">
                {n < i && <span className="block h-full w-full bg-brand" />}
                {n === i &&
                  (auto ? (
                    <span key={`${i}-play`} className="v-fill block h-full bg-brand" style={{ animationDuration: `${AUTO_MS}ms` }} />
                  ) : (
                    <span className="block h-full w-full bg-brand" />
                  ))}
              </span>
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-4 grid items-stretch gap-6 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)_minmax(0,19rem)]">
        <Phone who="Sreenivas" speaks="Hindi" dim={step.active === "recipient"} hideOnSmall={step.active === "recipient"}>
          <div key={i} className="v-rise h-full">{step.sender}</div>
        </Phone>

        <section aria-live="polite" className="order-first flex flex-col gap-5 lg:order-none lg:px-2">
          <div key={i} className="v-rise">
            <p className="text-sm font-semibold text-ink-3">
              Step {i + 1} of {STEPS.length}
            </p>
            <h2 className="mt-1 text-2xl font-semibold leading-tight tracking-tight">{step.title}</h2>
            <p className="mt-3 text-ink-2">{step.story}</p>
            <p className="mt-4 rounded-v bg-paper-2 p-4 text-base">
              <span className="font-semibold">How it works: </span>
              {step.under}
            </p>
          </div>

          <div className="rounded-v-lg bg-card p-5 shadow-v-lg">
            <p className="mb-2 text-sm text-ink-3">Where the money is</p>
            <MoneyPath stops={[SENDER, "Safety hold", WRONG]} at={WHERE[step.where]} amount="$40" tone={TONE[step.where]} />
          </div>

          <div className="mt-auto">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => go(i - 1)}
                disabled={i === 0}
                className="min-h-12 rounded-full border-2 border-line-strong px-5 font-semibold hover:bg-paper-2 disabled:opacity-40"
              >
                Back
              </button>
              {last ? (
                <Link href="/send" className="flex min-h-12 flex-1 items-center justify-center rounded-full bg-brand px-6 font-semibold text-brand-ink shadow-v">
                  Try it
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setAuto(false);
                    go(i + 1);
                  }}
                  className="min-h-12 flex-1 rounded-full bg-brand px-6 font-semibold text-brand-ink shadow-v transition-transform hover:opacity-90"
                >
                  Next
                </button>
              )}
            </div>
            {last && (
              <Link href="/desk" className="mt-3 block text-center font-semibold text-ink-2 underline underline-offset-4 hover:text-ink">
                Open the Case Desk
              </Link>
            )}
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
        <span className="whitespace-nowrap font-semibold">{who}</span>
        <span className="whitespace-nowrap text-sm text-ink-3">{speaks}, simulated</span>
      </figcaption>
      <div className="flex h-[32rem] flex-col overflow-hidden rounded-[2.25rem] border-[6px] border-navy bg-card shadow-v-lg">
        <div className="bg-navy px-5 pb-2.5 pt-3 text-center text-sm font-medium text-navy-ink">Verbo</div>
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </figure>
  );
}

const WHERE: Record<Where, 0 | 1 | 2> = { sender: 0, hold: 1, recipient: 2 };
const TONE: Record<Where, PathTone> = { sender: "safe", hold: "hold", recipient: "away" };
