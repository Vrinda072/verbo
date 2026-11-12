"use client";
import { useEffect, useState, type ReactNode } from "react";

/** The phone's clock, set after mount so server and browser render the same markup. */
function Clock() {
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    const fmt = () => setNow(new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: false }).format(new Date()));
    fmt();
    const t = setInterval(fmt, 15_000);
    return () => clearInterval(t);
  }, []);
  return <span className="tabular-nums">{now ?? "9:41"}</span>;
}

function StatusIcons() {
  return (
    <span aria-hidden className="flex items-center gap-1.5">
      <svg viewBox="0 0 18 12" className="h-3 w-[18px]" fill="currentColor">
        <rect x="0" y="8" width="3" height="4" rx="1" />
        <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
        <rect x="10" y="3" width="3" height="9" rx="1" />
        <rect x="15" y="0" width="3" height="12" rx="1" />
      </svg>
      <svg viewBox="0 0 16 12" className="h-3 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M1.5 4.5a9.5 9.5 0 0 1 13 0M4 7.2a6 6 0 0 1 8 0" />
        <circle cx="8" cy="10" r="1.2" fill="currentColor" stroke="none" />
      </svg>
      <svg viewBox="0 0 27 13" className="h-3 w-[27px]">
        <rect x="0.5" y="0.5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" strokeOpacity="0.5" />
        <rect x="2" y="2" width="16" height="9" rx="2" fill="currentColor" />
        <path d="M25 4.5v4a2 2 0 0 0 0-4z" fill="currentColor" fillOpacity="0.5" />
      </svg>
    </span>
  );
}

/**
 * A drawn iPhone: navy frame, status bar with a live clock, the island, and a home indicator. `top` is the navy area under
 * the status bar (the app's own bar); `children` is the screen body on paper.
 */
export function IPhone({ top, children, label }: { top: ReactNode; children: ReactNode; label: string }) {
  return (
    <figure aria-label={label} className="relative mx-auto w-full max-w-[320px] select-none">
      {/* side buttons */}
      <span aria-hidden className="absolute -left-[3px] top-[104px] h-7 w-[3px] rounded-l bg-navy-2" />
      <span aria-hidden className="absolute -left-[3px] top-[148px] h-12 w-[3px] rounded-l bg-navy-2" />
      <span aria-hidden className="absolute -left-[3px] top-[206px] h-12 w-[3px] rounded-l bg-navy-2" />
      <span aria-hidden className="absolute -right-[3px] top-[164px] h-[72px] w-[3px] rounded-r bg-navy-2" />

      <div className="rounded-[54px] bg-navy p-[11px] shadow-v-lg ring-1 ring-navy-2">
        <div className="relative flex h-[620px] flex-col overflow-hidden rounded-[44px] bg-paper">
          <div className="bg-navy text-navy-ink">
            <div className="relative flex h-12 items-center justify-between px-7 pt-1 text-[15px] font-semibold">
              <Clock />
              <span aria-hidden className="absolute left-1/2 top-2.5 h-[30px] w-[100px] -translate-x-1/2 rounded-full bg-navy ring-1 ring-navy-2" />
              <StatusIcons />
            </div>
            {top}
          </div>
          <div className="relative min-h-0 flex-1 overflow-hidden">{children}</div>
          <span aria-hidden className="absolute bottom-2 left-1/2 h-[5px] w-[120px] -translate-x-1/2 rounded-full bg-ink" />
        </div>
      </div>
    </figure>
  );
}
