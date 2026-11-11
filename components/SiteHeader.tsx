"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Verbo";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/send", label: "Send" },
  { href: "/demo", label: "Examples" },
];
const OPERATOR = { href: "/desk", label: "Case Desk" };

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg aria-hidden viewBox="0 0 32 32" className="h-8 w-8">
        <circle cx="16" cy="16" r="16" fill="var(--v-signal)" />
        <path d="M9.5 10.5l6.5 11 6.5-11" fill="none" stroke="var(--v-navy)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-xl font-semibold tracking-tight">{APP_NAME}</span>
    </span>
  );
}

/** Account-style top bar. The navy bar and active underline carry through every signed-in page. */
export function SiteHeader() {
  const path = usePathname();
  return (
    <header className="bg-navy text-navy-ink">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 sm:gap-8 sm:px-6">
        <Link href="/" aria-label={`${APP_NAME} home`} className="shrink-0 py-4">
          <Logo />
        </Link>
        <nav aria-label="Main" className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {[...NAV, OPERATOR].map((n) => {
            const active = n.href === "/" ? path === "/" : path?.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                title={n === OPERATOR ? "For the team that handles recovery cases" : undefined}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap border-b-[3px] px-3 pb-[1.05rem] pt-[1.25rem] text-base font-medium transition-colors ${
                  active ? "border-signal text-navy-ink" : "border-transparent text-navy-ink/75 hover:text-navy-ink"
                }`}
              >
                {n === OPERATOR && <span className="mr-2 border-l border-navy-ink/25 pl-4 text-xs font-normal text-navy-ink/60">Operators</span>}
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden shrink-0 items-center gap-3 sm:flex">
          <span className="rounded-full bg-navy-2 px-3 py-1 text-xs font-medium">Sandbox</span>
          <span aria-label="Signed in as Sreenivas Rao, simulated" role="img" className="grid h-9 w-9 place-items-center rounded-full bg-signal text-sm font-semibold text-navy">
            SR
          </span>
        </div>
      </div>
    </header>
  );
}
