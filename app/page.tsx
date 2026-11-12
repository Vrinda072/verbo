import Link from "next/link";
import { SixLanguages } from "@/components/SixLanguages";
import { SiteHeader } from "@/components/SiteHeader";
import { HeroDemo } from "@/components/demo/HeroDemo";
import { SafetyChecks } from "@/components/SafetyChecks";

const ACTIVITY = [
  { name: "Manuel Lopes", note: "Similar name to Manuel Lopez · returned", amount: "+$40.00", status: "Recovered", tone: "bg-success-soft text-success", href: "/demo?story=similar-names" },
  { name: "Fatima Haddad", note: "Kiran's old phone number · returned", amount: "+$60.00", status: "Recovered", tone: "bg-success-soft text-success", href: "/demo?story=wrong-number" },
  { name: "Javier Ruiz", note: "Pressured payment · cancelled during the hold", amount: "$900.00", status: "Cancelled", tone: "bg-paper-2 text-ink-2", href: "/demo?story=pressured" },
  { name: "Lakshmi Rao", note: "Read back in Telugu", amount: "-$25.00", status: "Completed", tone: "bg-brand-soft text-brand", href: "/send" },
];


const ADDS = [
  { title: "Before sending", body: "Similar names are compared letter by letter. First-time recipients, unusual amounts and pressured speech are flagged." },
  { title: "During the hold", body: "Risky payments are authorized on PayPal and held for 10 minutes. Cancelling voids the authorization, so nothing moves." },
  { title: "After a mistake", body: "AI drafts a polite request for you to edit. The recipient gets a private page in their language and can return the money." },
];


export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <HeroDemo />
        <SafetyChecks />
        <SixLanguages />

        <div className="mt-20 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          <section aria-labelledby="activity" className="rounded-v-lg bg-card p-6 shadow-v-lg">
            <div className="flex items-baseline justify-between">
              <h2 id="activity" className="text-xl font-semibold">Recent activity</h2>
              <span className="text-sm text-ink-3">Simulated · tap one to see what happened</span>
            </div>
            <ul className="mt-2 divide-y divide-line">
              {ACTIVITY.map((a) => (
                <li key={a.name}>
                  <Link href={a.href} className="-mx-2 flex items-center gap-3 rounded-v px-2 py-3.5 hover:bg-paper">
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
                    <span aria-hidden className="text-ink-3">›</span>
                  </Link>
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


        <footer className="mt-8 text-sm text-ink-3">
          Verbo is an independent hackathon project that runs on the PayPal sandbox. It is not a PayPal product, and no real money moves.
          It cannot force a refund; returns are voluntary.
        </footer>
      </main>
    </>
  );
}
