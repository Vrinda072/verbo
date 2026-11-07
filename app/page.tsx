import Link from "next/link";
import { HeroCard } from "@/components/HeroCard";
import { SiteHeader } from "@/components/SiteHeader";
import { labelsFor, LANGUAGES } from "@/lib/bridge/readback";

const ACTS = [
  {
    when: "Before sending",
    title: "Payment checks",
    body: "Similar recipient names require an explicit choice. First-time recipients, unusual amounts and urgent language are flagged, and high-risk payments are held for 10 minutes so they can be cancelled.",
  },
  {
    when: "After sending",
    title: "Recovery",
    body: "The recipient receives a private link in their language with an option to return the money, and both people can exchange translated messages. The recipient approves any return on PayPal.",
  },
  {
    when: "For operators",
    title: "Case Desk",
    body: "All recovery cases in one view, with a translated timeline and a downloadable evidence packet for each case.",
  },
];

const PIPELINE = [
  { who: "Whisper", does: "Converts speech to text" },
  { who: "Gemini", does: "Extracts the recipient and amount" },
  { who: "Validation", does: "Checks both against the transcript and contacts" },
  { who: "Read-back", does: "Fixed template in the sender’s language" },
  { who: "Sender", does: "Confirms, then approves on PayPal" },
];

export default function Home() {
  const readbacks = LANGUAGES.filter((l) => !labelsFor(l.code).fallback).length;
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-6xl px-4 sm:px-6">
        <section className="grid items-center gap-12 py-12 sm:py-16 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Voice payments on PayPal, with safety checks in the sender’s language
            </h1>
            <p className="mt-5 max-w-xl text-lg text-ink-2">
              Verbo lets people send payments by speaking. It reads each payment back before it goes, flags risky ones, and
              supports recovery when money reaches the wrong person, including across languages.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/demo"
                className="inline-flex min-h-14 items-center justify-center rounded-v bg-evergreen px-7 text-lg font-bold text-evergreen-ink shadow-v transition-opacity duration-200 hover:opacity-90"
              >
                View demo
              </Link>
              <Link
                href="/send"
                className="inline-flex min-h-14 items-center justify-center rounded-v border-2 border-line-strong px-7 text-lg font-bold transition-colors hover:bg-paper-2"
              >
                Try it
              </Link>
            </div>
          </div>
          <HeroCard />
        </section>

        <section aria-label="What Verbo does" className="grid gap-px overflow-hidden rounded-v-lg border border-line bg-line md:grid-cols-3">
          {ACTS.map((a) => (
            <article key={a.when} className="bg-card p-7">
              <p className="text-sm font-semibold text-ink-3">{a.when}</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">{a.title}</h2>
              <p className="mt-3 text-ink-2">{a.body}</p>
            </article>
          ))}
        </section>

        <section aria-labelledby="money" className="py-12 sm:py-16">
          <h2 id="money" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            How payments are checked
          </h2>
          <p className="mt-3 max-w-2xl text-lg text-ink-2">
            AI models transcribe and extract, but they do not decide. Code validates the recipient and amount against what was
            said, and the read-back is a fixed template rather than model output.
          </p>
          <ol className="mt-8 grid gap-3 md:grid-cols-5">
            {PIPELINE.map((p, i) => (
              <li key={p.who} className={`rounded-v border p-4 ${i >= 2 ? "border-evergreen/40 bg-evergreen-soft" : "border-line bg-card"}`}>
                <p className="text-lg font-bold">{p.who}</p>
                <p className="mt-1 text-base text-ink-2">{p.does}</p>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-sm text-ink-3">Highlighted steps do not use an AI model.</p>
        </section>

        <section aria-label="Language coverage" className="grid gap-6 border-t border-line py-10 sm:grid-cols-2">
          <p>
            <span className="v-digits block">{LANGUAGES.length}</span>
            <span className="mt-2 block text-ink-2">languages available for voice input</span>
          </p>
          <p>
            <span className="v-digits block">{readbacks}</span>
            <span className="mt-2 block text-ink-2">with a written read-back. Others read back in English.</span>
          </p>
        </section>

        <footer className="border-t border-line py-8 text-sm text-ink-3">
          Built for the PayPal AI Hackathon. Runs on the PayPal <strong>sandbox</strong>, so no real money moves. Verbo cannot
          force a refund. It supports voluntary returns and keeps a record.
        </footer>
      </main>
    </>
  );
}
