/**
 * Script-independent sound key for names, so "लक्ष्मी राव", "లక్ష్మి రావ్" and "Lakshmi Rao" compare equal without a model.
 * Keeps consonants only and merges sounds that spelling or scripts blur (t/d, k/g, p/b/f, j/z).
 * s and z stay distinct on purpose: that difference separates Lopes from Lopez.
 */
import { normalizeName } from "@/lib/agents/similarity";

const LATIN: Record<string, string> = {
  b: "p", c: "k", d: "t", f: "p", g: "k", j: "z", k: "k", l: "l", m: "m", n: "n", p: "p", q: "k", r: "r", s: "s", t: "t", x: "k", z: "z",
};

/** Indic Unicode blocks share one layout, so a single table by offset covers Devanagari, Telugu, Bengali, Tamil, … */
const INDIC_BLOCKS = [0x0900, 0x0980, 0x0a00, 0x0a80, 0x0b00, 0x0b80, 0x0c00, 0x0c80, 0x0d00];
const INDIC: Record<number, string> = {
  0x15: "k", 0x16: "k", 0x17: "k", 0x18: "k", 0x19: "n", 0x1a: "k", 0x1b: "k", 0x1c: "z", 0x1d: "z", 0x1e: "n",
  0x1f: "t", 0x20: "t", 0x21: "t", 0x22: "t", 0x23: "n", 0x24: "t", 0x25: "t", 0x26: "t", 0x27: "t", 0x28: "n", 0x29: "n",
  0x2a: "p", 0x2b: "p", 0x2c: "p", 0x2d: "p", 0x2e: "m", 0x30: "r", 0x31: "r", 0x32: "l", 0x33: "l", 0x34: "l",
  0x36: "s", 0x37: "s", 0x38: "s",
};
const ARABIC: Record<string, string> = {
  ب: "p", ت: "t", ث: "s", ج: "z", خ: "k", د: "t", ذ: "z", ر: "r", ز: "z", س: "s", ش: "s", ص: "s", ض: "t", ط: "t", ظ: "z",
  غ: "k", ف: "p", ق: "k", ك: "k", ل: "l", م: "m", ن: "n", پ: "p",
};

function soundOf(ch: string): string {
  const cp = ch.codePointAt(0)!;
  const block = INDIC_BLOCKS.find((b) => cp >= b && cp < b + 0x80);
  if (block !== undefined) return INDIC[cp - block] ?? "";
  return LATIN[ch] ?? ARABIC[ch] ?? "";
}

/** One key per word; repeated sounds collapse ("Reddy" and "रेड्डी" both give "rt"). */
export function phoneticKey(name: string): string {
  return normalizeName(name)
    .split(" ")
    .map((word) => {
      let key = "";
      for (const ch of word) {
        const s = soundOf(ch);
        if (s && !key.endsWith(s)) key += s;
      }
      return key;
    })
    .filter(Boolean)
    .join(" ");
}
