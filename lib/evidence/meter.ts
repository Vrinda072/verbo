/**
 * Evidence meter: how complete a case's evidence is, 0–100. Pure code; each item is a fact we either hold or don't.
 * Weights are a product decision for the demo (what a PayPal agent would want first), not a legal standard.
 */
export interface EvidenceFacts {
  hasPaymentRecord: boolean; // order + capture ids
  hasRiskRecord: boolean; // pre-send risk level stored
  hasUtterance: boolean; // the original spoken/typed instruction + what Verbo read back
  recipientViewed: boolean;
  hasConversation: boolean;
  hasOutcome: boolean; // returned / refused / escalated
  hasReturnPayment: boolean;
}

export const EVIDENCE_ITEMS: { key: keyof EvidenceFacts; label: string; points: number }[] = [
  { key: "hasPaymentRecord", label: "PayPal payment record", points: 20 },
  { key: "hasRiskRecord", label: "Pre-send risk check", points: 15 },
  { key: "hasUtterance", label: "Original instruction + read-back", points: 15 },
  { key: "recipientViewed", label: "Recipient opened the link", points: 15 },
  { key: "hasConversation", label: "Conversation", points: 10 },
  { key: "hasOutcome", label: "Outcome recorded", points: 15 },
  { key: "hasReturnPayment", label: "Return payment record", points: 10 },
];

export function evidenceScore(f: EvidenceFacts): number {
  return EVIDENCE_ITEMS.reduce((s, i) => s + (f[i.key] ? i.points : 0), 0);
}
