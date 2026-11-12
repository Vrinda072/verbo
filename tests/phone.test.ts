import { beforeAll, describe, expect, it } from "vitest";
import { CONTACTS, PEOPLE, STRANGERS } from "@/lib/people/contacts";
import { digitsOf, lookupNumber, oneDigitApart } from "@/lib/people/phone";
import { phoneticKey } from "@/lib/agents/phonetic";
import { assessRisk } from "@/lib/risk/score";
import { understand } from "@/lib/agents/extraction";
import { RulesExtractor } from "@/lib/agents/extraction/rules";

beforeAll(() => {
  process.env.PGLITE_DIR = "memory";
});

describe("one digit off", () => {
  it("finds a changed digit and a swapped pair, and nothing further", () => {
    expect(oneDigitApart("14085550139", "14085550138")).toEqual([10]);
    expect(oneDigitApart("14085550183", "14085550138")).toEqual([9, 10]);
    expect(oneDigitApart("14085550199", "14085550138")).toBeNull();
    expect(oneDigitApart("14085550138", "14085550138")).toBeNull();
  });

  it("matches a contact's own number exactly", () => {
    expect(lookupNumber("+1 (408) 555-0138")).toEqual({ owner: CONTACTS.find((c) => c.id === "c_kiran"), near: null });
  });

  it("names the stranger a mistyped number reaches, and the contact it nearly was", () => {
    const r = lookupNumber("+1 (408) 555-0139");
    expect(r.owner?.name).toBe("Fatima Haddad");
    expect(r.owner?.language).toBe("ar");
    expect(r.near?.contact.name).toBe("Kiran Reddy");
  });

  it("reads digits in other scripts", () => {
    expect(digitsOf("+१ (४०८) ५५५-०१३९")).toBe("14085550139");
  });

  it("gives every stranger a different language from the contact they nearly are", () => {
    for (const s of STRANGERS) {
      const near = lookupNumber(s.phone).near!.contact;
      expect(near).toBeTruthy();
      expect(s.language).not.toBe(near.language);
    }
  });

  it("keeps every phone number unique", () => {
    expect(new Set(PEOPLE.map((p) => digitsOf(p.phone))).size).toBe(PEOPLE.length);
  });

  it("holds a payment to a number one digit from a contact's", () => {
    const fatima = STRANGERS.find((s) => s.id === "s_fatima")!;
    const kiran = CONTACTS.find((c) => c.id === "c_kiran")!;
    const r = assessRisk({ recipient: fatima, lookAlikes: [], cents: 6000, transcript: "", senderLanguage: "te", nearContact: kiran });
    expect(r.signals.map((s) => s.code)).toContain("number_near_contact");
    expect(r.hold).toBe(true);
  });
});

describe("new sound-alike contacts", () => {
  it("groups every confusable pair together, and nobody else", async () => {
    const { soundAlikeGroups } = await import("@/lib/people/soundAlike");
    const pairs = soundAlikeGroups(CONTACTS).filter((g) => g.length > 1).map((g) => g.sort().join(" / "));
    expect(pairs.sort()).toEqual(["Ana Sousa / Ana Souza", "Kiran Reddi / Kiran Reddy", "Manuel Lopes / Manuel Lopez", "Mohamad Ali / Mohamed Ali"]);
  });

  it.each([
    ["Mohamed Ali", "Mohamad Ali"],
    ["Kiran Reddy", "Kiran Reddi"],
  ])("%s and %s sound the same to code", (a, b) => {
    expect(phoneticKey(a)).toBe(phoneticKey(b));
  });

  it.each(["Mohamed Ali", "Ana Souza", "Kiran Reddy"])("spoken, %s makes Verbo ask which person", async (name) => {
    const u = await understand({ transcript: `Send 20 dollars to ${name}`, language: "en" }, new RulesExtractor(), undefined, { fromVoice: true });
    expect(u.result.ok).toBe(false);
  });

  it("each pair speaks different languages", () => {
    const lang = (n: string) => CONTACTS.find((c) => c.name === n)!.language;
    expect(lang("Mohamed Ali")).not.toBe(lang("Mohamad Ali"));
    expect(lang("Ana Souza")).not.toBe(lang("Ana Sousa"));
    expect(lang("Kiran Reddy")).not.toBe(lang("Kiran Reddi"));
  });

  it("a Hindi request for Kiran is ambiguous, because both names are written the same in Devanagari", async () => {
    const u = await understand({ transcript: "किरण रेड्डी को 20 डॉलर भेजो", language: "hi" }, new RulesExtractor(), undefined, { fromVoice: true });
    expect(u.result.ok).toBe(false);
  });

  it("strangers are never matched by name", async () => {
    const u = await understand({ transcript: "Send 20 dollars to Fatima Haddad", language: "en" }, new RulesExtractor());
    expect(u.result.ok).toBe(false);
  });
});
