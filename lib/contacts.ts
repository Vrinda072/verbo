/**
 * Simulated address book for the demo sender (Sreenivas Rao).
 * All entries are synthetic. The three sandbox personas map to the sandbox accounts via env at runtime;
 * the other entries never receive money (they exist so recipient resolution has realistic neighbours).
 */
export interface Contact {
  id: string;
  name: string;
  /** Other ways the sender might say this name (nicknames, native script). */
  aliases: string[];
  /** Env var holding the sandbox email for this contact, if it is a real sandbox account. */
  sandboxEmailEnv?: string;
  /** Preferred language of the contact (BCP-47), used by recovery later. */
  language: string;
  /** Has the sender paid this contact before? Feeds the first-time-recipient check (Day 3). */
  paidBefore: boolean;
  simulated: true;
}

export const CONTACTS: Contact[] = [
  {
    id: "c_lopez",
    name: "Manuel Lopez",
    aliases: ["Manu", "Manuel López", "మాన్యుయెల్ లోపెజ్", "मैनुअल लोपेज़", "مانويل لوبيز"],
    sandboxEmailEnv: "SANDBOX_INTENDED_RECIPIENT_EMAIL",
    language: "es",
    paidBefore: true,
    simulated: true,
  },
  {
    id: "c_lopes",
    name: "Manuel Lopes",
    aliases: ["మాన్యుయెల్ లోపెస్", "मैनुअल लोपेस", "مانويل لوبيس"],
    sandboxEmailEnv: "SANDBOX_WRONG_RECIPIENT_EMAIL",
    language: "pt",
    paidBefore: false,
    simulated: true,
  },
  { id: "c_lakshmi", name: "Lakshmi Rao", aliases: ["Lakshmi", "లక్ష్మి"], language: "te", paidBefore: true, simulated: true },
  { id: "c_kiran", name: "Kiran Reddy", aliases: ["Kiran", "కిరణ్", "किरण रेड्डी"], language: "te", paidBefore: true, simulated: true },
  { id: "c_ana", name: "Ana Souza", aliases: ["Ana"], language: "pt", paidBefore: false, simulated: true },
];

export function contactEmail(c: Contact): string | undefined {
  return c.sandboxEmailEnv ? process.env[c.sandboxEmailEnv] || undefined : undefined;
}
