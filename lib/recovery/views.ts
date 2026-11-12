/** What each side of a case may see. No emails, no PayPal ids, sender shown by short name to the recipient. */
import { SENDER } from "@/lib/people/contacts";
import { numbersOf } from "@/lib/bridge/translate";
import { caseDetail } from "./service";

type Detail = NonNullable<Awaited<ReturnType<typeof caseDetail>>>;

function messages(d: Detail) {
  return d.messages.map((m) => ({
    id: m.id,
    author: m.author,
    text: m.text,
    lang: m.lang,
    translatedText: m.translatedText,
    translatedLang: m.translatedLang,
    englishText: m.englishText,
    /** Numbers in a translated message. Each was found again in the translation, or it would not have been kept. */
    numbers: m.translatedText ? [...new Set(numbersOf(m.text))] : [],
    at: m.at.toISOString(),
  }));
}

export function recipientView(d: Detail) {
  const c = d.caseRow;
  return {
    state: c.state,
    senderName: SENDER.shortName,
    recipientName: c.recipientName,
    cents: c.amountCents,
    currency: c.currency,
    caseLanguage: c.recipientLanguage,
    returnState: d.returnState,
    messages: messages(d),
  };
}
export type RecipientView = ReturnType<typeof recipientView>;

export function senderView(d: Detail, link?: string) {
  const c = d.caseRow;
  return {
    id: c.id,
    state: c.state,
    recipientName: c.recipientName,
    recipientLanguage: c.recipientLanguage,
    senderLanguage: c.senderLanguage,
    cents: c.amountCents,
    returnState: d.returnState,
    remindersSent: c.remindersSent,
    link,
    events: d.events.map((e) => ({ event: e.event, actor: e.actor, at: e.at.toISOString() })),
    messages: messages(d),
  };
}
export type SenderCaseView = ReturnType<typeof senderView>;
