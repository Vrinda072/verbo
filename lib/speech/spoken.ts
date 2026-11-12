/**
 * The sentences Verbo may speak with a cloud voice: fixed templates, with names from the address book and an amount
 * formatted by code. The voice service only reads them aloud, so it can't say anything the screen doesn't.
 */
import { PLACEHOLDERS, type ReadbackLabels, type TemplateKey } from "@/lib/bridge/readback";
import { CONTACTS } from "@/lib/contacts";

export const SPOKEN_KEYS = ["readback", "lookalike", "ask_which", "ask_amount", "ask_recipient", "ask_same_sound", "ask_option_known", "ask_option_new"] as const;
export type SpokenKey = (typeof SPOKEN_KEYS)[number];
export interface SpokenPart {
  key: SpokenKey;
  vars?: Record<string, string>;
  /** For an option: which word ("one" or "two") the person says to choose it. */
  choice?: 1 | 2;
}

export const MAX_PARTS = 4;
const NAME_VARS = new Set(["recipient", "other", "a", "b", "name"]);
const NAMES = new Set(CONTACTS.map((c) => c.name));

/** A formatted amount: digits, separators and a currency sign or code, nothing else. */
export function looksLikeAmount(s: string): boolean {
  if (s.length > 24) return false;
  const rest = s.replace(/\b(?:US|USD)\b/g, "");
  return /\p{N}/u.test(rest) && /^[\p{N}\p{Sc}.,\s  ٫٬‎‏؜-]+$/u.test(rest);
}

export function partsAreAllowed(parts: SpokenPart[]): boolean {
  if (!parts.length || parts.length > MAX_PARTS) return false;
  return parts.every((p) => {
    if (!(SPOKEN_KEYS as readonly string[]).includes(p.key)) return false;
    const vars = p.vars ?? {};
    const expected = [...(PLACEHOLDERS[p.key as TemplateKey] ?? [])].filter((k) => k !== "n").sort();
    if (Object.keys(vars).sort().join() !== expected.join()) return false;
    if (Boolean(PLACEHOLDERS[p.key as TemplateKey]?.includes("n")) !== (p.choice === 1 || p.choice === 2)) return false;
    return Object.entries(vars).every(([k, v]) =>
      NAME_VARS.has(k) ? NAMES.has(v) : k === "amount" ? looksLikeAmount(v) : k === "letter" && /^[A-Z]{1,2}$/.test(v),
    );
  });
}

export function renderSpoken(parts: SpokenPart[], L: Pick<ReadbackLabels, "t">): string {
  return parts
    .map((p) => L.t(p.key, p.choice ? { ...p.vars, n: L.t(p.choice === 1 ? "word_one" : "word_two") } : p.vars))
    .join(" ");
}
