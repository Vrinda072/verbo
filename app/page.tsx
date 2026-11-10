import Link from "next/link";
import { ReadbackTicker } from "@/components/ReadbackTicker";
import { SiteHeader } from "@/components/SiteHeader";
import { labelsFor, LANGUAGES } from "@/lib/bridge/readback";

const ACTIVITY = [
  { name: "Manuel Lopes", note: "Returned after a wrong payment", amount: "+$40.00", status: "Recovered", tone: "bg-success-soft text-success" },
  { name: "Ana Souza", note: "Cancelled during the safety hold", amount: "$120.00", status: "Cancelled", tone: "bg-paper-2 text-ink-2" },
  { name: "Lakshmi Rao", note: "Read back in Telugu", amount: "-$25.00", status: "Completed", tone: "bg-brand-soft text-brand" },
  { name: "Kiran Reddy", note: "Similar name check passed", amount: "-$60.00", status: "Completed", tone: "bg-brand-soft text-brand" },
];

const ACTIONS = [
  { href: "/send", label: "Send by voice", icon: "M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3" },
  { href: "/demo", label: "See a recovery", icon: "M4 12a8 8 0 1 0 2.5-5.8M4 4v4h4" },
  { href: "/desk", label: "Case Desk", icon: "M4 6h16M4 12h16M4 18h10" },
];

const ADDS = [
  { title: "Before sending", body: "Similar names are compared letter by letter. First-time recipients, unusual amounts and pressured speech are flagged." },
  { title: "During the hold", body: "Risky payments are authorized on PayPal and held for 10 minutes. Cancelling voids the authorization, so nothing moves." },
  { title: "After a mistake", body: "AI drafts a polite request for you to edit. The recipient gets a private page in their language and can return the money." },
];

const PIPELINE: [string, string, boolean][] = [
  ["Whisper", "Speech to text", true],
  ["Gemini", "Finds recipient and amount", true],
  ["Code", "Checks both against what was said", false],
  ["Template", "Reads it back in your language", false],
  ["You", "Confirm, then approve on PayPal", false],
];

export default function Home() {
  const readbacks = LANGUAGES.filter((l) => !labelsFor(l.code).fallback).length;
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="text-3xl font-semibold tracking-tight">Hello, Sreenivas</h1>
        <p className="mt-1 text-ink-3">Simulated account on the PayPal sandbox</p>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          <section aria-labelledby="voice" className="rounded-v-lg bg-navy p-6 text-navy-ink sm:p-8">
            <h2 id="voice" className="max-w-md text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              Say who to pay and how much, in your language
            </h2>
            <p className="mt-3 max-w-lg text-navy-ink/80">
              Verbo reads the payment back before it goes, holds risky ones, and helps recover money sent to the wrong person.
            </p>
            <div className="mt-6">
              <ReadbackTicker />
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Link href="/send" className="inline-flex min-h-13 items-center gap-2 rounded-full bg-white px-7 py-3 text-lg font-semibold text-navy hover:bg-signal">
                <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="9" y="3" width="6" height="11" rx="3" />
                  <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                </svg>
                Start speaking
              </Link>
              <p className="text-sm text-navy-ink/75">
                {LANGUAGES.length} languages for voice · {readbacks} with written read-back
              </p>
            </div>
          </section>

          <div className="grid content-start gap-5">
            <section aria-labelledby="balance" className="rounded-v-lg bg-card p-6 shadow-v-lg">
              <h2 id="balance" className="text-ink-2">Sandbox balance</h2>
              <p className="v-digits mt-2 !text-5xl">
                $2,480<span className="text-ink-3">.50</span>
              </p>
              <p className="mt-2 text-sm text-ink-3">Simulated. No real money.</p>
            </section>
            <nav aria-label="Quick actions" className="grid grid-cols-3 gap-2 rounded-v-lg bg-card p-4 shadow-v-lg">
              {ACTIONS.map((a) => (
                <Link key={a.href} href={a.href} className="group grid justify-items-center gap-2 rounded-v py-2 text-center text-sm font-medium">
                  <span className="grid h-13 w-13 place-items-center rounded-full bg-brand text-brand-ink transition-transform group-hover:scale-105">
                    <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d={a.icon} />
                    </svg>
                  </span>
                  {a.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          <section aria-labelledby="activity" className="rounded-v-lg bg-card p-6 shadow-v-lg">
            <div className="flex items-baseline justify-between">
              <h2 id="activity" className="text-xl font-semibold">Recent activity</h2>
              <span className="text-sm text-ink-3">Simulated</span>
            </div>
            <ul className="mt-2 divide-y divide-line">
              {ACTIVITY.map((a) => (
                <li key={a.name} className="flex items-center gap-3 py-3.5">
                  <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-paper-2 font-semibold text-ink-2">
                    {a.name[0]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{a.name}</p>
                    <p className="truncate text-sm text-ink-3">{a.note}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium tabular-nums">{a.amount}</p>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${a.tone}`}>{a.status}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="adds" className="rounded-v-lg bg-card p-6 shadow-v-lg">
            <h2 id="adds" className="text-xl font-semibold">What Verbo adds to a payment</h2>
            <dl className="mt-3 grid gap-4">
              {ADDS.map((a) => (
                <div key={a.title}>
                  <dt className="font-medium">{a.title}</dt>
                  <dd className="mt-0.5 text-sm text-ink-2">{a.body}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <section aria-labelledby="ai" className="mt-5 rounded-v-lg bg-card p-6 shadow-v-lg">
          <h2 id="ai" className="text-xl font-semibold">How AI is used in a payment</h2>
          <ol className="mt-4 grid gap-4 sm:grid-cols-5">
            {PIPELINE.map(([who, does, ai]) => (
              <li key={who} className={`border-t-[3px] pt-3 ${ai ? "border-signal" : "border-navy"}`}>
                <p className="font-semibold">{who}</p>
                <p className="mt-0.5 text-sm text-ink-2">{does}</p>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm text-ink-3">Light blue steps use AI. Dark blue steps do not.</p>
        </section>

        <footer className="mt-8 text-sm text-ink-3">
          Verbo is an independent hackathon project that runs on the PayPal sandbox. It is not a PayPal product, and no real money moves.
          It cannot force a refund; returns are voluntary.
        </footer>
      </main>
    </>
  );
}
