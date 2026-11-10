/**
 * Shows where the money is right now: with the sender, on hold, or with the recipient.
 * Used on the live payment screen and in the walkthrough, driven by the real payment state.
 */
export type PathTone = "safe" | "hold" | "away" | "moving";

const POS = ["0%", "50%", "100%"];
const COIN: Record<PathTone, string> = {
  safe: "bg-success text-white",
  hold: "bg-marigold text-white v-halo",
  away: "bg-brand text-brand-ink",
  moving: "bg-brand text-brand-ink",
};

export function MoneyPath({ stops, at, amount, tone }: { stops: [string, string, string]; at: 0 | 1 | 2; amount: string; tone: PathTone }) {
  return (
    <div role="img" aria-label={`${amount} is at: ${stops[at]}`}>
      <div className="relative mx-8 h-14">
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-line" />
        <div className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-brand transition-all duration-700" style={{ width: POS[at] }} />
        {POS.map((left, i) => (
          <span key={left} className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ${i <= at ? "bg-brand" : "bg-line-strong"}`} style={{ left }} />
        ))}
        <span
          className={`absolute top-1/2 grid h-12 min-w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full px-2 text-sm font-semibold shadow-v-lg transition-all duration-700 ${COIN[tone]}`}
          style={{ left: POS[at], transitionTimingFunction: "var(--v-ease)" }}
        >
          {amount}
        </span>
      </div>
      <div className="mt-1 grid grid-cols-3 text-sm">
        {stops.map((s, i) => (
          <span key={s} className={`${i === 0 ? "text-left" : i === 1 ? "text-center" : "text-right"} ${i === at ? "font-semibold text-ink" : "text-ink-3"}`}>
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
