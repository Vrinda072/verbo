/**
 * Paying a typed phone number. Code compares the digits with every contact's number: an exact match is that contact;
 * a number one digit away (one digit changed, or two neighbours swapped) is flagged with the contact it nearly is.
 */
import { normalizeDigits } from "@/lib/agents/numbers";
import { CONTACTS, PEOPLE, type Contact } from "@/lib/people/contacts";

export const digitsOf = (s: string) => normalizeDigits(s).replace(/\D/g, "");

/** Where two equal-length numbers differ, if they are one digit apart. Null when they are equal or further apart. */
export function oneDigitApart(a: string, b: string): number[] | null {
  if (a.length !== b.length || a === b) return null;
  const diff: number[] = [];
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff.push(i);
  if (diff.length === 1) return diff;
  const [i, j] = diff;
  if (diff.length === 2 && j === i + 1 && a[i] === b[j] && a[j] === b[i]) return diff; // swapped neighbours
  return null;
}

export interface NumberLookup {
  /** Whose PayPal account the number belongs to, or null if none. */
  owner: Contact | null;
  /** The contact whose number this nearly is, when the owner is someone else. */
  near: { contact: Contact; positions: number[] } | null;
}

export function lookupNumber(typed: string): NumberLookup {
  const d = digitsOf(typed);
  const owner = PEOPLE.find((p) => digitsOf(p.phone) === d) ?? null;
  if (owner && !owner.stranger) return { owner, near: null };
  for (const c of CONTACTS) {
    const positions = oneDigitApart(d, digitsOf(c.phone));
    if (positions) return { owner, near: { contact: c, positions } };
  }
  return { owner, near: null };
}
