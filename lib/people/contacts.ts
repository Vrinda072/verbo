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
  /** Fictional phone number (555 and 7700 900 ranges are reserved for fiction). */
  phone: string;
  city: string;
  /** IANA time zone, so the app can show the person's local time. */
  timeZone: string;
  /** Not in the sender's address book: someone a mistyped number reaches. */
  stranger?: true;
  simulated: true;
}

export const CONTACTS: Contact[] = [
  {
    id: "c_lopez",
    name: "Manuel Lopez",
    aliases: ["Manuel López", "మాన్యుయెల్ లోపెజ్", "मैनुअल लोपेज़", "مانويل لوبيز", "మాన్యుయెల్", "मैनुअल", "مانويل"],
    sandboxEmailEnv: "SANDBOX_INTENDED_RECIPIENT_EMAIL",
    language: "es",
    paidBefore: true,
    phone: "+1 (415) 555-0142",
    city: "San José",
    timeZone: "America/Costa_Rica",
    simulated: true,
  },
  {
    id: "c_lopes",
    name: "Manuel Lopes",
    aliases: ["మాన్యుయెల్ లోపెస్", "मैनुअल लोपेस", "مانويل لوبيس", "మాన్యుయెల్", "मैनुअल", "مانويل"],
    sandboxEmailEnv: "SANDBOX_WRONG_RECIPIENT_EMAIL",
    language: "pt",
    paidBefore: false,
    phone: "+1 (415) 555-0193",
    city: "São Paulo",
    timeZone: "America/Sao_Paulo",
    simulated: true,
  },
  { id: "c_lakshmi", name: "Lakshmi Rao", aliases: ["Lakshmi", "లక్ష్మి", "लक्ष्मी", "لاكشمي"], language: "te", paidBefore: true, phone: "+1 (408) 555-0157", city: "Hyderabad", timeZone: "Asia/Kolkata", simulated: true },
  { id: "c_kiran", name: "Kiran Reddy", aliases: ["Kiran", "కిరణ్", "किरण", "كيران", "కిరణ్ రెడ్డి", "किरण रेड्डी", "كيران ريدي"], language: "te", paidBefore: true, phone: "+1 (408) 555-0138", city: "Hyderabad", timeZone: "Asia/Kolkata", simulated: true },
  { id: "c_reddi", name: "Kiran Reddi", aliases: ["కిరణ్ రెడ్డి", "किरण रेड्डी", "كيران ريدي"], language: "hi", paidBefore: false, phone: "+1 (212) 555-0110", city: "Delhi", timeZone: "Asia/Kolkata", simulated: true },
  { id: "c_ana", name: "Ana Souza", aliases: ["Ana", "అనా", "अना", "آنا", "అనా సౌజా", "अना सौज़ा", "آنا سوزا"], language: "pt", paidBefore: false, phone: "+1 (617) 555-0121", city: "Lisbon", timeZone: "Europe/Lisbon", simulated: true },
  { id: "c_sousa", name: "Ana Sousa", aliases: ["అనా సౌసా", "अना सौसा", "آنا سوسا"], language: "es", paidBefore: false, phone: "+1 (305) 555-0178", city: "Madrid", timeZone: "Europe/Madrid", simulated: true },
  { id: "c_mohamed", name: "Mohamed Ali", aliases: ["Mohamed", "మొహమ్మద్ అలీ", "मोहम्मद अली", "محمد علي"], language: "ar", paidBefore: true, phone: "+1 (313) 555-0168", city: "Cairo", timeZone: "Africa/Cairo", simulated: true },
  { id: "c_mohamad", name: "Mohamad Ali", aliases: ["మొహమ్మద్ అలీ", "मोहम्मद अली", "محمد علي"], language: "en", paidBefore: false, phone: "+1 (646) 555-0123", city: "Manchester", timeZone: "Europe/London", simulated: true },
];

/**
 * People outside the address book whose numbers are one digit away from a contact's. They exist so a mistyped number
 * reaches someone real-looking who speaks another language. Synthetic, like everyone here.
 */
export const STRANGERS: Contact[] = [
  { id: "s_fatima", name: "Fatima Haddad", aliases: [], language: "ar", paidBefore: false, phone: "+1 (408) 555-0139", city: "Amman", timeZone: "Asia/Amman", stranger: true, simulated: true },
  { id: "s_lucia", name: "Lucía Gómez", aliases: [], language: "es", paidBefore: false, phone: "+1 (408) 555-0175", city: "Bogotá", timeZone: "America/Bogota", stranger: true, simulated: true },
  { id: "s_joao", name: "João Pereira", aliases: [], language: "pt", paidBefore: false, phone: "+1 (415) 555-0143", city: "Porto", timeZone: "Europe/Lisbon", stranger: true, simulated: true },
];

/** Everyone money can reach: the address book plus strangers. Name matching uses CONTACTS only. */
export const PEOPLE: Contact[] = [...CONTACTS, ...STRANGERS];
export const personById = (id: string | null | undefined) => PEOPLE.find((c) => c.id === id);

/** The demo sender (simulated persona backed by the SANDBOX_SENDER_EMAIL account). */
export const SENDER = { name: "Sreenivas Rao", shortName: "Sreenivas", language: "te", simulated: true } as const;

export function contactEmail(c: Contact): string | undefined {
  return c.sandboxEmailEnv ? process.env[c.sandboxEmailEnv] || undefined : undefined;
}
