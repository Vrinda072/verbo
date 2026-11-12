import { labelsFor, type ReadbackLabels, type TemplateKey } from "@/lib/bridge/readback";

const EN = labelsFor("en");

/**
 * The English line under a line in another language. Every template string on screen gets one, so a reader who
 * doesn't know the language (a helper, a judge, an operator) can follow, and the reader can check one against the other.
 * Renders nothing when the line is already in English.
 */
export function En({ L, k, vars, className = "" }: { L: ReadbackLabels; k: TemplateKey; vars?: Record<string, string>; className?: string }) {
  if (L.usedLang === "en") return null;
  return (
    <span lang="en" dir="ltr" className={`v-sub ${className}`}>
      {EN.t(k, vars)}
    </span>
  );
}

/** The same, for text that isn't a template (a chat message's English copy). */
export function EnText({ text, show = true, className = "" }: { text: string | null | undefined; show?: boolean; className?: string }) {
  if (!show || !text) return null;
  return (
    <span lang="en" dir="ltr" className={`v-sub ${className}`}>
      {text}
    </span>
  );
}

/**
 * A template line in the reader's language with every filled-in value (amount, name, number) isolated left-to-right,
 * so "$40.00" stays "$40.00" inside Arabic and a Latin name never reorders the sentence around it.
 */
export function Tpl({ L, k, vars }: { L: ReadbackLabels; k: TemplateKey; vars?: Record<string, string> }) {
  return (
    <>
      {L.parts(k, vars).map((p, i) =>
        p.value ? (
          <bdi key={i} dir="ltr" className={p.value === "amount" ? "whitespace-nowrap tabular-nums" : undefined}>
            {p.text.replace(/[\u200e\u200f\u061c]/g, "")}
          </bdi>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}
