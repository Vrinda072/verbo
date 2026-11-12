/**
 * The recipient's own clock. A reminder about money that arrives at 3 a.m. in a language they read is still easy to
 * miss, so reminders wait for their daytime. The time zone comes from the contact; a name we don't know falls back to
 * a common zone for the language.
 */
import { PEOPLE } from "@/lib/contacts";

const BY_LANGUAGE: Record<string, string> = {
  en: "America/New_York",
  hi: "Asia/Kolkata",
  te: "Asia/Kolkata",
  es: "America/Mexico_City",
  pt: "America/Sao_Paulo",
  ar: "Africa/Cairo",
};

/** Quiet hours in the recipient's time: from 21:00 to 08:00. */
export const DAY_STARTS = 8;
export const DAY_ENDS = 21;

export function timeZoneFor(name: string, language?: string | null): string {
  return PEOPLE.find((p) => p.name === name)?.timeZone ?? BY_LANGUAGE[(language ?? "").split("-")[0]] ?? "UTC";
}

export function cityFor(name: string): string | null {
  return PEOPLE.find((p) => p.name === name)?.city ?? null;
}

/** Hour of day (0 to 23) at `at` in `tz`. */
export function hourIn(at: Date, tz: string): number {
  return Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: tz }).format(at));
}

export function isQuiet(at: Date, tz: string): boolean {
  const h = hourIn(at, tz);
  return h >= DAY_ENDS || h < DAY_STARTS;
}

/** `at` itself if it is daytime in `tz`, else the next 08:00 there (to the minute). */
export function nextDaytime(at: Date, tz: string): Date {
  let t = new Date(Math.ceil(at.getTime() / 60_000) * 60_000);
  // Step a quarter hour at a time; quiet hours are at most 11 hours, so this ends within 45 steps.
  for (let i = 0; i < 60 && isQuiet(t, tz); i++) t = new Date(t.getTime() + 15 * 60_000);
  return t;
}

/** The quiet stretches in `tz` between `from` and `to`, for shading a timeline. */
export function quietRanges(from: Date, to: Date, tz: string): { start: Date; end: Date }[] {
  const out: { start: Date; end: Date }[] = [];
  let t = new Date(Math.floor(from.getTime() / 3_600_000) * 3_600_000);
  let start: Date | null = null;
  while (t < to) {
    const quiet = isQuiet(t, tz);
    if (quiet && !start) start = t;
    if (!quiet && start) {
      out.push({ start, end: t });
      start = null;
    }
    t = new Date(t.getTime() + 3_600_000);
  }
  if (start) out.push({ start, end: to });
  return out;
}

export const clockIn = (at: Date, tz: string) =>
  new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: tz }).format(at);
