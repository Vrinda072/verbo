/**
 * The spoken follow-up on the Send page. When a voice request is incomplete, Verbo asks one question from a fixed template
 * and listens for the answer. Choosing between similar names uses "one" or "two", because speech recognition can't tell
 * Lopez from Lopes. The answer is matched by code against a closed word list and never interpreted by a model.
 */
import { normalizeDigits } from "@/lib/agents/numbers";
import type { ReadbackLabels } from "@/lib/bridge/readback";
import { CONTACTS } from "@/lib/people/contacts";
import { diffParts } from "@/lib/people/nameDiff";
import { renderSpoken, type SpokenPart } from "./spoken";

export type Question = { kind: "which"; a: string; b: string } | { kind: "amount" } | { kind: "recipient" };

/** Follow-ups allowed for one payment, so a misheard conversation ends with the on-screen controls. */
export const MAX_FOLLOW_UPS = 3;
export const ANSWER_MS: Record<Question["kind"], number> = { which: 3500, amount: 5000, recipient: 5000 };
/** Start listening anyway if the browser never reports that the voice finished. */
export const SPEECH_TIMEOUT_MS = 30_000; // The longest question, two spelled-out options in Arabic, runs about 18 seconds.

export function nextQuestion(problems: { code: string; [k: string]: unknown }[]): Question | null {
  const codes = new Set(problems.map((p) => p.code));
  if (codes.has("not_a_payment")) return null;
  const ambiguous = problems.find((p) => p.code === "recipient_ambiguous");
  const candidates = ambiguous?.candidates as string[] | undefined;
  if (candidates?.length === 2) return { kind: "which", a: candidates[0], b: candidates[1] };
  if (candidates) return null;
  if (codes.has("missing_recipient") || codes.has("recipient_not_found")) return { kind: "recipient" };
  if (codes.has("missing_amount") || codes.has("amount_invalid")) return { kind: "amount" };
  return null;
}

/**
 * Names that sound alike are told apart by what a listener can hear: the letter that differs, and whether the sender has
 * paid that person before. Both come from code and the address book. Without a one- or two-letter difference, the
 * plain question is used.
 */
export function questionParts(q: Question): SpokenPart[] {
  if (q.kind !== "which") return [{ key: q.kind === "amount" ? "ask_amount" : "ask_recipient" }];
  const a = diffParts(q.a, q.b).differs.toUpperCase();
  const b = diffParts(q.b, q.a).differs.toUpperCase();
  if (!/^[A-Z]{1,2}$/.test(a) || !/^[A-Z]{1,2}$/.test(b)) return [{ key: "ask_which", vars: { a: q.a, b: q.b } }];
  const option = (name: string, letter: string, choice: 1 | 2): SpokenPart => ({
    key: CONTACTS.find((c) => c.name === name)?.paidBefore ? "ask_option_known" : "ask_option_new",
    vars: { name, letter },
    choice,
  });
  return [{ key: "ask_same_sound" }, option(q.a, a, 1), option(q.b, b, 2)];
}

export function questionText(q: Question, L: Pick<ReadbackLabels, "t">): string {
  return renderSpoken(questionParts(q), L);
}

const ONE = new Set(["1", "one", "first", "uno", "una", "primero", "primera", "um", "uma", "primeiro", "एक", "पहला", "पहले", "ఒకటి", "మొదటి", "واحد", "واحدة", "الأول", "الاول"]);
const TWO = new Set(["2", "two", "second", "dos", "segundo", "segunda", "dois", "duas", "दो", "दूसरा", "दूसरे", "రెండు", "రెండవ", "اثنان", "اثنين", "الثاني"]);
/** Common mishearings, trusted only when they are the entire answer. */
const ONLY_ONE = new Set(["won"]);
const ONLY_TWO = new Set(["to", "too"]);
const MAX_ANSWER_WORDS = 5;

export function matchChoice(answer: string): 1 | 2 | null {
  const words = normalizeDigits(answer).toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  if (!words.length || words.length > MAX_ANSWER_WORDS) return null;
  if (words.length === 1 && ONLY_ONE.has(words[0])) return 1;
  if (words.length === 1 && ONLY_TWO.has(words[0])) return 2;
  const one = words.some((w) => ONE.has(w));
  const two = words.some((w) => TWO.has(w));
  return one === two ? null : one ? 1 : 2;
}

/** Adds a spoken answer to the original request, so code still validates everything against what was said. */
export function mergeAnswer(original: string, answer: string): string {
  return `${original.trim()} ${answer.trim()}`.slice(0, 500);
}
