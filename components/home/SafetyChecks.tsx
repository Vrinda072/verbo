import type { ReactNode } from "react";
import { labelsFor } from "@/lib/bridge/readback";
import { En } from "@/components/ui/En";
import { NameDiff } from "@/components/ui/NameDiff";
import { Digits } from "@/components/ui/Digits";
import { MoneyPath } from "@/components/ui/MoneyPath";

const ar = labelsFor("ar");
const te = labelsFor("te");

const Mark = ({ children }: { children: ReactNode }) => (
  <mark className="rounded-[4px] bg-marigold-soft px-0.5 text-marigold-ink underline decoration-marigold decoration-2 underline-offset-2">{children}</mark>
);

/** Each check, what it catches, and a specimen of what the sender sees. All examples are simulated. */
const CHECKS: { title: string; body: string; when: string; specimen: ReactNode }[] = [
  {
    title: "Names that sound the same",
    when: "Before sending",
    body: "Contacts are compared letter by letter. When two names sound alike, Verbo asks which one and shows who was paid before.",
    specimen: (
      <div className="grid gap-1.5 text-lg">
        <span className="flex items-baseline justify-between gap-3">
          <NameDiff name="Manuel Lopez" other="Manuel Lopes" className="font-semibold" />
          <span className="text-xs text-success">Paid before</span>
        </span>
        <span className="flex items-baseline justify-between gap-3">
          <NameDiff name="Manuel Lopes" other="Manuel Lopez" className="font-semibold" />
          <span className="text-xs text-ink-3">Never paid</span>
        </span>
      </div>
    ),
  },
  {
    title: "A number one digit off",
    when: "Before sending",
    body: "A typed phone number is checked against every contact. One digit off stops the payment and shows who the number reaches.",
    specimen: (
      <div className="grid gap-1.5 text-lg">
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-xs text-ink-3">Typed</span>
          <Digits digits="14085550139" positions={[10]} />
        </span>
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-xs text-ink-3">Kiran Reddy</span>
          <Digits digits="14085550138" positions={[10]} />
        </span>
      </div>
    ),
  },
  {
    title: "Amounts said in words",
    when: "Before sending",
    body: "Forty and fourteen are easy to mishear. An amount said in words must be typed in digits before the payment goes ahead.",
    specimen: (
      <div className="grid gap-2">
        <p className="text-sm text-ink-2">
          Heard: “send <Mark>fourteen</Mark> dollars”
        </p>
        <span className="flex min-h-11 items-center justify-between rounded-v border-2 border-brand bg-card px-3 text-lg tabular-nums">
          <span>$14.00</span>
          <span className="text-xs text-ink-3">Typed to confirm</span>
        </span>
      </div>
    ),
  },
  {
    title: "Pressure and first payments",
    when: "Before sending",
    body: "Urgent wording, a first-time recipient or an unusual amount raises the risk. High risk means the payment is held.",
    specimen: (
      <p className="text-sm leading-relaxed text-ink-2">
        “Send it <Mark>right now</Mark>, it&apos;s <Mark>urgent</Mark>. Don&apos;t tell anyone.”
      </p>
    ),
  },
  {
    title: "A 10-minute hold",
    when: "During the hold",
    body: "Risky payments are authorized on PayPal and held. Cancelling voids the authorization, so nothing moves.",
    specimen: <MoneyPath stops={["You", "On hold", "Javier Ruiz"]} at={1} amount="$900" tone="hold" />,
  },
  {
    title: "A return page in their language",
    when: "After a mistake",
    body: "The person who got the money by mistake gets a private page in their own language and can send it back in one tap.",
    specimen: (
      <div className="grid gap-2">
        <p lang="ar" dir="rtl" className="text-lg font-semibold">
          {ar.t("rc_title")}
          <En L={ar} k="rc_title" className="text-xs" />
        </p>
        <p lang="te" className="text-sm text-ink-2">
          {te.t("rc_return")}
          <En L={te} k="rc_return" className="text-xs" />
        </p>
      </div>
    ),
  },
];

export function SafetyChecks() {
  return (
    <section aria-labelledby="checks" className="mt-20">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h2 id="checks" className="text-3xl font-bold tracking-tight">
          What gets checked
        </h2>
        <p className="max-w-lg text-ink-2">Code runs every check. The AI only helps with the words. Examples below are simulated.</p>
      </div>
      <ul className="mt-6 grid gap-px overflow-hidden rounded-v-lg bg-line shadow-v sm:grid-cols-2 lg:grid-cols-3">
        {CHECKS.map((c) => (
          <li key={c.title} className="flex flex-col gap-4 bg-card p-6">
            <div className="flex min-h-[7.5rem] flex-col justify-center rounded-v bg-paper p-4">{c.specimen}</div>
            <div>
              <h3 className="text-lg font-semibold">{c.title}</h3>
              <p className="mt-1 text-sm text-ink-2">{c.body}</p>
              <p className="mt-2 text-xs font-semibold text-ink-3">{c.when}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
