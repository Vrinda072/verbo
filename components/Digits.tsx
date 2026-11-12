/** A phone number with the digits that differ from another number marked. US numbers read as +1 (408) 555-0139. */
export function Digits({ digits, positions, className = "" }: { digits: string; positions: number[]; className?: string }) {
  const sep: Record<number, string> = digits.length === 11 && digits[0] === "1" ? { 1: " (", 4: ") ", 7: "-" } : {};
  return (
    <span dir="ltr" className={`font-semibold tabular-nums tracking-wide ${className}`}>
      +
      {digits.split("").map((d, i) => (
        <span key={i}>
          {sep[i]}
          {positions.includes(i) ? (
            <mark className="rounded-[4px] bg-marigold-soft px-0.5 text-marigold-ink underline decoration-marigold decoration-2 underline-offset-2">{d}</mark>
          ) : (
            d
          )}
        </span>
      ))}
    </span>
  );
}
