import { describe, expect, it } from "vitest";
import { candidateCents, decimalToCents, normalizeDigits } from "@/lib/agents/numbers";
import { jaroWinkler } from "@/lib/agents/similarity";
import { RulesExtractor } from "@/lib/agents/extraction/rules";
import { understand, validateExtraction, type LlmExtraction } from "@/lib/agents/extraction";

const base: LlmExtraction = {
  intent: "send_money",
  recipient_spoken: "Manuel Lopez",
  recipient_latin: "Manuel Lopez",
  amount_spoken: "12.34",
  amount: "12.34",
  currency: "USD",
  unclear: null,
};

describe("numbers", () => {
  it("normalises native digits", () => {
    expect(normalizeDigits("౧౨.౩౪")).toBe("12.34"); // Telugu
    expect(normalizeDigits("١٢")).toBe("12"); // Arabic-Indic
    expect(normalizeDigits("१००")).toBe("100"); // Devanagari
  });
  it("finds candidate amounts with either decimal separator", () => {
    expect(candidateCents("send 12.34 dollars").has(1234)).toBe(true);
    expect(candidateCents("envía 12,34 dólares").has(1234)).toBe(true);
    expect(candidateCents("pay 1,200 to Kiran").has(120000)).toBe(true);
    expect(candidateCents("pay 20").has(2000)).toBe(true);
  });
  it("parses strict decimals only", () => {
    expect(decimalToCents("12.34")).toBe(1234);
    expect(decimalToCents("20")).toBe(2000);
    expect(decimalToCents("12.345")).toBeNull();
    expect(decimalToCents("-5")).toBeNull();
    expect(decimalToCents("1e3")).toBeNull();
  });
});

describe("similarity", () => {
  it("scores look-alike names high", () => {
    expect(jaroWinkler("manuel lopez", "manuel lopes")).toBeGreaterThan(0.95);
    expect(jaroWinkler("manuel lopez", "kiran reddy")).toBeLessThan(0.6);
  });
});

describe("validateExtraction (code decides, not the model)", () => {
  it("accepts a grounded, in-range USD payment to a known contact", () => {
    const r = validateExtraction(base, "Send 12.34 dollars to Manuel Lopez");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.draft.recipient.id).toBe("c_lopez");
    expect(r.draft.amount.cents).toBe(1234);
    expect(r.draft.amountSource).toBe("numerals");
    expect(r.draft.lookAlikes.map((m) => m.contact.id)).toContain("c_lopes");
  });

  it("rejects an amount the speaker never said (hallucination guard)", () => {
    const r = validateExtraction({ ...base, amount: "120.34" }, "Send 12.34 dollars to Manuel Lopez");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.problems.map((p) => p.code)).toContain("amount_not_in_transcript");
  });

  it("marks amounts spoken only in words so the UI asks for typed confirmation", () => {
    const r = validateExtraction({ ...base, amount: "20", amount_spoken: "veinte" }, "Envía veinte dólares a Manuel Lopez");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.draft.amountSource).toBe("words");
  });

  it("rejects malformed, zero, negative and over-limit amounts", () => {
    const t = "pay Manuel Lopez";
    const codes = (amount: string) => {
      const r = validateExtraction({ ...base, amount }, t);
      return r.ok ? [] : r.problems.map((p) => p.code);
    };
    expect(codes("12.345")).toContain("amount_invalid");
    expect(codes("abc")).toContain("amount_invalid");
    expect(codes("0")).toContain("amount_out_of_range");
    expect(codes("20000")).toContain("amount_out_of_range");
  });

  it("refuses non-USD currencies instead of converting", () => {
    const r = validateExtraction({ ...base, currency: "EUR" }, "Send 12.34 euros to Manuel Lopez");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problems).toContainEqual({ code: "currency_unsupported", currency: "EUR" });
  });

  it("flags an assumed currency when none was said", () => {
    const r = validateExtraction({ ...base, currency: null }, "Send 12.34 to Manuel Lopez");
    expect(r.ok && r.draft.currencyAssumed).toBe(true);
  });

  it("matches a name spoken in another script via the transliteration", () => {
    const r = validateExtraction(
      { ...base, recipient_spoken: "मैनुएल लोपेज़", recipient_latin: "Manuel Lopez" },
      "मैनुएल लोपेज़ को 12.34 डॉलर भेजो",
    );
    expect(r.ok && r.draft.recipient.id).toBe("c_lopez");
  });

  it("asks when the recipient is ambiguous or unknown", () => {
    const amb = validateExtraction({ ...base, recipient_spoken: "Manuel Lope", recipient_latin: "Manuel Lope" }, "Send 12.34 to Manuel Lope");
    expect(amb.ok).toBe(false);
    if (!amb.ok) expect(amb.problems[0].code).toBe("recipient_ambiguous");

    const unk = validateExtraction({ ...base, recipient_spoken: "Zed Q", recipient_latin: "Zed Q" }, "Send 12.34 to Zed Q");
    expect(unk.ok).toBe(false);
    if (!unk.ok) expect(unk.problems[0].code).toBe("recipient_not_found");
  });

  it("rejects non-payment intents and missing fields", () => {
    const r = validateExtraction({ ...base, intent: "other", recipient_spoken: null, recipient_latin: null, amount: null }, "what's the weather");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problems.map((p) => p.code)).toEqual(["not_a_payment", "missing_recipient", "missing_amount"]);
  });
});

describe("RulesExtractor + understand()", () => {
  const rules = new RulesExtractor();
  it("reads an English command", async () => {
    const u = await understand({ transcript: "Send $12.34 to Manuel Lopez", language: "en" }, rules);
    expect(u.extractor).toBe("rules");
    expect(u.result.ok).toBe(true);
  });
  it("reads a Telugu command with Telugu digits", async () => {
    const u = await understand({ transcript: "మాన్యుయెల్ లోపెజ్ కి ౧౨.౩౪ డాలర్లు పంపండి", language: "te" }, rules);
    expect(u.result.ok).toBe(true);
    if (u.result.ok) {
      expect(u.result.draft.recipient.id).toBe("c_lopez");
      expect(u.result.draft.amount.cents).toBe(1234);
    }
  });
  it("reads a Spanish command with decimal comma", async () => {
    const u = await understand({ transcript: "Envía 12,34 dólares a Manuel Lopes", language: "es" }, rules);
    expect(u.result.ok).toBe(true);
    if (u.result.ok) expect(u.result.draft.recipient.id).toBe("c_lopes");
  });
});
