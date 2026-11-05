/**
 * ~300 synthetic recovery cases for the Case Desk. Every row is flagged simulated = 1 and the UI labels it.
 * Deterministic (seeded PRNG) so screenshots and tests are stable. No real people, emails or PayPal ids:
 * ids are prefixed SIM-, emails use example.test.
 */
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { nextCaseState, type CaseEvent, type CaseState } from "@/lib/recovery/state";

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Synthetic first/last names by language. */
const NAMES: Record<string, [string[], string[]]> = {
  es: [["María", "José", "Lucía", "Carlos", "Ana", "Diego"], ["García", "López", "Martínez", "Hernández", "Pérez"]],
  pt: [["João", "Maria", "Ana", "Pedro", "Lucas", "Beatriz"], ["Silva", "Santos", "Oliveira", "Souza", "Costa"]],
  hi: [["Aarav", "Priya", "Rohan", "Ananya", "Vikram", "Neha"], ["Sharma", "Verma", "Gupta", "Singh", "Patel"]],
  te: [["Sreenivas", "Lakshmi", "Ravi", "Padma", "Kiran", "Sujatha"], ["Rao", "Reddy", "Naidu", "Varma", "Chowdary"]],
  ar: [["Omar", "Fatima", "Youssef", "Layla", "Karim", "Huda"], ["Haddad", "Khalil", "Nasser", "Saleh", "Aziz"]],
  zh: [["Wei", "Li", "Fang", "Jun", "Mei", "Hao"], ["Wang", "Li", "Zhang", "Liu", "Chen"]],
  vi: [["Minh", "Lan", "Huy", "Thảo", "Nam", "Linh"], ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng"]],
  tl: [["Jose", "Maria", "Mark", "Grace", "Paolo", "Joy"], ["Santos", "Reyes", "Cruz", "Bautista", "Garcia"]],
  ko: [["Min-jun", "Seo-yeon", "Ji-ho", "Ha-eun", "Do-yun"], ["Kim", "Lee", "Park", "Choi", "Jung"]],
  en: [["James", "Emily", "Michael", "Sarah", "David", "Olivia"], ["Smith", "Johnson", "Brown", "Miller", "Davis"]],
  fr: [["Camille", "Louis", "Chloé", "Hugo", "Léa"], ["Martin", "Bernard", "Dubois", "Moreau", "Laurent"]],
  ru: [["Ivan", "Olga", "Dmitri", "Anna", "Sergei"], ["Ivanov", "Petrova", "Smirnov", "Volkova", "Popov"]],
  ur: [["Ali", "Ayesha", "Hamza", "Sana", "Bilal"], ["Khan", "Ahmed", "Malik", "Hussain", "Qureshi"]],
};

/** Sender / recipient language mix (weights are invented for the demo, not market data). */
const LANG_WEIGHTS: [string, number][] = [
  ["es", 22], ["en", 14], ["hi", 10], ["te", 8], ["pt", 9], ["zh", 7], ["vi", 6], ["tl", 6], ["ar", 6], ["ko", 4], ["fr", 3], ["ru", 3], ["ur", 2],
];

type Outcome = { path: CaseEvent[]; weight: number };
const OUTCOMES: Outcome[] = [
  { path: ["VIEWED", "REPLIED", "RETURN_STARTED", "RETURNED", "CLOSED"], weight: 22 },
  { path: ["VIEWED", "RETURN_STARTED", "RETURNED"], weight: 18 },
  { path: ["VIEWED", "REPLIED"], weight: 12 },
  { path: ["VIEWED"], weight: 9 },
  { path: [], weight: 10 },
  { path: ["REMINDER_SENT", "VIEWED", "REFUSED"], weight: 8 },
  { path: ["REMINDER_SENT", "ESCALATED"], weight: 11 },
  { path: ["VIEWED", "REMINDER_SENT", "ESCALATED", "CLOSED"], weight: 4 },
  { path: ["REMINDER_SENT", "VIEWED", "REFUSED", "RETURN_STARTED", "RETURNED"], weight: 3 },
  { path: ["VIEWED", "REFUSED", "CLOSED"], weight: 3 },
];

const pick = <T>(r: () => number, xs: T[]) => xs[Math.floor(r() * xs.length)];
function weighted<T>(r: () => number, xs: [T, number][]): T {
  const total = xs.reduce((s, [, w]) => s + w, 0);
  let x = r() * total;
  for (const [v, w] of xs) if ((x -= w) < 0) return v;
  return xs[xs.length - 1][0];
}

export const SEED_COUNT = 300;

/** Inserts the simulated cases once; a no-op if any simulated case already exists. */
export async function seedDesk(opts: { count?: number; now?: Date } = {}) {
  const db = await getDb();
  const existing = await db.select({ id: schema.cases.id }).from(schema.cases).where(eq(schema.cases.simulated, 1)).limit(1);
  if (existing.length) return { inserted: 0, skipped: true };

  const r = rng(20261112);
  const now = opts.now ?? new Date();
  const count = opts.count ?? SEED_COUNT;
  const transfers: (typeof schema.transfers.$inferInsert)[] = [];
  const cases: (typeof schema.cases.$inferInsert)[] = [];
  const events: (typeof schema.caseEvents.$inferInsert)[] = [];

  for (let i = 0; i < count; i++) {
    const n = String(i + 1).padStart(4, "0");
    const sLang = weighted(r, LANG_WEIGHTS);
    let rLang = weighted(r, LANG_WEIGHTS);
    if (r() < 0.35) rLang = sLang;
    const [sf, sl] = NAMES[sLang];
    const [rf, rl] = NAMES[rLang];
    const senderName = `${pick(r, sf)} ${pick(r, sl)}`;
    const recipientName = `${pick(r, rf)} ${pick(r, rl)}`;
    const cents = Math.round((5 + r() ** 2 * 1200) * 100);
    const ageH = 2 + r() * 24 * 30;
    const sentAt = new Date(now.getTime() - ageH * 3_600_000);
    const outcome = weighted(r, OUTCOMES.map((o) => [o, o.weight] as [Outcome, number]));

    const transferId = `tr_SIM-${n}`;
    const caseId = `case_SIM-${n}`;
    transfers.push({
      id: transferId,
      kind: "send",
      state: "COMPLETED",
      amountCents: cents,
      senderEmail: `sender${n}@example.test`,
      recipientEmail: `recipient${n}@example.test`,
      orderId: `SIM-ORD-${n}`,
      authorizationId: `SIM-AUTH-${n}`,
      captureId: `SIM-CAP-${n}`,
      payoutBatchId: `SIM-BATCH-${n}`,
      language: sLang,
      riskLevel: r() < 0.45 ? "high" : r() < 0.6 ? "medium" : "low",
      simulated: 1,
      createdAt: sentAt,
      updatedAt: sentAt,
    });

    // Walk the state machine so every seeded timeline is a legal one.
    let state: CaseState = "OPENED";
    let t = sentAt.getTime() + (0.2 + r() * 6) * 3_600_000;
    const openedAt = new Date(t);
    events.push({ caseId, event: "OPENED", fromState: "OPENED", toState: "OPENED", actor: "sender", at: openedAt });
    let to = nextCaseState(state, "LINK_SENT");
    events.push({ caseId, event: "LINK_SENT", fromState: state, toState: to, actor: "system", at: new Date(t + 60_000), data: { channel: "simulated" } });
    state = to;
    const linkSentAt = new Date(t + 60_000);
    let reminders = 0;
    let returnTransferId: string | null = null;
    for (const ev of outcome.path) {
      const gap = ev === "REMINDER_SENT" ? 24 : ev === "ESCALATED" ? 48 : 1 + r() * 20;
      const next = t + gap * 3_600_000;
      if (next > now.getTime()) break; // the future hasn't happened yet
      t = next;
      to = nextCaseState(state, ev);
      const actor = ev === "REMINDER_SENT" || ev === "ESCALATED" ? "system" : ev === "CLOSED" ? "operator" : "recipient";
      if (ev === "REMINDER_SENT") reminders++;
      if (ev === "RETURN_STARTED") returnTransferId = `rt_SIM-${n}`;
      events.push({ caseId, event: ev, fromState: state, toState: to, actor, at: new Date(t) });
      state = to;
    }
    if (returnTransferId) {
      transfers.push({
        id: returnTransferId,
        kind: "return",
        state: state === "RETURNED" || state === "CLOSED" ? "COMPLETED" : "CREATED",
        amountCents: cents,
        senderEmail: `recipient${n}@example.test`,
        recipientEmail: `sender${n}@example.test`,
        orderId: `SIM-RORD-${n}`,
        captureId: state === "RETURNED" || state === "CLOSED" ? `SIM-RCAP-${n}` : null,
        originalTransferId: transferId,
        simulated: 1,
        createdAt: new Date(t),
        updatedAt: new Date(t),
      });
    }
    cases.push({
      id: caseId,
      transferId,
      state,
      senderName,
      senderLanguage: sLang,
      recipientName,
      recipientLanguage: rLang,
      amountCents: cents,
      linkSentAt,
      remindersSent: reminders,
      returnTransferId,
      simulated: 1,
      createdAt: openedAt,
      updatedAt: new Date(t),
    });
  }

  // Insert originals before returns (FK-free, but keeps the table readable), in chunks.
  const chunk = <T>(xs: T[], n = 100) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
  for (const c of chunk(transfers)) await db.insert(schema.transfers).values(c).onConflictDoNothing();
  for (const c of chunk(cases)) await db.insert(schema.cases).values(c).onConflictDoNothing();
  for (const c of chunk(events, 200)) await db.insert(schema.caseEvents).values(c);
  return { inserted: cases.length, skipped: false };
}
