import { formatAmount, labelsFor, LANGUAGES } from "@/lib/bridge/readback";
import { money } from "@/lib/paypal/money";

const CODES = ["en", "hi", "te", "ar", "pt", "es"];
const AMOUNT = money(4000);
const RECIPIENT = "Manuel Lopes";
const EN = labelsFor("en");

/** The recipient's Latin-script name kept in its own direction inside a right-to-left sentence. */
function withName(text: string) {
  const i = text.indexOf(RECIPIENT);
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <bdi dir="ltr">{RECIPIENT}</bdi>
      {text.slice(i + RECIPIENT.length)}
    </>
  );
}

/** One payment in each read-back language. The words change by language; the amount is written $40.00 in all of them. */
function line(code: string) {
  const L = labelsFor(code);
  const info = LANGUAGES.find((l) => l.code === code)!;
  const amount = formatAmount(AMOUNT, code).localized;
  const text = L.t("readback", { amount, recipient: RECIPIENT });
  const at = text.indexOf(amount);
  return {
    code,
    dir: L.dir,
    english: info.englishName,
        // The English subtitle.
    subtitle: code === "en" ? null : EN.t("readback", { amount: formatAmount(AMOUNT, "en").localized, recipient: RECIPIENT }),
    before: at < 0 ? text : text.slice(0, at),
    amount: at < 0 ? "" : amount,
    after: at < 0 ? "" : text.slice(at + amount.length),
  };
}

/** The same payment in all six read-back languages, with the value code checks beside each. */
export function SixLanguages() {
  const lines = CODES.map(line);

  return (
    <>
      <section aria-labelledby="six" className="mt-20">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 id="six" className="text-3xl font-bold tracking-tight">
            One payment, six languages
          </h2>
          <p className="max-w-lg text-ink-2">
            Every sentence is a fixed template. Code writes the name and the amount into it, so no AI wording ever reaches you.
          </p>
        </div>
        <ul className="mt-5 border-t-2 border-navy">
          {lines.map((l) => (
            <li
              key={l.code}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-1 border-b border-line px-3 py-4 sm:grid-cols-[8rem_minmax(0,1fr)_9rem]"
            >
              <span className="text-sm text-ink-3 max-sm:col-span-2">{l.english}</span>
              <span lang={l.code} dir={l.dir} className="text-xl leading-snug">
                {withName(l.before)}
                <bdi dir="ltr" className="border-b-[3px] border-signal">{l.amount.replace(/[\u200e\u200f]/g, "")}</bdi>
                {withName(l.after)}
                {l.subtitle && (
                  <span lang="en" dir="ltr" className="v-sub">
                    {l.subtitle}
                  </span>
                )}
              </span>
              <span className="text-right font-semibold tabular-nums">40.00 USD</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-ink-3">The words change by language. The amount is written the same way in every one of them, and the right-hand column is the value code checks.</p>
      </section>
    </>
  );
}
