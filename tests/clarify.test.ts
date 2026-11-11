import { describe, expect, it } from "vitest";
import { labelsFor } from "@/lib/bridge/readback";
import { verifyTemplates } from "@/lib/bridge/verify";
import { matchChoice, mergeAnswer, nextQuestion, questionParts, questionText } from "@/lib/speech/clarify";
import { pickVoice } from "@/lib/speech/speak";

describe("spoken follow-up questions", () => {
  it("asks to choose between exactly two similar names first", () => {
    expect(
      nextQuestion([{ code: "missing_amount" }, { code: "recipient_ambiguous", candidates: ["Manuel Lopez", "Manuel Lopes"] }]),
    ).toEqual({ kind: "which", a: "Manuel Lopez", b: "Manuel Lopes" });
  });

  it("leaves three or more similar names to the screen", () => {
    expect(nextQuestion([{ code: "recipient_ambiguous", candidates: ["A", "B", "C"] }])).toBeNull();
  });

  it("asks for a missing recipient, then a missing amount", () => {
    expect(nextQuestion([{ code: "recipient_not_found", spoken: "x" }, { code: "missing_amount" }])).toEqual({ kind: "recipient" });
    expect(nextQuestion([{ code: "missing_amount" }])).toEqual({ kind: "amount" });
  });

  it("doesn't ask about problems an answer can't fix", () => {
    expect(nextQuestion([{ code: "not_a_payment" }])).toBeNull();
    expect(nextQuestion([{ code: "currency_unsupported", currency: "EUR" }])).toBeNull();
    expect(nextQuestion([{ code: "amount_out_of_range", cents: 1 }])).toBeNull();
  });

  it.each(["en", "hi", "te", "es", "pt", "ar"])("tells sound-alike names apart in %s by letter and payment history", (lang) => {
    const text = questionText({ kind: "which", a: "Manuel Lopez", b: "Manuel Lopes" }, labelsFor(lang));
    expect(text).toContain("Manuel Lopez");
    expect(text).toContain("Manuel Lopes");
    expect(text).toContain("Z");
    expect(text).toContain("S");
    expect(text).toContain(labelsFor(lang).t("word_one"));
    expect(text).toContain(labelsFor(lang).t("word_two"));
    expect(text).not.toContain("{");
  });

  it("says which one was paid before, from the address book", () => {
    expect(questionText({ kind: "which", a: "Manuel Lopez", b: "Manuel Lopes" }, labelsFor("en"))).toBe(
      "Two contacts have names that sound the same. Say one for Manuel Lopez, spelled with the letter Z, who you have paid before. " +
        "Say two for Manuel Lopes, spelled with the letter S, who you have never paid.",
    );
  });

  it("falls back to the plain question when the names differ by more than a letter or two", () => {
    expect(questionParts({ kind: "which", a: "Manuel Lopez", b: "Ana Souza" })).toEqual([
      { key: "ask_which", vars: { a: "Manuel Lopez", b: "Ana Souza" } },
    ]);
  });

  it("keeps every template valid", () => {
    expect(verifyTemplates()).toEqual([]);
  });
});

describe("matching a spoken choice", () => {
  it.each([
    ["One.", 1],
    ["the first one", 1],
    ["1", 1],
    ["एक", 1],
    ["१", 1],
    ["uno", 1],
    ["ఒకటి", 1],
    ["واحد", 1],
    ["Two!", 2],
    ["number two", 2],
    ["दूसरा", 2],
    ["dois", 2],
    ["రెండు", 2],
    ["اثنان", 2],
    ["to", 2],
  ])("reads %s as option %i", (said, want) => {
    expect(matchChoice(said)).toBe(want);
  });

  it.each(["", "Lopes", "one or two", "send it to him please now then", "I want to go"])("doesn't guess from %j", (said) => {
    expect(matchChoice(said)).toBeNull();
  });
});

describe("choosing a voice", () => {
  const voice = (name: string) => ({ name, lang: "en-US", localService: true });

  it("skips joke voices and prefers natural ones", () => {
    const voices = [voice("Albert"), voice("Bad News"), voice("Aaron"), voice("Samantha")];
    expect(pickVoice(voices, "en-US")?.name).toBe("Samantha");
  });

  it("prefers a downloaded high-quality voice", () => {
    expect(pickVoice([voice("Samantha"), voice("Ava (Premium)")], "en-US")?.name).toBe("Ava (Premium)");
  });

  it("still speaks if only a joke voice exists", () => {
    expect(pickVoice([voice("Albert")], "en-US")?.name).toBe("Albert");
  });
});

describe("mergeAnswer", () => {
  it("adds the answer to what was said", () => {
    expect(mergeAnswer("Send money to Ana Souza ", " 20 dollars")).toBe("Send money to Ana Souza 20 dollars");
  });
});
