import Link from "next/link";
import { APP_NAME } from "@/lib/config";

const NAV = [
  { href: "/demo", label: "Demo" },
  { href: "/send", label: "Send" },
  { href: "/desk", label: "Case Desk" },
];

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg aria-hidden viewBox="0 0 32 32" className="h-7 w-7">
        <rect width="32" height="32" rx="7" fill="var(--v-evergreen)" />
        <path
          d="M9 10.5l7 11 7-11"
          fill="none"
          stroke="var(--v-evergreen-ink)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-xl font-semibold tracking-tight">{APP_NAME}</span>
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
              className="whitespace-nowrap rounded-v px-3 py-2 text-base font-bold text-ink-2 sm:px-4 transition-colors hover:bg-paper-2 hover:text-ink"
            >
              {n.label}
            </Link>
          ))}
          <span className="ml-2 hidden rounded-v border border-line-strong px-2 py-0.5 text-xs font-semibold text-ink-2 sm:inline">
            Sandbox
          </span>
        </nav>
      </div>
    </header>
  );
}
