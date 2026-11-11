/**
 * Which contacts speech could confuse. Two names belong together when they sound the same by code's sound key, or are
 * as close in spelling as the voice check's own threshold (MATCH in validate.ts), so the grid and the voice check agree.
 */
import { phoneticKey } from "@/lib/agents/phonetic";
import { jaroWinkler, normalizeName } from "@/lib/agents/similarity";
import type { Contact } from "@/lib/contacts";

export const SOUND_ALIKE_AT = 0.9;

export function confusable(a: string, b: string): boolean {
  return phoneticKey(a) === phoneticKey(b) || jaroWinkler(normalizeName(a), normalizeName(b)) >= SOUND_ALIKE_AT;
}

/** Groups of names that belong together; a contact nobody resembles is a group of one. */
export function soundAlikeGroups(people: Contact[]): string[][] {
  const groups: string[][] = [];
  for (const p of people) {
    const g = groups.find((names) => names.some((n) => confusable(n, p.name)));
    if (g) g.push(p.name);
    else groups.push([p.name]);
  }
  return groups;
}
