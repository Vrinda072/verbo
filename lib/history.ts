/**
 * Simulated payment history of the demo sender (Sreenivas Rao). Synthetic data, labelled simulated.
 * Feeds the "unusual amount" and "first-time recipient" checks.
 */
export interface PastPayment {
  contactId: string;
  cents: number;
  daysAgo: number;
  simulated: true;
}

export const SENDER_HISTORY: PastPayment[] = [
  { contactId: "c_lakshmi", cents: 4000, daysAgo: 6, simulated: true },
  { contactId: "c_lakshmi", cents: 6000, daysAgo: 36, simulated: true },
  { contactId: "c_lakshmi", cents: 5000, daysAgo: 66, simulated: true },
  { contactId: "c_kiran", cents: 2500, daysAgo: 12, simulated: true },
  { contactId: "c_kiran", cents: 3000, daysAgo: 44, simulated: true },
  { contactId: "c_lopez", cents: 2000, daysAgo: 9, simulated: true },
  { contactId: "c_lopez", cents: 3500, daysAgo: 40, simulated: true },
  { contactId: "c_lopez", cents: 5000, daysAgo: 71, simulated: true },
  { contactId: "c_mohamed", cents: 7500, daysAgo: 15, simulated: true },
  { contactId: "c_mohamed", cents: 6000, daysAgo: 48, simulated: true },
];
