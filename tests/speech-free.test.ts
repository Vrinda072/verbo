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
