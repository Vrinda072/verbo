"use client";
import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
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
const te = labelsFor("te");
const ar = labelsFor("ar");
const en = labelsFor("en");
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

const SIMILAR_NAMES: Step[] = [
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
    under: "Verbo asks aloud and he answers by saying one or two, because speech recognition cannot separate these names. Code matches his answer.",
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

const Say = ({ lang, children, className = "" }: { lang: string; children: ReactNode; className?: string }) => (
  <span lang={lang} dir={lang === "ar" ? "rtl" : undefined} className={className}>
    {children}
  </span>
);

const Mic = ({ said, lang, english }: { said: string; lang: string; english: string }) => (
  <div className="flex h-full flex-col items-center justify-center gap-5 p-5 text-center">
    <div className="grid h-24 w-24 place-items-center rounded-full bg-terracotta text-paper">
      <span className="v-pulse absolute h-24 w-24 rounded-full border-4 border-terracotta" aria-hidden />
      <span aria-hidden className="h-8 w-8 rounded-md bg-paper" />
    </div>
    <Say lang={lang} className="text-xl font-semibold leading-snug">“{said}”</Say>
    {lang !== "en" && <p className="text-xs text-ink-3">“{english}”</p>}
  </div>
);

const Received = ({ amount, from }: { amount: string; from: string }) => (
  <div className="flex h-full flex-col items-center justify-center gap-2 p-5 text-center">
    <p className="text-sm text-ink-3">PayPal</p>
    <p className="v-digits !text-5xl text-success">+{amount}</p>
    <p className="text-ink-2">from {from}</p>
  </div>
);

// Gemini translations made with Verbo's own translator on Nov 11, 2026, saved so the story needs no key.
const WRONG_NUMBER_CHAT = {
  te: "హాయ్, నేను పొరపాటున మీకు 60 డాలర్లు పంపాను. అవి నా స్నేహితుడు కిరణ్ కోసం, మరియు అతని పాత నంబర్ ఇప్పుడు మీది అని అనుకుంటున్నాను. దయచేసి వాటిని వెనక్కి పంపగలరా?",
  ar: "مرحباً، لقد أرسلت لك 60 دولاراً عن طريق الخطأ. كانت مخصصة لصديقي كيران، وأعتقد أن رقمه القديم أصبح رقمك الآن. هل يمكنك إرجاعها من فضلك؟",
  replyAr: "عذراً، لم أره إلا الآن. هذا هو رقمي الجديد. نعم، سأعيده اليوم.",
  replyTe: "క్షమించండి, నేను దీన్ని ఇప్పుడే చూశాను. ఇది నా కొత్త నంబర్. అవును, నేను దీన్ని ఈరోజే వెనక్కి పంపుతాను.",
};
const STRANGER = "Fatima Haddad";

const WRONG_NUMBER: Step[] = [
  {
    title: "Voice input",
    story: "Sreenivas speaks Telugu and pays his friend Kiran Reddy $60, as he has done before.",
    under: "Whisper transcribes the Telugu. Gemini finds the name and amount, and code checks both against what was said.",
    where: "sender",
    active: "sender",
    sender: <Mic said="కిరణ్ రెడ్డికి 60 డాలర్లు పంపండి" lang="te" english="Send 60 dollars to Kiran Reddy" />,
    recipient: <Asleep />,
  },
  {
    title: "Read-back, low risk",
    story: "Kiran is a saved contact he has paid before, and the amount is normal for him. Nothing looks wrong, so there is no hold.",
    under: "Checks can only see the address book. They can't know that Kiran changed his number and the old one now belongs to someone else.",
    where: "sender",
    active: "sender",
    sender: (
      <div className="flex h-full flex-col gap-3 p-5">
        <Say lang="te" className="text-lg font-semibold">{te.t("readback", { amount: "$60.00", recipient: "Kiran Reddy" })}</Say>
        <p className="v-digits !text-5xl">$60<span className="text-ink-3">.00</span></p>
        <div className="mt-auto">
          <PhoneButton tone="go" selected>
            <Say lang="te">{te.t("confirm")}</Say>
          </PhoneButton>
        </div>
      </div>
    ),
    recipient: <Asleep />,
  },
  {
    title: "Paid to a stranger",
    story: `Kiran's old phone number now belongs to ${STRANGER}, who speaks Arabic. The $60 reaches her account instead of his.`,
    under: "This kind of mistake passes every check, which is why Verbo also covers what happens after the money has gone.",
    where: "recipient",
    active: "both",
    sender: (
      <div className="flex h-full flex-col justify-center gap-4 p-5">
        <Say lang="te" className="font-semibold">{te.t("sent", { recipient: "Kiran Reddy" })}</Say>
        <p className="rounded-v bg-paper-2 p-3 text-sm">Kiran: “I didn’t get anything.”</p>
      </div>
    ),
    recipient: <Received amount="$60" from="Sreenivas" />,
  },
  {
    title: "A polite request",
    story: `Sreenivas asks for the money back. The AI coach drafts a polite message in Telugu, which he checks and sends. ${STRANGER} gets a private page in Arabic.`,
    under: "The coach only suggests text. Code drops any draft with a link or a wrong amount, and he presses send himself.",
    where: "recipient",
    active: "both",
    sender: (
      <div className="flex h-full flex-col justify-center gap-3 p-5">
        <div className="rounded-v bg-paper p-3">
          <p className="text-xs text-ink-3">Suggested by AI</p>
          <Say lang="te" className="mt-1 block text-sm">{WRONG_NUMBER_CHAT.te}</Say>
        </div>
        <PhoneButton tone="go" selected>
          <Say lang="te">{te.t("rc_send")}</Say>
        </PhoneButton>
      </div>
    ),
    recipient: (
      <div className="flex h-full flex-col gap-3 p-5" dir="rtl">
        <Say lang="ar" className="text-xl font-semibold leading-tight">{ar.t("rc_title")}</Say>
        <Say lang="ar" className="text-sm">{ar.t("rc_body", { sender: "Sreenivas", amount: "$60.00" })}</Say>
        <div className="mt-auto grid gap-2">
          <PhoneButton tone="go"><Say lang="ar">{ar.t("rc_return")}</Say></PhoneButton>
          <PhoneButton><Say lang="ar">{ar.t("rc_keep")}</Say></PhoneButton>
        </div>
      </div>
    ),
  },
  {
    title: "No reply yet",
    story: "A day passes with no answer. Verbo sends a reminder, and the case appears on the Case Desk with a deadline before it escalates.",
    under: "The reminder is sent after 24 hours and escalation after 72. An operator can move the deadline on the Case Desk timeline.",
    where: "recipient",
    active: "recipient",
    sender: (
      <div className="flex h-full flex-col justify-center gap-2 p-5 text-sm">
        <p className="font-semibold">Case timeline</p>
        <p className="border-l-2 border-line pl-3">Link sent</p>
        <p className="border-l-2 border-line pl-3">She opened the link</p>
        <p className="border-l-2 border-brand pl-3 font-semibold">Reminder sent (24 h)</p>
      </div>
    ),
    recipient: (
      <div className="flex h-full flex-col justify-center gap-3 p-5" dir="rtl">
        <p className="text-xs text-ink-3" dir="ltr">Reminder</p>
        <Say lang="ar" className="text-lg font-semibold">{ar.t("rc_title")}</Say>
        <Say lang="ar" className="text-sm text-ink-2">{ar.t("rc_choice")}</Say>
      </div>
    ),
  },
  {
    title: "Translated messages",
    story: `${STRANGER} replies in Arabic that this is her new number and she will send it back. Sreenivas reads it in Telugu.`,
    under: "Gemini translates both ways. Code rejects any translation in which a number changed.",
    where: "recipient",
    active: "both",
    sender: (
      <div className="flex h-full flex-col justify-end gap-2 p-4">
        <Bubble mine text={WRONG_NUMBER_CHAT.te} lang="te" translated={false} />
        <Bubble mine={false} text={WRONG_NUMBER_CHAT.replyTe} lang="te" translated />
      </div>
    ),
    recipient: (
      <div className="flex h-full flex-col justify-end gap-2 p-4" dir="rtl">
        <Bubble mine={false} text={WRONG_NUMBER_CHAT.ar} lang="ar" translated />
        <Bubble mine text={WRONG_NUMBER_CHAT.replyAr} lang="ar" translated={false} />
      </div>
    ),
  },
  {
    title: "Funds returned",
    story: `${STRANGER} approves the return on PayPal and the $60 goes back to Sreenivas, who then pays Kiran's new number.`,
    under: "The return is a new order she approves, followed by a payout to Sreenivas. The evidence packet records each step.",
    where: "sender",
    active: "both",
    sender: (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-5 text-center">
        <p className="v-digits !text-5xl text-success">+$60</p>
        <Say lang="te" className="text-lg font-semibold">{te.t("returned_sender", { recipient: STRANGER })}</Say>
      </div>
    ),
    recipient: (
      <div className="flex h-full items-center p-5 text-center" dir="rtl">
        <Say lang="ar" className="text-lg font-semibold">{ar.t("rc_returned", { sender: "Sreenivas" })}</Say>
      </div>
    ),
  },
];

const PRESSURED: Step[] = [
  {
    title: "A call from “the bank”",
    story: "A caller says they are from Sreenivas's bank, that his account is at risk, and that he must move $900 to a safe account now. They had him add Javier Ruiz as a contact first.",
    under: "Verbo can't hear the call. It only hears what Sreenivas says to it, and that is enough to notice the pressure.",
    where: "sender",
    active: "sender",
    sender: <Mic said="Send 900 dollars to Javier Ruiz right now, it's urgent" lang="en" english="" />,
    recipient: <Asleep />,
  },
  {
    title: "Read-back with warnings",
    story: "Verbo reads the payment back and shows three warnings: rushed or pressured words, a first payment to this person, and an amount far above his usual.",
    under: "Code flags each signal. Gemini also lists pressure cues, but code decides the risk and the hold.",
    where: "sender",
    active: "sender",
    sender: (
      <div className="flex h-full flex-col gap-2 p-5">
        <p className="text-lg font-semibold">{en.t("readback", { amount: "$900.00", recipient: "Javier Ruiz" })}</p>
        <Warn>{en.t("pressure")}</Warn>
        <Warn>{en.t("first_time")}</Warn>
        <Warn>{en.t("unusual_amount")}</Warn>
      </div>
    ),
    recipient: <Asleep />,
  },
  {
    title: "Safety hold",
    story: "He confirms while still on the phone. PayPal authorizes the payment, but Verbo holds it for 10 minutes instead of sending it.",
    under: "The money is authorized, not captured. Until the hold ends, nothing has left his account.",
    where: "hold",
    active: "sender",
    sender: (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-5 text-center">
        <p className="text-xl font-semibold">{en.t("hold_title")}</p>
        <p className="v-digits !text-5xl tabular-nums">10:00</p>
        <p className="text-sm text-ink-2">{en.t("hold_notice", { minutes: "10" })}</p>
        <PhoneButton>{en.t("cancel_hold")}</PhoneButton>
      </div>
    ),
    recipient: <Asleep />,
  },
  {
    title: "Second thoughts",
    story: "The warnings make him hang up and call the number on his bank card. The bank says it never asks customers to move money. He taps cancel.",
    under: "Cancelling during the hold is one tap, in the sender's own language.",
    where: "hold",
    active: "sender",
    sender: (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-5 text-center">
        <p className="v-digits !text-5xl tabular-nums">06:12</p>
        <PhoneButton selected>{en.t("cancel_hold")}</PhoneButton>
      </div>
    ),
    recipient: <Asleep />,
  },
  {
    title: "Cancelled, nothing moved",
    story: "The payment is cancelled. The $900 never left Sreenivas's account, and Javier Ruiz receives nothing.",
    under: "Cancelling voids the PayPal authorization, so there is nothing to recover. The attempt is still recorded as a pre-send alert on the Case Desk.",
    where: "sender",
    active: "both",
    sender: (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-5 text-center">
        <p className="text-xl font-semibold">{en.t("cancelled")}</p>
        <p className="v-digits !text-5xl text-success">$900</p>
        <p className="text-sm text-ink-2">Still in his account</p>
      </div>
    ),
    recipient: (
      <div className="flex h-full items-center justify-center p-5 text-center text-ink-3">
        <p>Nothing received.</p>
      </div>
    ),
  },
];

export interface Story {
  id: string;
  label: string;
  outcome: string;
  amount: string;
  sender: { name: string; speaks: string };
  recipient: { name: string; speaks: string };
  steps: Step[];
}

export const STORIES: Story[] = [
  {
    id: "similar-names",
    label: "Similar names",
    outcome: "Returned",
    amount: "$40",
    sender: { name: SENDER, speaks: "Hindi" },
    recipient: { name: WRONG, speaks: "Portuguese" },
    steps: SIMILAR_NAMES,
  },
  {
    id: "wrong-number",
    label: "Wrong number",
    outcome: "Returned after a reminder",
    amount: "$60",
    sender: { name: SENDER, speaks: "Telugu" },
    recipient: { name: STRANGER, speaks: "Arabic" },
    steps: WRONG_NUMBER,
  },
  {
    id: "pressured",
    label: "Pressured payment",
    outcome: "Cancelled during the hold",
    amount: "$900",
    sender: { name: SENDER, speaks: "English" },
    recipient: { name: "Javier Ruiz", speaks: "Stranger" },
    steps: PRESSURED,
  },
];

const AUTO_MS = 6500;

export function DemoStage({ initialStory }: { initialStory?: string }) {
  const router = useRouter();
  const [story, setStory] = useState<Story>(() => STORIES.find((s) => s.id === initialStory) ?? STORIES[0]);
  const STEPS = story.steps;
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(false);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  function choose(next: Story) {
    setStory(next);
    setI(0);
    setAuto(true);
    router.replace(`/demo?story=${next.id}`, { scroll: false });
  }

  useEffect(() => {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) setAuto(true);
  }, []);

  const go = useCallback((n: number) => setI(Math.max(0, Math.min(STEPS.length - 1, n))), [STEPS.length]);

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
          <h2 className="text-3xl font-bold tracking-tight">Example stories</h2>
          <p className="mt-1 text-sm text-ink-3">Three scripted stories with simulated people, built from Verbo&apos;s real screens. No money moves. Translations are machine-made.</p>
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

      <div role="tablist" aria-label="Example stories" className="mt-5 grid gap-2 sm:grid-cols-3">
        {STORIES.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={s.id === story.id}
            onClick={() => choose(s)}
            className={`rounded-v-lg p-4 text-left transition-colors ${s.id === story.id ? "bg-navy text-navy-ink" : "bg-card shadow-v hover:bg-paper-2"}`}
          >
            <span className="block font-semibold">{s.label}</span>
            <span className={`mt-0.5 block text-sm ${s.id === story.id ? "text-navy-ink/75" : "text-ink-3"}`}>
              {s.sender.speaks} to {s.recipient.speaks === "Stranger" ? "a stranger" : s.recipient.speaks} · {s.outcome}
            </span>
          </button>
        ))}
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
                    <span key={`${story.id}-${i}-play`} className="v-fill block h-full bg-brand" style={{ animationDuration: `${AUTO_MS}ms` }} />
                  ) : (
                    <span className="block h-full w-full bg-brand" />
                  ))}
              </span>
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-4 grid items-stretch gap-6 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)_minmax(0,19rem)]">
        <Phone who={story.sender.name} speaks={story.sender.speaks} dim={step.active === "recipient"} hideOnSmall={step.active === "recipient"}>
          <div key={`${story.id}-${i}`} className="v-rise h-full">{step.sender}</div>
        </Phone>

        <section aria-live="polite" className="order-first flex flex-col gap-5 lg:order-none lg:px-2">
          <div key={`${story.id}-${i}`} className="v-rise">
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
            <MoneyPath stops={[story.sender.name, "Safety hold", story.recipient.name]} at={WHERE[step.where]} amount={story.amount} tone={TONE[step.where]} />
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

        <Phone who={story.recipient.name} speaks={story.recipient.speaks} dim={step.active === "sender"} hideOnSmall={step.active === "sender"}>
          <div key={`${story.id}-${i}`} className="v-rise h-full">{step.recipient}</div>
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
