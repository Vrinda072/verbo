import Link from "next/link";
import { APP_NAME } from "@/lib/config";

const NAV = [
  { href: "/send", label: "Send" },
  { href: "/desk", label: "Case Desk" },
];

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg aria-hidden viewBox="0 0 32 32" className="h-8 w-8">
        <rect width="32" height="32" rx="10" fill="var(--v-evergreen)" />
        {/* a speech bubble that is also a "V" / check */}
        <path
          d="M9 10.5l7 11 7-11"
          fill="none"
          stroke="var(--v-evergreen-ink)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="24.5" cy="24.5" r="3" fill="var(--v-marigold)" />
      </svg>
      <span className="font-display text-2xl font-semibold tracking-tight">{APP_NAME}</span>
    </span>
  );
}

export function SiteHeader() {
  return (
    <header className="border-b border-line/70 bg-paper/80 backdrop-blur supports-[backdrop-filter]:bg-paper/70">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" aria-label={`${APP_NAME} home`} className="rounded-v">
          <Logo />
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-full px-4 py-2 text-base font-bold text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink"
            >
              {n.label}
            </Link>
          ))}
          <span className="ml-2 hidden rounded-full border border-marigold/60 bg-marigold-soft px-3 py-1 text-xs font-bold uppercase tracking-wider text-marigold-ink sm:inline">
            Sandbox
          </span>
        </nav>
      </div>
    </header>
  );
}
