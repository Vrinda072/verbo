/**
 * Deterministic number handling for transcripts. Used to check that an amount the LLM extracted
 * actually appears in what the person said ("grounding"). Pure code, no LLM.
 */

/** Code point of digit zero for each Unicode decimal-digit block we normalise. */
const DIGIT_ZEROS = [
  0x0660, // Arabic-Indic
  0x06f0, // Extended Arabic-Indic (Persian, Urdu)
  0x07c0, // NKo
  0x0966, // Devanagari
  0x09e6, // Bengali
  0x0a66, // Gurmukhi
  0x0ae6, // Gujarati
  0x0b66, // Oriya
  0x0be6, // Tamil
  0x0c66, // Telugu
  0x0ce6, // Kannada
  0x0d66, // Malayalam
  0x0de6, // Sinhala Lith
  0x0e50, // Thai
  0x0ed0, // Lao
  0x0f20, // Tibetan
  0x1040, // Myanmar
  0x17e0, // Khmer
  0x1810, // Mongolian
  0xff10, // Fullwidth
];

/** Replace any native-script decimal digit with its ASCII digit. */
export function normalizeDigits(s: string): string {
  let out = "";
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    const zero = DIGIT_ZEROS.find((z) => cp >= z && cp <= z + 9);
    out += zero === undefined ? ch : String.fromCharCode(0x30 + (cp - zero));
  }
  return out;
}

export function hasDigits(s: string): boolean {
  return /\d/.test(normalizeDigits(s));
}

/**
 * Every amount (in cents) a transcript could plausibly mean by its numerals.
 * "1,234.50" → 123450; "12,34" → 1234 (decimal comma) and 1234_00 (thousands); "12" → 1200.
 */
export function candidateCents(transcript: string): Set<number> {
  const text = normalizeDigits(transcript);
  const out = new Set<number>();
  const split = dollarsAndCents(text);
  if (split !== null) out.add(split);
  for (const m of text.matchAll(/\d[\d.,\s  ']*\d|\d/g)) {
    const token = m[0].replace(/[\s  ']/g, "");
    for (const v of interpretations(token)) if (Number.isFinite(v) && v > 0) out.add(Math.round(v * 100));
  }
  return out;
}

function interpretations(token: string): number[] {
  const res: number[] = [];
  const lastDot = token.lastIndexOf(".");
  const lastComma = token.lastIndexOf(",");
  const sep = Math.max(lastDot, lastComma);
  // As a decimal: the last separator is the decimal point if 1–2 digits follow it.
  if (sep > 0 && token.length - sep - 1 >= 1 && token.length - sep - 1 <= 2) {
    const intPart = token.slice(0, sep).replace(/[.,]/g, "");
    res.push(Number(`${intPart}.${token.slice(sep + 1)}`));
  }
  // As a whole number: every separator is a thousands separator.
  res.push(Number(token.replace(/[.,]/g, "")));
  return res;
}

const DOLLARS_AND_CENTS =
  /(\d{1,7})\s*(?:dollars?|d[oó]lar(?:es)?|డాలర్\S*|डॉलर|دولار\S*)\s*(?:and|y|e|और|మరియు|و)?\s*(\d{1,2})\s*(?:cents?|centavos?|సెంట్\S*|सेंट|سنت\S*)/iu;

/** "12 dollars 34 cents" (after digit normalisation) → 1234, or null. */
export function dollarsAndCents(transcript: string): number | null {
  const m = DOLLARS_AND_CENTS.exec(normalizeDigits(transcript));
  return m ? Number(m[1]) * 100 + Number(m[2]) : null;
}

/** The different numbers said, as plain decimals. "20, no wait 200" → ["20", "200"]. */
export function distinctNumerals(transcript: string): string[] {
  const text = normalizeDigits(transcript).replace(/(\d),(\d{3})\b/g, "$1$2");
  return [...new Set([...text.matchAll(/\d{1,7}(?:[.,]\d{1,2})?/g)].map((m) => m[0].replace(",", ".")))];
}

/** Parse a strict decimal string ("12", "12.3", "12.34") to integer cents, or null. */
export function decimalToCents(s: string): number | null {
  const m = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(s.trim());
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}
