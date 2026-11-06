const STEPS = ["Speak", "Check", "Approve on PayPal"];

/** Where the person is in sending. Money can only move after the last step. */
export function Stepper({ current }: { current: 0 | 1 | 2 }) {
  return (
    <ol aria-label="Steps to send" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-bold">
      {STEPS.map((s, i) => (
        <li key={s} aria-current={i === current ? "step" : undefined} className="flex items-center gap-2">
          <span
            aria-hidden
            className={`grid h-6 w-6 place-items-center rounded-full text-xs ${
              i < current ? "bg-evergreen text-evergreen-ink" : i === current ? "bg-ink text-paper" : "border border-line-strong text-ink-3"
            }`}
          >
            {i < current ? "✓" : i + 1}
          </span>
          <span className={i === current ? "text-ink" : "text-ink-3"}>{s}</span>
          {i < STEPS.length - 1 && <span aria-hidden className="mx-1 h-px w-5 bg-line-strong sm:w-8" />}
        </li>
      ))}
    </ol>
  );
}
