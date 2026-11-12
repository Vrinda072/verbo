import type { ReadbackLabels, TemplateKey } from "@/lib/bridge/readback";
import { En } from "@/components/ui/En";

const STEPS: TemplateKey[] = ["s_step_speak", "s_step_check", "s_step_approve"];

/** Where the person is in sending, in their language. Money can only move after the last step. */
export function Stepper({ current, L }: { current: 0 | 1 | 2; L: ReadbackLabels }) {
  return (
    <ol aria-label="Steps to send" className="flex flex-wrap items-start gap-x-2 gap-y-1 text-sm font-semibold">
      {STEPS.map((s, i) => (
        <li key={s} aria-current={i === current ? "step" : undefined} className="flex items-start gap-2">
          <span
            aria-hidden
            className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs ${
              i < current ? "bg-brand text-brand-ink" : i === current ? "bg-ink text-paper" : "border border-line-strong text-ink-3"
            }`}
          >
            {i < current ? "✓" : i + 1}
          </span>
          <span lang={L.usedLang} className={i === current ? "text-ink" : "text-ink-3"}>
            {L.t(s)}
            <En L={L} k={s} className="text-xs" />
          </span>
          {i < STEPS.length - 1 && <span aria-hidden className="mx-1 mt-3 h-px w-5 bg-line-strong sm:w-8" />}
        </li>
      ))}
    </ol>
  );
}
