/** Splits a name into the part shared with another name and the letters that differ, so a look-alike is easy to see. */
export function diffParts(name: string, other: string): { start: string; differs: string; end: string } {
  let s = 0;
  while (s < name.length && s < other.length && name[s].toLowerCase() === other[s].toLowerCase()) s++;
  let e = 0;
  while (e < name.length - s && e < other.length - s && name[name.length - 1 - e].toLowerCase() === other[other.length - 1 - e].toLowerCase()) e++;
  return { start: name.slice(0, s), differs: name.slice(s, name.length - e), end: name.slice(name.length - e) };
}
