/**
 * Signed, expiring recovery links. Token = base64url(payload) "." base64url(HMAC-SHA256(payload)).
 * Payload carries only the case id, the role and the expiry — no names, emails or amounts.
 * Secret: TOKEN_SIGNING_SECRET (in .env, never logged).
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export interface RecoveryClaims {
  c: string; // case id
  r: "recipient";
  exp: number; // unix seconds
}

export const LINK_TTL_DAYS = 7;

function secret(): Buffer {
  const s = process.env.TOKEN_SIGNING_SECRET;
  if (!s || s.length < 32) throw new Error("TOKEN_SIGNING_SECRET is missing or too short");
  return Buffer.from(s);
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");

export function signRecoveryToken(caseId: string, now = new Date(), ttlDays = LINK_TTL_DAYS): string {
  const claims: RecoveryClaims = { c: caseId, r: "recipient", exp: Math.floor(now.getTime() / 1000) + ttlDays * 86400 };
  const body = b64(JSON.stringify(claims));
  const sig = createHmac("sha256", secret()).update(body).digest();
  return `${body}.${b64(sig)}`;
}

export type VerifyResult = { ok: true; claims: RecoveryClaims } | { ok: false; reason: "malformed" | "bad_signature" | "expired" };

export function verifyRecoveryToken(token: string, now = new Date()): VerifyResult {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: "malformed" };
  const [body, sig] = parts;
  const expected = createHmac("sha256", secret()).update(body).digest();
  let given: Buffer;
  try {
    given = Buffer.from(sig, "base64url");
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: "bad_signature" };
  let claims: RecoveryClaims;
  try {
    claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (typeof claims.c !== "string" || claims.r !== "recipient" || typeof claims.exp !== "number") return { ok: false, reason: "malformed" };
  if (claims.exp * 1000 < now.getTime()) return { ok: false, reason: "expired" };
  return { ok: true, claims };
}
