import Link from "next/link";
import { HeroCard } from "@/components/HeroCard";
import { SiteHeader } from "@/components/SiteHeader";
import { labelsFor, LANGUAGES } from "@/lib/bridge/readback";

const ACTS = [
  {
    when: "Before you send",
    title: "It catches the slip.",
    body: "Names that sound alike make you stop and choose. First-time recipients, unusual amounts and pressure tactics get flagged. Risky payments wait 10 minutes, and until then you can cancel.",
  },
  {
    when: "If it still goes wrong",
    title: "It gets you talking.",
    body: "The other person gets a private link in their language with one button to send the money back, plus a chat translated in both directions.",
  },
  {
    when: "Afterwards",
    title: "It keeps the record.",
    body: "Each case lands on one desk, with a translated timeline and an evidence packet to hand over if you need to escalate.",
  },
];

const PIPELINE = [
  { who: "Whisper", does: "writes down what you said" },
  { who: "Gemini", does: "fills in who and how much" },
  { who: "Code", does: "checks both against what you said and your contacts" },
  { who: "Fixed template", does: "reads it back in your language" },
  { who: "You", does: "confirm, then approve on PayPal" },
];

export default function Home() {
  const readbacks = LANGUAGES.filter((l) => !labelsFor(l.code).fallback).length;
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-6xl px-4 sm:px-6">
        <section className="grid items-center gap-12 py-12 sm:py-16 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <h1 className="font-display text-5xl font-semibold leading-[1.02] tracking-tight sm:text-7xl">
              You paid the wrong person.
              <br />
              <span className="text-evergreen">They don’t speak your language.</span>
            </h1>
            <p className="mt-6 max-w-xl text-xl text-ink-2">
              Often, that money is gone. Verbo is a voice-first safety net for PayPal: it helps stop the mistake before
              it happens, and gives two strangers a way to put it right afterwards.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/demo"
                className="inline-flex min-h-14 items-center justify-center rounded-full bg-evergreen px-7 text-lg font-bold text-evergreen-ink shadow-v transition-transform duration-200 hover:-translate-y-0.5"
              >
                Watch a rescue
              </Link>
              <Link
                href="/send"
                className="inline-flex min-h-14 items-center justify-center rounded-full border-2 border-line-strong px-7 text-lg font-bold transition-colors hover:bg-paper-2"
              >
                Try it with your voice
              </Link>
            </div>
          </div>
          <HeroCard />
        </section>

        <section aria-label="What Verbo does" className="grid gap-px overflow-hidden rounded-v-lg border border-line bg-line md:grid-cols-3">
          {ACTS.map((a) => (
            <article key={a.when} className="bg-card p-7">
              <p className="text-sm font-bold uppercase tracking-wider text-marigold-ink">{a.when}</p>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight">{a.title}</h2>
              <p className="mt-3 text-ink-2">{a.body}</p>
            </article>
          ))}
        </section>

        <section aria-labelledby="money" className="py-14 sm:py-20">
          <h2 id="money" className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            AI helps. It never decides money.
          </h2>
          <p className="mt-3 max-w-2xl text-lg text-ink-2">
            If a model invents an amount, code rejects it. If speech blurs Lopez and Lopes, you choose. What you hear back
            is a fixed sentence, never model output.
          </p>
          <ol className="mt-8 grid gap-3 md:grid-cols-5">
            {PIPELINE.map((p, i) => (
              <li key={p.who} className={`rounded-v border p-4 ${i >= 2 ? "border-evergreen/40 bg-evergreen-soft" : "border-line bg-card"}`}>
                <p className="text-lg font-bold">{p.who}</p>
                <p className="mt-1 text-base text-ink-2">{p.does}</p>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-sm text-ink-3">Green steps involve no AI model.</p>
        </section>

        <section aria-label="Language coverage" className="grid gap-6 border-t border-line py-10 sm:grid-cols-2">
          <p>
            <span className="v-digits block text-evergreen">{LANGUAGES.length}</span>
            <span className="mt-2 block text-ink-2">languages to choose from when you speak</span>
          </p>
          <p>
            <span className="v-digits block text-evergreen">{readbacks}</span>
            <span className="mt-2 block text-ink-2">with a written read-back so far. The rest read back in English.</span>
          </p>
        </section>

        <footer className="border-t border-line py-8 text-sm text-ink-3">
          Built for the PayPal AI Hackathon. Runs on the PayPal <strong>sandbox</strong>, so no real money moves. Verbo can’t
          force a refund: it makes returning money easy and keeps a clear record.
        </footer>
      </main>
    </>
  );
}
