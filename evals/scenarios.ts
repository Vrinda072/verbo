/**
 * Scripted evaluation scenarios, written by the Verbo team. They measure our pipeline against our own
 * expectations; they are NOT real user data and say nothing about real-world accuracy.
 *
 * Two kinds:
 *  - "pipeline": transcript → extractor → code validation → risk
 *  - "guard":    a deliberately wrong model output fed straight to validation, to check that code catches it
 */
import type { LlmExtraction } from "@/lib/agents/extraction/schema";

export type Expect =
  | { ok: true; recipient: string; cents: number; level: "low" | "medium" | "high" }
  | { ok: false; problem: string };

export interface PipelineScenario {
  kind: "pipeline";
  id: string;
  lang: string;
  transcript: string;
  expect: Expect;
  tags: string[];
}

export interface GuardScenario {
  kind: "guard";
  id: string;
  transcript: string;
  model: Partial<LlmExtraction>;
  expect: { ok: false; problem: string };
  tags: string[];
}

const ok = (recipient: string, cents: number, level: "low" | "medium" | "high"): Expect => ({ ok: true, recipient, cents, level });
const no = (problem: string): Expect => ({ ok: false, problem });

export const PIPELINE: PipelineScenario[] = [
  // --- correct, calm payments to known payees (expect low) ---
  { kind: "pipeline", id: "en-lopez", lang: "en", transcript: "Send 12.34 dollars to Manuel Lopez", expect: ok("c_lopez", 1234, "low"), tags: ["happy"] },
  { kind: "pipeline", id: "en-kiran", lang: "en", transcript: "Pay Kiran Reddy $25", expect: ok("c_kiran", 2500, "low"), tags: ["happy"] },
  { kind: "pipeline", id: "en-lakshmi", lang: "en", transcript: "Give Lakshmi Rao 40 dollars", expect: ok("c_lakshmi", 4000, "low"), tags: ["happy"] },
  { kind: "pipeline", id: "te-lopez", lang: "te", transcript: "మాన్యుయెల్ లోపెజ్ కి 12.34 డాలర్లు పంపండి", expect: ok("c_lopez", 1234, "low"), tags: ["happy", "native-script"] },
  { kind: "pipeline", id: "te-lopez-digits", lang: "te", transcript: "మాన్యుయెల్ లోపెజ్ కి ౨౦ డాలర్లు పంపండి", expect: ok("c_lopez", 2000, "low"), tags: ["happy", "native-digits"] },
  { kind: "pipeline", id: "te-lakshmi", lang: "te", transcript: "లక్ష్మి కి 50 డాలర్లు పంపండి", expect: ok("c_lakshmi", 5000, "low"), tags: ["happy", "native-script"] },
  { kind: "pipeline", id: "te-kiran", lang: "te", transcript: "కిరణ్ కి 30 డాలర్లు పంపు", expect: ok("c_kiran", 3000, "low"), tags: ["happy", "native-script"] },
  { kind: "pipeline", id: "hi-lopez", lang: "hi", transcript: "मैनुअल लोपेज़ को 25 डॉलर भेजो", expect: ok("c_lopez", 2500, "low"), tags: ["happy", "native-script"] },
  { kind: "pipeline", id: "hi-lopez-digits", lang: "hi", transcript: "मैनुअल लोपेज़ को २० डॉलर भेजो", expect: ok("c_lopez", 2000, "low"), tags: ["happy", "native-digits"] },
  { kind: "pipeline", id: "es-lopez", lang: "es", transcript: "Envía 20 dólares a Manuel López", expect: ok("c_lopez", 2000, "low"), tags: ["happy"] },
  { kind: "pipeline", id: "es-lopez-comma", lang: "es", transcript: "Envía 12,34 dólares a Manuel Lopez", expect: ok("c_lopez", 1234, "low"), tags: ["happy", "decimal-comma"] },
  { kind: "pipeline", id: "pt-kiran", lang: "pt", transcript: "Envie 25 dólares para Kiran Reddy", expect: ok("c_kiran", 2500, "low"), tags: ["happy"] },
  { kind: "pipeline", id: "ar-lopez", lang: "ar", transcript: "أرسل 30 دولارا إلى مانويل لوبيز", expect: ok("c_lopez", 3000, "low"), tags: ["happy", "rtl"] },
  { kind: "pipeline", id: "ar-lopez-digits", lang: "ar", transcript: "أرسل ٣٠ دولارا إلى مانويل لوبيز", expect: ok("c_lopez", 3000, "low"), tags: ["happy", "rtl", "native-digits"] },
  { kind: "pipeline", id: "en-thousands", lang: "en", transcript: "Send 1,000 dollars to Kiran Reddy", expect: ok("c_kiran", 100000, "medium"), tags: ["unusual"] },

  // --- the look-alike mistake (expect high + hold) ---
  { kind: "pipeline", id: "en-lopes", lang: "en", transcript: "Send 12.34 dollars to Manuel Lopes", expect: ok("c_lopes", 1234, "high"), tags: ["look-alike"] },
  { kind: "pipeline", id: "te-lopes", lang: "te", transcript: "మాన్యుయెల్ లోపెస్ కి 12.34 డాలర్లు పంపండి", expect: ok("c_lopes", 1234, "high"), tags: ["look-alike", "native-script"] },
  { kind: "pipeline", id: "hi-lopes", lang: "hi", transcript: "मैनुअल लोपेस को 25 डॉलर भेजो", expect: ok("c_lopes", 2500, "high"), tags: ["look-alike", "native-script"] },
  { kind: "pipeline", id: "ar-lopes", lang: "ar", transcript: "أرسل 30 دولارا إلى مانويل لوبيس", expect: ok("c_lopes", 3000, "high"), tags: ["look-alike", "rtl"] },
  { kind: "pipeline", id: "pt-lopes-same-language", lang: "pt", transcript: "Envie 15 dólares para Manuel Lopes", expect: ok("c_lopes", 1500, "high"), tags: ["look-alike", "same-language"] },

  // --- pressure language (expect high) ---
  { kind: "pipeline", id: "en-pressure-police", lang: "en", transcript: "Send 300 dollars to Kiran Reddy right now, the police are waiting", expect: ok("c_kiran", 30000, "high"), tags: ["pressure"] },
  { kind: "pipeline", id: "en-pressure-secret", lang: "en", transcript: "Pay Lakshmi Rao 60 dollars and don't tell anyone", expect: ok("c_lakshmi", 6000, "medium"), tags: ["pressure"] },
  { kind: "pipeline", id: "en-pressure-giftcard", lang: "en", transcript: "Send 200 to Ana Souza for the gift card, hurry", expect: ok("c_ana", 20000, "high"), tags: ["pressure", "first-time"] },
  { kind: "pipeline", id: "te-pressure", lang: "te", transcript: "కిరణ్ కి 40 డాలర్లు వెంటనే పంపండి, ఎవరికీ చెప్పకండి", expect: ok("c_kiran", 4000, "medium"), tags: ["pressure", "native-script"] },
  { kind: "pipeline", id: "es-pressure", lang: "es", transcript: "Envía 500 dólares a Kiran Reddy, es urgente, la policía", expect: ok("c_kiran", 50000, "high"), tags: ["pressure"] },
  { kind: "pipeline", id: "hi-pressure", lang: "hi", transcript: "किरण रेड्डी को 40 डॉलर तुरंत भेजो", expect: ok("c_kiran", 4000, "medium"), tags: ["pressure", "native-script"] },
  { kind: "pipeline", id: "ar-pressure", lang: "ar", transcript: "أرسل 50 دولارا إلى مانويل لوبيز فورا", expect: ok("c_lopez", 5000, "high"), tags: ["pressure", "look-alike", "rtl"] },
  { kind: "pipeline", id: "en-taxi-not-pressure", lang: "en", transcript: "Pay Kiran Reddy 25 dollars for the taxi", expect: ok("c_kiran", 2500, "low"), tags: ["false-positive-check"] },

  // --- unusual amounts ---
  { kind: "pipeline", id: "en-unusual-lakshmi", lang: "en", transcript: "Send 500 dollars to Lakshmi Rao", expect: ok("c_lakshmi", 50000, "medium"), tags: ["unusual"] },
  { kind: "pipeline", id: "en-unusual-first", lang: "en", transcript: "Send 900 dollars to Ana Souza", expect: ok("c_ana", 90000, "high"), tags: ["unusual", "first-time"] },
  { kind: "pipeline", id: "en-normal-high-ish", lang: "en", transcript: "Send 90 dollars to Lakshmi Rao", expect: ok("c_lakshmi", 9000, "low"), tags: ["under-floor"] },

  // --- first-time recipient, no look-alike ---
  { kind: "pipeline", id: "pt-ana", lang: "pt", transcript: "Envie 20 dólares para Ana Souza", expect: ok("c_ana", 2000, "low"), tags: ["first-time", "same-language"] },
  { kind: "pipeline", id: "te-ana", lang: "te", transcript: "Ana Souza కి 20 డాలర్లు పంపండి", expect: ok("c_ana", 2000, "medium"), tags: ["first-time", "mixed-script"] },

  // --- things that must be refused or clarified ---
  { kind: "pipeline", id: "en-euros", lang: "en", transcript: "Send 50 euros to Manuel Lopez", expect: no("currency_unsupported"), tags: ["currency"] },
  { kind: "pipeline", id: "en-rupees", lang: "en", transcript: "Send 500 rupees to Kiran Reddy", expect: no("currency_unsupported"), tags: ["currency"] },
  { kind: "pipeline", id: "en-unknown", lang: "en", transcript: "Send 20 dollars to Zara Khan", expect: no("missing_recipient"), tags: ["unknown"] },
  { kind: "pipeline", id: "en-bare-manuel", lang: "en", transcript: "Send 20 dollars to Manuel", expect: no("recipient_ambiguous"), tags: ["ambiguous"] },
  { kind: "pipeline", id: "en-no-amount", lang: "en", transcript: "Send money to Manuel Lopez", expect: no("missing_amount"), tags: ["missing"] },
  { kind: "pipeline", id: "en-too-much", lang: "en", transcript: "Send 20000 dollars to Kiran Reddy", expect: no("amount_out_of_range"), tags: ["limit"] },
  { kind: "pipeline", id: "en-weather", lang: "en", transcript: "What's the weather tomorrow", expect: no("not_a_payment"), tags: ["off-topic"] },
  { kind: "pipeline", id: "en-words-only", lang: "en", transcript: "Send twenty dollars to Manuel Lopez", expect: ok("c_lopez", 2000, "low"), tags: ["words"] },
  { kind: "pipeline", id: "es-words", lang: "es", transcript: "Envía veinte dólares a Manuel López", expect: ok("c_lopez", 2000, "low"), tags: ["words"] },
  { kind: "pipeline", id: "te-words", lang: "te", transcript: "మాన్యుయెల్ లోపెజ్ కి ఇరవై ఐదు డాలర్లు పంపండి", expect: ok("c_lopez", 2500, "low"), tags: ["words", "native-script"] },
  { kind: "pipeline", id: "hi-words-do", lang: "hi", transcript: "मैनुअल लोपेज़ को बीस डॉलर भेज दो", expect: ok("c_lopez", 2000, "low"), tags: ["words", "native-script"] },
  { kind: "pipeline", id: "te-spelling", lang: "te", transcript: "మాన్యుయల్ లోపెజ్ కి 20 డాలర్లు పంపండి", expect: ok("c_lopez", 2000, "low"), tags: ["speech-spelling"] },
  { kind: "pipeline", id: "en-dollars-cents", lang: "en", transcript: "Send 12 dollars and 34 cents to Manuel Lopez", expect: ok("c_lopez", 1234, "low"), tags: ["speech-format"] },
  { kind: "pipeline", id: "en-two-amounts", lang: "en", transcript: "Send 20 to Kiran Reddy, no wait 200", expect: no("missing_amount"), tags: ["ambiguous"] },
  { kind: "pipeline", id: "hi-rupees", lang: "hi", transcript: "किरण रेड्डी को 500 रुपये भेजो", expect: no("currency_unsupported"), tags: ["currency", "native-script"] },
];

export const GUARDS: GuardScenario[] = [
  { kind: "guard", id: "g-inflated", transcript: "Send 12.34 dollars to Manuel Lopez", model: { amount: "120.34" }, expect: { ok: false, problem: "amount_not_in_transcript" }, tags: ["hallucination"] },
  { kind: "guard", id: "g-extra-zero", transcript: "Send 20 dollars to Kiran Reddy", model: { recipient_spoken: "Kiran Reddy", recipient_latin: "Kiran Reddy", amount: "200" }, expect: { ok: false, problem: "amount_not_in_transcript" }, tags: ["hallucination"] },
  { kind: "guard", id: "g-three-decimals", transcript: "Send 12.345 to Manuel Lopez", model: { amount: "12.345" }, expect: { ok: false, problem: "amount_invalid" }, tags: ["format"] },
  { kind: "guard", id: "g-negative", transcript: "Send -5 to Manuel Lopez", model: { amount: "-5" }, expect: { ok: false, problem: "amount_invalid" }, tags: ["format"] },
  { kind: "guard", id: "g-scientific", transcript: "Send 1e3 to Manuel Lopez", model: { amount: "1e3" }, expect: { ok: false, problem: "amount_invalid" }, tags: ["format"] },
  { kind: "guard", id: "g-converted", transcript: "Send 50 euros to Manuel Lopez", model: { amount: "54.10", currency: "USD" }, expect: { ok: false, problem: "amount_not_in_transcript" }, tags: ["conversion"] },
  { kind: "guard", id: "g-swapped-person", transcript: "Send 20 dollars to Manuel Lopes", model: { recipient_spoken: "Manuel Lopes", recipient_latin: "Lakshmi Rao", amount: "20" }, expect: { ok: false, problem: "recipient_ambiguous" }, tags: ["substitution"] },
  { kind: "guard", id: "g-invented-person", transcript: "Send 20 dollars", model: { recipient_spoken: "Zara Khan", recipient_latin: "Zara Khan", amount: "20" }, expect: { ok: false, problem: "recipient_not_found" }, tags: ["hallucination"] },
  { kind: "guard", id: "g-over-limit", transcript: "Send 99999 to Kiran Reddy", model: { recipient_spoken: "Kiran Reddy", recipient_latin: "Kiran Reddy", amount: "99999" }, expect: { ok: false, problem: "amount_out_of_range" }, tags: ["limit"] },
];
