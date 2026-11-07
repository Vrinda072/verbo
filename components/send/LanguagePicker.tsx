"use client";
import { useId, useMemo, useRef, useState } from "react";
import { LANGUAGES, templateLanguages } from "@/lib/bridge/readback";

const WITH_TEMPLATES = new Set(templateLanguages());

/** Searchable language picker: native name first, English name second, honest coverage badge. */
export function LanguagePicker({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const current = LANGUAGES.find((l) => l.code === value);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = [...LANGUAGES].sort(
      (a, b) => Number(WITH_TEMPLATES.has(b.code)) - Number(WITH_TEMPLATES.has(a.code)) || a.englishName.localeCompare(b.englishName),
    );
    return s ? list.filter((l) => `${l.nativeName} ${l.englishName} ${l.code}`.toLowerCase().includes(s)) : list;
  }, [q]);

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-12 items-center gap-3 rounded-v border-2 border-line-strong bg-card px-5 font-bold text-ink transition-colors hover:bg-paper-2"
      >
        <span aria-hidden className="text-ink-3">
          <GlobeIcon />
        </span>
        <span lang={current?.code} dir={current?.dir}>
          {current?.nativeName ?? value}
        </span>
        <span className="hidden text-sm font-normal text-ink-3 sm:inline">{current?.englishName}</span>
      </button>

      {open && (
        <div className="absolute left-0 z-20 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-v-lg border border-line bg-card p-2 shadow-v-lg">
          <label className="sr-only" htmlFor={`${listId}-q`}>
            Search languages
          </label>
          <input
            ref={inputRef}
            autoFocus
            id={`${listId}-q`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
            placeholder="Search — e.g. Telugu, తెలుగు"
            className="w-full rounded-v border border-line bg-paper px-4 py-3 text-base outline-none focus:border-sky"
          />
          <ul id={listId} role="listbox" aria-label="Languages" className="mt-2 max-h-72 overflow-auto">
            {results.map((l) => (
              <li key={l.code} role="option" aria-selected={l.code === value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(l.code);
                    setOpen(false);
                    setQ("");
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-v px-3 py-2.5 text-left hover:bg-paper-2 ${
                    l.code === value ? "bg-evergreen-soft" : ""
                  }`}
                >
                  <span>
                    <span lang={l.code} dir={l.dir} className="block font-bold">
                      {l.nativeName}
                    </span>
                    <span className="block text-sm text-ink-3">{l.englishName}</span>
                  </span>
                  <span
                    className={`shrink-0 rounded-v px-2 py-0.5 text-xs font-bold ${
                      WITH_TEMPLATES.has(l.code) ? "bg-evergreen-soft text-evergreen" : "bg-paper-2 text-ink-3"
                    }`}
                  >
                    {WITH_TEMPLATES.has(l.code) ? "Read-back" : "No read-back yet"}
                  </span>
                </button>
              </li>
            ))}
            {!results.length && <li className="px-3 py-4 text-ink-3">No language matches “{q}”.</li>}
          </ul>
          <p className="border-t border-line px-3 pt-2 text-xs text-ink-3">
            {LANGUAGES.length} languages · {WITH_TEMPLATES.size} with a written read-back (machine-translated unless
            marked reviewed). Which ones you can speak depends on your browser.
          </p>
        </div>
      )}
    </div>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
    </svg>
  );
}
