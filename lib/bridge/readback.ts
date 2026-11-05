/**
 * Fixed read-back: picks a pre-written template for the language and inserts code-formatted values.
 * No LLM at confirmation time. Falls back to English (and says so) when a language has no template yet.
 */
import templatesFile from "./templates.json";
import languagesFile from "./languages.json";
import type { Money } from "@/lib/paypal/types";

export type TemplateKey = (typeof templatesFile.keys)[number] &
  ("title" | "readback" | "confirm" | "cancel" | "edit" | "lookalike" | "typed_amount" | "currency_assumed" | "first_time");

interface TemplateEntry {
  source: "authored" | "machine" | "native";
  reviewed: boolean;
  strings: Record<TemplateKey, string>;
}

const TEMPLATES = templatesFile.templates as Record<string, TemplateEntry>;
export const TEMPLATE_KEYS = templatesFile.keys as TemplateKey[];
export const PLACEHOLDERS: Partial<Record<TemplateKey, string[]>> = {
  readback: ["amount", "recipient"],
  lookalike: ["other"],
};

export interface LanguageInfo {
  code: string;
  englishName: string;
  nativeName: string;
  dir: "ltr" | "rtl";
  tier: "A" | "B" | "C";
  reviewed: boolean;
}
export const LANGUAGES = (languagesFile.languages as LanguageInfo[]).slice();

export function templateLanguages(): string[] {
  return Object.keys(TEMPLATES);
}

export interface ReadbackLabels {
  lang: string;
  /** Language the strings are actually in (may be "en" when falling back). */
  usedLang: string;
  dir: "ltr" | "rtl";
  fallback: boolean;
  machineTranslated: boolean;
  reviewed: boolean;
  t: (key: TemplateKey, vars?: Record<string, string>) => string;
}

export function langDir(code: string): "ltr" | "rtl" {
  return LANGUAGES.find((l) => l.code === code)?.dir ?? (["ar", "he", "fa", "ur"].includes(code) ? "rtl" : "ltr");
}

export function labelsFor(lang: string): ReadbackLabels {
  const base = lang.split("-")[0];
  const entry = TEMPLATES[base];
  const usedLang = entry ? base : "en";
  const e = entry ?? TEMPLATES.en;
  return {
    lang: base,
    usedLang,
    dir: langDir(usedLang),
    fallback: !entry,
    machineTranslated: e.source === "machine",
    reviewed: e.reviewed,
    t: (key, vars = {}) => e.strings[key].replace(/\{(\w+)\}/g, (_m, k: string) => vars[k] ?? `{${k}}`),
  };
}

/** Amount formatted by code (Intl), in the speaker's locale, plus a plain-digit version for the big display. */
export function formatAmount(m: Money, lang: string): { localized: string; digits: string } {
  const localized = new Intl.NumberFormat(lang, { style: "currency", currency: m.currency }).format(m.cents / 100);
  const digits = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(m.cents / 100);
  return { localized, digits };
}
