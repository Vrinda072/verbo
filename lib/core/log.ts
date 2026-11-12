/**
 * Tiny structured logger that masks PII and never prints secrets.
 * Use `log.info("msg", data)` everywhere instead of console.log in app code.
 */

const SECRET_KEYS = /secret|token|password|authorization|api[_-]?key|signature|sig$/i;
const EMAIL = /([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
const PHONE = /\+?\d[\d\s().-]{7,}\d/g;

export function maskEmail(email: string): string {
  return email.replace(EMAIL, (_m, first: string, domain: string) => `${first}***@${domain}`);
}

export function maskString(s: string): string {
  return maskEmail(s).replace(PHONE, (m) => `${"*".repeat(Math.max(0, m.length - 2))}${m.slice(-2)}`);
}

export function mask(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[…]";
  if (typeof value === "string") return maskString(value);
  if (Array.isArray(value)) return value.map((v) => mask(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SECRET_KEYS.test(k) ? "[redacted]" : mask(v, depth + 1);
    }
    return out;
  }
  return value;
}

type Level = "debug" | "info" | "warn" | "error";
function emit(level: Level, msg: string, data?: unknown) {
  const line = data === undefined ? msg : `${msg} ${JSON.stringify(mask(data))}`;
  // eslint-disable-next-line no-console
  (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(`[${level}] ${line}`);
}

export const log = {
  debug: (m: string, d?: unknown) => process.env.DEBUG && emit("debug", m, d),
  info: (m: string, d?: unknown) => emit("info", m, d),
  warn: (m: string, d?: unknown) => emit("warn", m, d),
  error: (m: string, d?: unknown) => emit("error", m, d),
};
