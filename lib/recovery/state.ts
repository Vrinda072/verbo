/**
 * Recovery case state machine (pure).
 *
 *   OPENED ─LINK_SENT→ LINK_SENT ─VIEWED→ VIEWED ─REPLIED→ REPLIED
 *                         │                 │  │             │ │
 *                         │                 │  └─RETURNED────┼─┼─→ RETURNED ─┐
 *                         │                 └────REFUSED─────┼─┴─→ REFUSED  ─┼─CLOSED→ CLOSED
 *                         └──────ESCALATED (72 h, no return)─┴───→ ESCALATED ┘
 *
 * Self-loops (no state change, still logged): REMINDER_SENT, MESSAGE (either side), RETURN_STARTED.
 * Verbo never forces a return: RETURNED only follows the recipient approving a PayPal order themselves.
 */
export type CaseState = "OPENED" | "LINK_SENT" | "VIEWED" | "REPLIED" | "RETURNED" | "REFUSED" | "ESCALATED" | "CLOSED";
export type CaseEvent =
  | "LINK_SENT"
  | "VIEWED"
  | "REPLIED"
  | "RETURN_STARTED"
  | "RETURNED"
  | "REFUSED"
  | "ESCALATED"
  | "REMINDER_SENT"
  | "MESSAGE"
  | "CLOSED";

const T: Record<CaseState, Partial<Record<CaseEvent, CaseState>>> = {
  OPENED: { LINK_SENT: "LINK_SENT", MESSAGE: "OPENED" },
  LINK_SENT: { VIEWED: "VIEWED", ESCALATED: "ESCALATED", REMINDER_SENT: "LINK_SENT", MESSAGE: "LINK_SENT" },
  VIEWED: {
    VIEWED: "VIEWED",
    REPLIED: "REPLIED",
    RETURN_STARTED: "VIEWED",
    RETURNED: "RETURNED",
    REFUSED: "REFUSED",
    ESCALATED: "ESCALATED",
    REMINDER_SENT: "VIEWED",
    MESSAGE: "VIEWED",
  },
  REPLIED: {
    VIEWED: "REPLIED",
    REPLIED: "REPLIED",
    RETURN_STARTED: "REPLIED",
    RETURNED: "RETURNED",
    REFUSED: "REFUSED",
    ESCALATED: "ESCALATED",
    REMINDER_SENT: "REPLIED",
    MESSAGE: "REPLIED",
  },
  RETURNED: { CLOSED: "CLOSED", VIEWED: "RETURNED", MESSAGE: "RETURNED" },
  REFUSED: { CLOSED: "CLOSED", VIEWED: "REFUSED", MESSAGE: "REFUSED", RETURN_STARTED: "REFUSED", RETURNED: "RETURNED" },
  ESCALATED: { CLOSED: "CLOSED", VIEWED: "ESCALATED", RETURN_STARTED: "ESCALATED", RETURNED: "RETURNED", MESSAGE: "ESCALATED", REPLIED: "ESCALATED" },
  CLOSED: {},
};

export class IllegalCaseTransition extends Error {
  constructor(public from: CaseState, public event: CaseEvent) {
    super(`Illegal case transition: ${from} --${event}-->`);
  }
}

export function nextCaseState(from: CaseState, ev: CaseEvent): CaseState {
  const to = T[from][ev];
  if (!to) throw new IllegalCaseTransition(from, ev);
  return to;
}

export function canCase(from: CaseState, ev: CaseEvent): boolean {
  return Boolean(T[from][ev]);
}

export const OPEN_STATES: ReadonlySet<CaseState> = new Set(["OPENED", "LINK_SENT", "VIEWED", "REPLIED"]);

/** Simulated-clock policy. */
export const REMINDER_AFTER_H = 24;
export const ESCALATE_AFTER_H = 72;

/** What the timer should do for an open case at `now`, given when the link went out and reminders so far. */
export function dueTimerEvent(args: {
  state: CaseState;
  linkSentAt: Date | null;
  remindersSent: number;
  now: Date;
  /** Operator-set deadline. Replaces the standard 72 hours. */
  escalateAt?: Date | null;
  /** True while it is night where the recipient lives: the reminder waits for their morning. Escalation does not. */
  recipientQuiet?: boolean;
}): "REMINDER_SENT" | "ESCALATED" | null {
  if (!args.linkSentAt || !OPEN_STATES.has(args.state) || args.state === "OPENED") return null;
  const hours = (args.now.getTime() - args.linkSentAt.getTime()) / 3_600_000;
  const escalateDue = args.escalateAt ? args.now >= args.escalateAt : hours >= ESCALATE_AFTER_H;
  if (escalateDue) return "ESCALATED";
  if (hours >= REMINDER_AFTER_H && args.remindersSent === 0 && !args.recipientQuiet) return "REMINDER_SENT";
  return null;
}
