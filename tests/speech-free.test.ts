import { describe, expect, it, vi } from "vitest";
import { collectTranscript, speechErrorMessage, speechLocale, speechRecognitionCtor } from "@/lib/speech/browser";
import { parseNumberWords } from "@/lib/agents/numberWords";
import { candidateCents, dollarsAndCents } from "@/lib/agents/numbers";
import { chunkByBytes, MyMemoryTranslator } from "@/lib/bridge/translate";
import { RulesExtractor } from "@/lib/agents/extraction/rules";

describe("browser speech helpers", () => {
  it("finds the prefixed constructor and handles browsers without one", () => {
    class C {}
    expect(speechRecognitionCtor({ webkitSpeechRecognition: C })).toBe(C);
    expect(speechRecognitionCtor({})).toBeNull();
  });
  it("joins interim and final results", () => {
    const r = (t: string, isFinal = true) => ({ isFinal, length: 1, 0: { transcript: t } });
    expect(collectTranscript({ length: 2, 0: r("Send 20 "), 1: r(" to  Kiran", false) })).toBe("Send 20 to Kiran");
  });
  it("derives a region without a language list, preferring the browser's own variant", () => {
    expect(speechLocale("te")).toBe("te-IN");
    expect(speechLocale("hi")).toBe("hi-IN");
    expect(speechLocale("es", ["en-US", "es-MX"])).toBe("es-MX");
  });
  it("stays silent on our own abort and explains blocked mics", () => {
    expect(speechErrorMessage("aborted")).toBeNull();
    expect(speechErrorMessage("not-allowed")).toMatch(/blocked/);
  });
});

describe("number words", () => {
  it.each([
    ["Send twenty five dollars", "en", 25],
    ["Send two hundred and fifty dollars", "en", 250],
    ["Envía veinticinco dólares", "es", 25],
    ["Envía ciento veinte dólares", "es", 120],
    ["Envie trinta e cinco dólares", "pt", 35],
    ["बीस डॉलर भेज दो", "hi", 20],
    ["दो सौ डॉलर भेजो", "hi", 200],
    ["ఇరవై ఐదు డాలర్లు పంపండి", "te", 25],
    ["خمسة وعشرين دولارا", "ar", 25],
  ])("%s → %i", (text, lang, value) => {
    expect(parseNumberWords(text, lang)).toBe(value);
  });
  it("refuses when unsure", () => {
    expect(parseNumberWords("send twenty or thirty", "en")).toBeNull();
    expect(parseNumberWords("send money", "en")).toBeNull();
    expect(parseNumberWords("भेज दो", "hi")).toBeNull();
    expect(parseNumberWords("twenty", "sw")).toBeNull();
  });
});

describe("dollars and cents", () => {
  it("reads and grounds a split amount", () => {
    expect(dollarsAndCents("Send 12 dollars and 34 cents")).toBe(1234);
    expect(candidateCents("Send 12 dollars and 34 cents").has(1234)).toBe(true);
  });
});

describe("offline parser on speech-style text", () => {
  const rules = new RulesExtractor();
  it("does not guess between two amounts, and catches foreign currency", async () => {
    const two = await rules.extract({ transcript: "Send 20 to Kiran Reddy, no wait 200", language: "en" });
    expect(two.amount).toBeNull();
    expect(two.unclear).toBeTruthy();
    expect((await rules.extract({ transcript: "किरण रेड्डी को 500 रुपये भेजो", language: "hi" })).currency).toBe("INR");
    expect((await rules.extract({ transcript: "Send 500 pesos to Kiran Reddy", language: "en" })).currency).toBe("MXN");
  });
});

describe("MyMemory translator", () => {
  const reply = (translatedText: string, responseStatus: number | string = 200) =>
    new Response(JSON.stringify({ responseStatus, responseData: { translatedText } }));

  it("splits long text under the byte limit without losing words", () => {
    const text = "నేను పొరపాటున మీకు డబ్బు పంపాను. ".repeat(20).trim();
    const chunks = chunkByBytes(text);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(Buffer.byteLength(c)).toBeLessThanOrEqual(450);
    expect(chunks.join(" ")).toBe(text);
  });
  it("translates and sends no email address", async () => {
    const f = vi.fn(async () => reply("Enviei $ 12,34 por engano."));
    const t = await new MyMemoryTranslator(f as unknown as typeof fetch).translate("I sent 12.34 by mistake.", "en", "pt");
    expect(t).toEqual({ text: "Enviei $ 12,34 por engano.", translator: "mymemory" });
    const url = new URL(String((f.mock.calls as unknown as string[][])[0][0]));
    expect(url.searchParams.get("langpair")).toBe("en|pt");
    expect(url.searchParams.has("de")).toBe(false);
  });
  it("goes through English when a pair comes back empty", async () => {
    const pairs: string[] = [];
    const f = async (u: string) => {
      const pair = new URL(u).searchParams.get("langpair")!;
      pairs.push(pair);
      if (pair === "te|es") return new Response(JSON.stringify({ responseStatus: 200, responseData: { translatedText: null } }));
      return reply(pair === "te|en" ? "I sent 12.34 by mistake." : "Envié 12,34 por error.");
    };
    const t = await new MyMemoryTranslator(f as unknown as typeof fetch).translate("నేను 12.34 పంపాను", "te", "es");
    expect(pairs).toEqual(["te|es", "te|en", "en|es"]);
    expect(t.text).toBe("Envié 12,34 por error.");
  });
  it("drops translations that change a number, and reports quota errors honestly", async () => {
    const changed = new MyMemoryTranslator((async () => reply("Enviei 120,34")) as unknown as typeof fetch);
    expect((await changed.translate("I sent 12.34", "en", "pt")).note).toBe("numbers_changed");
    const quota = new MyMemoryTranslator((async () => reply("MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS", 429)) as unknown as typeof fetch);
    expect(await quota.translate("hello", "en", "pt")).toEqual({ text: null, translator: "mymemory", note: "unavailable" });
    expect((await new MyMemoryTranslator(fetch).translate("hola", "es", "es")).note).toBe("same_language");
  });
});

describe("names by sound across scripts", () => {
  it("gives Latin, Devanagari, Telugu and Arabic spellings the same key, and keeps Lopez apart from Lopes", async () => {
    const { phoneticKey } = await import("@/lib/agents/phonetic");
    expect(phoneticKey("मैनुअल लोपेज")).toBe(phoneticKey("Manuel Lopez"));
    expect(phoneticKey("మాన్యుయల్ లోపెజ్")).toBe(phoneticKey("Manuel Lopez"));
    expect(phoneticKey("مانويل لوبيز")).toBe(phoneticKey("Manuel Lopez"));
    expect(phoneticKey("लक्ष्मी राव")).toBe(phoneticKey("Lakshmi Rao"));
    expect(phoneticKey("Manuel Lopez")).not.toBe(phoneticKey("Manuel Lopes"));
    expect(phoneticKey("मैनुअल लोपेस")).toBe(phoneticKey("Manuel Lopes"));
  });
});

describe("Gemini integration (fake client, no network)", () => {
  const good = { intent: "send_money", recipient_spoken: "किरण", recipient_latin: "Kiran", amount_spoken: "30", amount: "30", currency: "USD", pressure_cues: [], unclear: null };

  it("sends a storage-off JSON request and validates the answer in code", async () => {
    const { GeminiExtractor } = await import("@/lib/agents/extraction/gemini");
    const { understand } = await import("@/lib/agents/extraction");
    const reqs: { store: boolean; response_format: { mime_type: string; schema: { properties: object } } }[] = [];
    const ex = new GeminiExtractor(async (r) => {
      reqs.push(r as never);
      return { output_text: JSON.stringify(good) };
    });
    const u = await understand({ transcript: "किरण को 30 डॉलर भेजो", language: "hi" }, ex);
    expect(u.extractor).toBe("gemini");
    expect(u.result.ok && u.result.draft.recipient.id).toBe("c_kiran");
    expect(reqs[0].store).toBe(false);
    expect(reqs[0].response_format.mime_type).toBe("application/json");
    expect(Object.keys(reqs[0].response_format.schema.properties)).toContain("recipient_latin");
  });

  it("code still rejects an amount the model invented", async () => {
    const { GeminiExtractor } = await import("@/lib/agents/extraction/gemini");
    const { understand } = await import("@/lib/agents/extraction");
    const ex = new GeminiExtractor(async () => ({ output_text: JSON.stringify({ ...good, amount: "3000" }) }));
    const u = await understand({ transcript: "किरण को 30 डॉलर भेजो", language: "hi" }, ex);
    expect(!u.result.ok && u.result.problems.map((p) => p.code)).toContain("amount_not_in_transcript");
  });

  it("falls back to rules on quota errors or bad answers and says so; the eval can turn that off", async () => {
    const { GeminiExtractor } = await import("@/lib/agents/extraction/gemini");
    const { understand } = await import("@/lib/agents/extraction");
    const input = { transcript: "किरण को 30 डॉलर भेजो", language: "hi" };
    for (const ex of [
      new GeminiExtractor(async () => { throw new Error("429"); }),
      new GeminiExtractor(async () => ({ output_text: "not json" })),
      new GeminiExtractor(async () => ({ output_text: JSON.stringify({ amount: 5 }) })),
    ]) {
      const u = await understand(input, ex);
      expect(u.extractor).toBe("rules");
      expect(u.fellBack).toBe(true);
    }
    await expect(understand(input, new GeminiExtractor(async () => { throw new Error("429"); }), undefined, { fallback: false })).rejects.toThrow("429");
  });

  describe("code catches what a live model got wrong (seen on Nov 6)", () => {
    const fake = (o: object) => ({ kind: "gemini" as const, extract: async () => ({ ...good, intent: "send_money" as const, ...o }) });

    it("refuses rupees when the model leaves currency empty", async () => {
      const { understand } = await import("@/lib/agents/extraction");
      const u = await understand({ transcript: "किरण रेड्डी को 500 रुपये भेजो", language: "hi" }, fake({ recipient_spoken: "किरण रेड्डी", amount: "500", currency: null }));
      expect(!u.result.ok && u.result.problems.map((p) => p.code)).toContain("currency_unsupported");
    });

    it("refuses when two amounts were said and the model picked one", async () => {
      const { understand } = await import("@/lib/agents/extraction");
      const u = await understand({ transcript: "Send 20 to Kiran Reddy, no wait 200", language: "en" }, fake({ recipient_spoken: "Kiran Reddy", amount: "200", currency: null }));
      expect(!u.result.ok && u.result.problems.map((p) => p.code)).toContain("missing_amount");
    });

    it("still accepts dollars and cents, and thousands separators, as one amount", async () => {
      const { understand } = await import("@/lib/agents/extraction");
      const a = await understand({ transcript: "Send 12 dollars and 34 cents to Kiran Reddy", language: "en" }, fake({ recipient_spoken: "Kiran Reddy", amount: "12.34", currency: "USD" }));
      expect(a.result.ok && a.result.draft.amount.cents).toBe(1234);
      const b = await understand({ transcript: "Send 1,000 dollars to Kiran Reddy", language: "en" }, fake({ recipient_spoken: "Kiran Reddy", amount: "1000", currency: "USD" }));
      expect(b.result.ok && b.result.draft.amount.cents).toBe(100000);
    });

    it("fills in number words the model declined, and they still need typing", async () => {
      const { understand } = await import("@/lib/agents/extraction");
      const u = await understand({ transcript: "మాన్యుయెల్ లోపెజ్ కి ఇరవై ఐదు డాలర్లు పంపండి", language: "te" }, fake({ recipient_spoken: "మాన్యుయెల్ లోపెజ్", recipient_latin: "Manuel Lopez", amount: null, currency: "USD" }));
      expect(u.result.ok && u.result.draft.amount.cents).toBe(2500);
      expect(u.result.ok && u.result.draft.amountSource).toBe("words");
    });

    it("resolves Lopez and Lopes by the sound of what was said, not a blurred romanisation", async () => {
      const { understand } = await import("@/lib/agents/extraction");
      const u = await understand({ transcript: "मैनुअल लोपेज को 25 डॉलर भेजो", language: "hi" }, fake({ recipient_spoken: "मैनुअल लोपेज", recipient_latin: "mainual lopej", amount: "25", currency: "USD" }));
      expect(u.result.ok && u.result.draft.recipient.id).toBe("c_lopez");
      const s = await understand({ transcript: "मनुअल लोपेस को 25 डॉलर भेजना है", language: "hi" }, fake({ recipient_spoken: "मनुअल लोपेस", recipient_latin: "manual lopes", amount: "25", currency: "USD" }));
      expect(s.result.ok && s.result.draft.recipient.id).toBe("c_lopes");
    });

    it("says the currency was assumed unless dollars were actually said, whatever the model claims", async () => {
      const { understand } = await import("@/lib/agents/extraction");
      const u = await understand({ transcript: "Send 20 to Kiran Reddy", language: "en" }, fake({ recipient_spoken: "Kiran Reddy", amount: "20", currency: "USD" }));
      expect(u.result.ok && u.result.draft.currencyAssumed).toBe(true);
    });
  });

  describe("free quota handling", () => {
    const req = { model: "x", input: "hello", system_instruction: "s", store: false, response_format: { type: "text" as const, mime_type: "application/json" as const, schema: {} } };
    const quota = () => Object.assign(new Error("429 limit: 20 requests per day. Please retry in 1h2m3s or upgrade"), { status: 429 });
    const ok = { output_text: JSON.stringify({ a: 1 }) };

    it("reads the retry time from the quota message", async () => {
      const { retryAfterMs } = await import("@/lib/ai/gemini");
      expect(retryAfterMs(quota().message)).toBe(3723_000);
      expect(retryAfterMs("Please retry in 30.5s")).toBe(30_500);
      expect(retryAfterMs("no time given")).toBe(60_000);
    });

    it("moves to the next model at quota, parks the first until its retry time, then tries it again", async () => {
      const { withModelFallback, newFallbackState } = await import("@/lib/ai/gemini");
      const calls: string[] = [];
      let t = 0;
      let firstFull = true;
      const create = withModelFallback(
        async (r) => {
          calls.push(r.model);
          if (r.model === "a" && firstFull) throw quota();
          return ok;
        },
        ["a", "b"],
        newFallbackState(),
        () => t,
      );
      await create({ ...req, input: "1" });
      await create({ ...req, input: "2" });
      expect(calls).toEqual(["a", "b", "b"]);
      firstFull = false;
      t = 3723_001;
      await create({ ...req, input: "3" });
      expect(calls.at(-1)).toBe("a");
    });

    it("stops calling once every model is at quota, and reports quota", async () => {
      const { withModelFallback, newFallbackState } = await import("@/lib/ai/gemini");
      let calls = 0;
      const create = withModelFallback(async () => { calls++; throw quota(); }, ["a", "b"], newFallbackState(), () => 0);
      await expect(create(req)).rejects.toMatchObject({ reason: "quota" });
      expect(calls).toBe(2);
      await expect(create({ ...req, input: "other" })).rejects.toMatchObject({ reason: "quota" });
      expect(calls).toBe(2);
    });

    it("treats an overloaded model as an outage without parking it, and throws other errors unchanged", async () => {
      const { withModelFallback, newFallbackState } = await import("@/lib/ai/gemini");
      let calls = 0;
      const busy = withModelFallback(async () => { calls++; throw Object.assign(new Error("503"), { status: 503 }); }, ["a"], newFallbackState(), () => 0);
      await expect(busy(req)).rejects.toMatchObject({ reason: "unavailable" });
      await expect(busy(req)).rejects.toMatchObject({ reason: "unavailable" });
      expect(calls).toBe(2);
      const bad = withModelFallback(async () => { throw Object.assign(new Error("400 bad schema"), { status: 400 }); }, ["a", "b"], newFallbackState(), () => 0);
      await expect(bad(req)).rejects.toThrow("400 bad schema");
    });

    it("reuses a good answer for the same request, but never a broken one", async () => {
      const { withModelFallback, newFallbackState } = await import("@/lib/ai/gemini");
      let calls = 0;
      const create = withModelFallback(async () => { calls++; return ok; }, ["a"], newFallbackState(), () => 0);
      await create(req);
      await create(req);
      expect(calls).toBe(1);
      await create({ ...req, input: "different" });
      expect(calls).toBe(2);
      let bad = 0;
      const broken = withModelFallback(async () => { bad++; return { output_text: "not json" }; }, ["a"], newFallbackState(), () => 0);
      await broken(req);
      await broken(req);
      expect(bad).toBe(2);
    });

    it("at full quota, understanding still works through the rules parser and says so", async () => {
      const { withModelFallback, newFallbackState } = await import("@/lib/ai/gemini");
      const { GeminiExtractor } = await import("@/lib/agents/extraction/gemini");
      const { understand } = await import("@/lib/agents/extraction");
      const ex = new GeminiExtractor(withModelFallback(async () => { throw quota(); }, ["a"], newFallbackState(), () => 0));
      const u = await understand({ transcript: "किरण को 30 डॉलर भेजो", language: "hi" }, ex);
      expect(u.fellBack).toBe(true);
      expect(u.result.ok && u.result.draft.amount.cents).toBe(3000);
    });
  });

  it("translator drops changed numbers and falls back to its backup on failure", async () => {
    const { GeminiTranslator } = await import("@/lib/bridge/translate");
    const backup = { kind: "mymemory" as const, translate: async () => ({ text: "backup", translator: "mymemory" as const }) };
    const changed = new GeminiTranslator(async () => ({ output_text: JSON.stringify({ translation: "Enviei 120,34" }) }), backup);
    expect((await changed.translate("I sent 12.34", "en", "pt")).note).toBe("numbers_changed");
    const down = new GeminiTranslator(async () => { throw new Error("429"); }, backup);
    expect(await down.translate("hello", "en", "pt")).toEqual({ text: "backup", translator: "mymemory" });
  });
});
