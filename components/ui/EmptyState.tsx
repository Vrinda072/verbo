import Link from "next/link";

/** Shared empty/placeholder state. Every screen uses it until its real content lands. */
export function EmptyState({
  eyebrow,
  title,
  body,
  action,
}: {
  eyebrow?: string;
  title: string;
  body: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="mx-auto max-w-xl rounded-v-lg border border-dashed border-line-strong bg-card px-6 py-12 text-center sm:px-10">
      {eyebrow && <p className="text-sm font-semibold text-marigold">{eyebrow}</p>}
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 text-lg text-ink-2">{body}</p>
      {action && (
        <Link
          href={action.href}
          className="mt-6 inline-flex min-h-12 items-center rounded-full bg-brand px-6 font-semibold text-brand-ink"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
