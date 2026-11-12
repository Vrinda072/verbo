/**
 * Fixed read-back: picks a pre-written template for the language and inserts code-formatted values.
 * No LLM at confirmation time. Falls back to English (and says so) when a language has no template yet.
 */
import templatesFile from "./templates.json";
import languagesFile from "./languages.json";
import type { Money } from "@/lib/paypal/types";

export type TemplateKey =
  | "title" | "readback" | "confirm" | "cancel" | "edit" | "lookalike" | "typed_amount" | "currency_assumed" | "first_time"
  | "unusual_amount" | "pressure" | "hold_title" | "hold_notice" | "cancel_hold" | "sent" | "cancelled"
  | "rc_title" | "rc_body" | "rc_choice" | "rc_return" | "rc_keep" | "rc_chat" | "rc_placeholder" | "rc_send"
  | "rc_returned" | "rc_refused" | "rc_untranslated" | "rc_translated" | "rc_expired"
  | "ask_back" | "case_sent" | "returned_sender" | "ask_which" | "ask_amount" | "ask_recipient"
  | "ask_same_sound" | "ask_option_known" | "ask_option_new" | "word_one" | "word_two"
  | "numbers_checked" | "show_original" | "show_translation" | "number_near"
  | "s_heading" | "s_step_speak" | "s_step_check" | "s_step_approve" | "s_say" | "s_type" | "s_pay_number" | "s_phone"
  | "s_amount" | "s_check" | "s_problem" | "s_which" | "s_asking" | "s_answer" | "opt_paid" | "opt_new"
  | "near_title" | "near_body" | "near_pay" | "near_anyway" | "near_edit";

interface TemplateEntry {
  source: "authored" | "machine" | "native";
  reviewed: boolean;
  strings: Record<TemplateKey, string>;
}

const TEMPLATES = templatesFile.templates as Record<string, TemplateEntry>;
export const TEMPLATE_KEYS = templatesFile.keys as TemplateKey[];
export const PLACEHOLDERS: Partial<Record<TemplateKey, string[]>> = {
  readback: ["amount", "recipient"],
  ask_which: ["a", "b"],
  numbers_checked: ["numbers"],
  number_near: ["contact"],
  near_title: ["contact"],
  near_body: ["owner", "city", "language"],
  near_pay: ["contact"],
  near_anyway: ["owner"],
  ask_option_known: ["n", "name", "letter"],
  ask_option_new: ["n", "name", "letter"],
  lookalike: ["other"],
  hold_notice: ["minutes"],
  sent: ["recipient"],
  rc_body: ["sender", "amount"],
  rc_chat: ["sender"],
  rc_returned: ["sender"],
  rc_refused: ["sender"],
  case_sent: ["recipient"],
  returned_sender: ["recipient"],
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
  /** The template split into literal text and filled-in values, so a screen can isolate each value's direction. */
  parts: (key: TemplateKey, vars?: Record<string, string>) => { text: string; value?: string }[];
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
    parts: (key, vars = {}) =>
      e.strings[key]
        .split(/(\{\w+\})/)
        .filter(Boolean)
        .map((seg) => {
          const m = /^\{(\w+)\}$/.exec(seg);
          return m ? { text: vars[m[1]] ?? seg, value: m[1] } : { text: seg };
        }),
  };
}

/**
 * Amount formatted by code (Intl). Always written the American way ("$40.00"), whatever the language around it, so the
 * figure a sender checks is identical in every read-back. `lang` is kept for callers; it no longer changes the format.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept so existing callers stay valid
export function formatAmount(m: Money, _lang?: string): { localized: string; digits: string } {
  const localized = new Intl.NumberFormat("en-US", { style: "currency", currency: m.currency }).format(m.cents / 100);
  const digits = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(m.cents / 100);
  return { localized, digits };
}

/** A language's name written in the reader's own language ("Arabic" reads "अरबी" in Hindi). */
export function languageNameIn(code: string, readerLang: string): string {
  try {
    return new Intl.DisplayNames([readerLang], { type: "language" }).of(code) ?? code;
  } catch {
    return LANGUAGES.find((l) => l.code === code)?.englishName ?? code;
  }
}
