import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

const PARTS = [
  {
    n: "01",
    title: "Send by voice",
    body: "Speak in your own language. Verbo reads the payment back from a fixed, checked template with large digits — and waits for your clear yes.",
  },
  {
    n: "02",
    title: "Checks before money moves",
    body: "Look-alike names, unusual amounts, first-time recipients and pressure language are flagged. Risky payments are held for 10 minutes so you can change your mind.",
  },
  {
    n: "03",
    title: "Recovery across languages",
    body: "If it went to the wrong person, they get a friendly link in their language with one button to send it back — and a translated chat.",
  },
  {
    n: "04",
    title: "Case Desk & evidence",
    body: "Operators see every case on one desk, with a translated timeline and a signed evidence packet for each.",
  },
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-6xl px-4 sm:px-6">
        <section className="grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-evergreen-soft px-3 py-1 text-sm font-bold text-evergreen">
              <span aria-hidden className="h-2 w-2 rounded-full bg-evergreen" />
              A safety net for person-to-person payments
            </p>
            <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              Send money safely,
              <br />
              <span className="text-evergreen">in the language you speak.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-ink-2 sm:text-xl">
              When money goes to the wrong person and nobody shares a language, it is usually gone. Verbo catches
              the mistake before it happens — and makes it easy to put right after.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/send"
                className="inline-flex min-h-14 items-center justify-center rounded-full bg-evergreen px-7 text-lg font-bold text-evergreen-ink shadow-v transition-transform duration-200 hover:-translate-y-0.5"
              >
                Try sending by voice
              </Link>
              <Link
                href="/desk"
                className="inline-flex min-h-14 items-center justify-center rounded-full border-2 border-line-strong px-7 text-lg font-bold text-ink transition-colors hover:bg-paper-2"
              >
                Open the Case Desk
              </Link>
            </div>
          </div>

          {/* Illustrative confirmation card (static preview of the Send screen) */}
          <figure aria-label="Example confirmation card" className="relative">
            <div className="rounded-v-lg border border-line bg-card p-6 shadow-v-lg sm:p-8">
              <p lang="te" className="text-lg text-ink-2">
                మీరు పంపుతున్నారు
              </p>
              <p className="mt-1 text-sm text-ink-3">You are sending</p>
              <p className="v-digits mt-4 text-ink">
                $50<span className="text-ink-3">.00</span>
              </p>
              <div className="mt-6 rounded-v border border-line bg-paper-2 p-4">
                <p className="text-sm text-ink-3">to</p>
                <p className="text-2xl font-bold">Manuel Lopes</p>
              </div>
              <div
                role="note"
                className="mt-4 flex gap-3 rounded-v border border-marigold/70 bg-marigold-soft p-4 text-marigold-ink"
              >
                <span aria-hidden className="text-xl">⚠</span>
                <p className="text-base">
                  <strong>Similar name.</strong> You usually pay <strong>Manuel Lopez</strong> (with a z).
                </p>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <span className="flex min-h-14 items-center justify-center rounded-full border-2 border-line-strong text-lg font-bold">
                  Cancel
                </span>
                <span className="flex min-h-14 items-center justify-center rounded-full bg-evergreen text-lg font-bold text-evergreen-ink">
                  Yes, send
                </span>
              </div>
            </div>
            <figcaption className="mt-3 text-center text-sm text-ink-3">
              Illustration · sandbox demo with synthetic accounts
            </figcaption>
          </figure>
        </section>

        <section aria-labelledby="how" className="border-t border-line py-14">
          <h2 id="how" className="font-display text-3xl font-semibold tracking-tight">
            How Verbo works
          </h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PARTS.map((p) => (
              <li key={p.n} className="rounded-v-lg border border-line bg-card p-6">
                <span className="font-display text-lg text-marigold">{p.n}</span>
                <h3 className="mt-2 text-xl font-bold">{p.title}</h3>
                <p className="mt-2 text-base text-ink-2">{p.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <footer className="border-t border-line py-8 text-sm text-ink-3">
          Verbo is a hackathon project running on the PayPal <strong>sandbox</strong>. No real money moves. It cannot
          force a refund — it makes returning money easy and keeps a clear record.
        </footer>
      </main>
    </>
  );
}
