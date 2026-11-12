import { diffParts } from "@/lib/people/nameDiff";

/** A name with the letters that differ from a similar contact's name highlighted. */
export function NameDiff({ name, other, className = "" }: { name: string; other: string; className?: string }) {
  const { start, differs, end } = diffParts(name, other);
  return (
    <span className={className}>
      {start}
      {differs && <mark className="rounded-[4px] bg-marigold-soft px-0.5 font-semibold text-marigold-ink underline decoration-marigold decoration-2 underline-offset-2">{differs}</mark>}
      {end}
    </span>
  );
}
