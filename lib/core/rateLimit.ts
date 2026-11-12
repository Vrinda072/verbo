/**
 * A small per-process request cap for routes that spend shared AI quotas. It protects the free quotas on a public demo
 * from casual overuse; it isn't a security control, and it counts all visitors together.
 */
const g = globalThis as unknown as { __verboRate?: Map<string, number[]> };

export function overLimit(bucket: string, perMinute: number, now = Date.now()): boolean {
  g.__verboRate ??= new Map();
  const recent = (g.__verboRate.get(bucket) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= perMinute) {
    g.__verboRate.set(bucket, recent);
    return true;
  }
  recent.push(now);
  g.__verboRate.set(bucket, recent);
  return false;
}
