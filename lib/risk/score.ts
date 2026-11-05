/**
 * Pre-send risk score. Pure code over facts we already have; no model decides the level.
 *   low    → normal confirmation
 *   medium → notices on the card, no hold
 *   high   → the payment is authorized but held (uncaptured) for the hold window; cancel = VOID
 * Weights are hand-set for the demo and documented here; they are not tuned on real fraud data.
 */
import type { Contact } from "@/lib/contacts";
import { SENDER_HISTORY, type PastPayment } from "@/lib/history";
import { findPressureCues, type PressureCue } from "./pressure";

export type RiskLevel = "low" | "medium" | "high";

export type RiskSignal =
  | { code: "similar_recipient"; weight: number; others: string[] }
  | { code: "first_time"; weight: number }
  | { code: "unusual_amount"; weight: number; medianCents: number | null }
  | { code: "pressure_language"; weight: number; cues: PressureCue[] }
  | { code: "language_mismatch"; weight: number; recipientLanguage: string };

export interface RiskAssessment {
  level: RiskLevel;
  score: number;
  hold: boolean;
  signals: RiskSignal[];
}

export const WEIGHTS = {
  similarUnpaid: 3, // look-alike exists and the chosen contact was never paid
  similarPaid: 1, // look-alike exists but the chosen contact is a known payee
  firstTime: 1,
  unusualAmount: 2,
  pressure: 3,
  languageMismatch: 1,
} as const;
export const MEDIUM_AT = 2;
export const HIGH_AT = 4;
export const UNUSUAL_MULTIPLE = 3;
export const UNUSUAL_FLOOR_CENTS = 10_000; // never flag amounts under $100 as unusual
export const ABSOLUTE_UNUSUAL_CENTS = 100_000; // $1,000 is always unusual for this sender

export interface RiskInput {
  recipient: Contact;
  lookAlikes: Contact[];
  cents: number;
  transcript: string;
  senderLanguage: string;
  modelPressureCues?: string[];
  history?: PastPayment[];
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

export function assessRisk(input: RiskInput): RiskAssessment {
  const history = input.history ?? SENDER_HISTORY;
  const signals: RiskSignal[] = [];
  const paidBefore = history.some((p) => p.contactId === input.recipient.id);

  if (input.lookAlikes.length)
    signals.push({
      code: "similar_recipient",
      weight: paidBefore ? WEIGHTS.similarPaid : WEIGHTS.similarUnpaid,
      others: input.lookAlikes.map((c) => c.name),
    });

  if (!paidBefore) signals.push({ code: "first_time", weight: WEIGHTS.firstTime });

  const med = median(history.map((p) => p.cents));
  const unusual =
    input.cents >= ABSOLUTE_UNUSUAL_CENTS ||
    (input.cents >= UNUSUAL_FLOOR_CENTS && (med === null || input.cents > med * UNUSUAL_MULTIPLE));
  if (unusual) signals.push({ code: "unusual_amount", weight: WEIGHTS.unusualAmount, medianCents: med });

  const cues = findPressureCues(input.transcript, input.modelPressureCues);
  if (cues.length) signals.push({ code: "pressure_language", weight: WEIGHTS.pressure, cues });

  const senderLang = input.senderLanguage.split("-")[0];
  if (!paidBefore && input.recipient.language !== senderLang)
    signals.push({ code: "language_mismatch", weight: WEIGHTS.languageMismatch, recipientLanguage: input.recipient.language });

  const score = signals.reduce((s, x) => s + x.weight, 0);
  const level: RiskLevel = score >= HIGH_AT ? "high" : score >= MEDIUM_AT ? "medium" : "low";
  return { level, score, hold: level === "high", signals };
}
