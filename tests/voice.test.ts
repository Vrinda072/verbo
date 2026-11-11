import { describe, expect, it } from "vitest";
import { labelsFor } from "@/lib/bridge/readback";
import { synthesize, VOICE_MODEL, VOICE_SETTINGS, VoiceFailed } from "@/lib/speech/elevenlabs";
import { looksLikeAmount, partsAreAllowed, renderSpoken } from "@/lib/speech/spoken";

describe("which sentences the cloud voice may read", () => {
  it("allows Verbo's fixed sentences with contact names and a formatted amount", () => {
    expect(
      partsAreAllowed([
        { key: "readback", vars: { amount: "$40.00", recipient: "Manuel Lopes" } },
        { key: "lookalike", vars: { other: "Manuel Lopez" } },
      ]),
    ).toBe(true);
    expect(partsAreAllowed([{ key: "ask_amount" }])).toBe(true);
  });

  it("refuses free text, unknown names and odd amounts", () => {
    expect(partsAreAllowed([{ key: "readback", vars: { amount: "$40.00", recipient: "Anyone at all" } }])).toBe(false);
    expect(partsAreAllowed([{ key: "readback", vars: { amount: "forty dollars", recipient: "Ana Souza" } }])).toBe(false);
    expect(partsAreAllowed([{ key: "ask_amount", vars: { extra: "Ana Souza" } }])).toBe(false);
    expect(partsAreAllowed([{ key: "rc_body" as never, vars: { sender: "x", amount: "$1" } }])).toBe(false);
    expect(partsAreAllowed([])).toBe(false);
  });

  it("allows a spelled-out option only with a choice number and a short capital letter", () => {
    const ok = { key: "ask_option_known" as const, vars: { name: "Manuel Lopez", letter: "Z" }, choice: 1 as const };
    expect(partsAreAllowed([{ key: "ask_same_sound" }, ok])).toBe(true);
    expect(partsAreAllowed([{ ...ok, choice: undefined }])).toBe(false);
    expect(partsAreAllowed([{ ...ok, vars: { name: "Manuel Lopez", letter: "pay me" } }])).toBe(false);
    expect(partsAreAllowed([{ ...ok, vars: { name: "Manuel Lopez", letter: "Z", n: "five" } }])).toBe(false);
  });

  it("accepts amounts as they are formatted in other locales", () => {
    expect(looksLikeAmount("US$ 40,00")).toBe(true);
    expect(looksLikeAmount("٤٠٫٠٠ US$")).toBe(true);
    expect(looksLikeAmount("$1,234.50")).toBe(true);
    expect(looksLikeAmount("$40 now")).toBe(false);
  });

  it("speaks the same words the screen shows", () => {
    const parts = [{ key: "ask_which" as const, vars: { a: "Manuel Lopez", b: "Manuel Lopes" } }];
    expect(renderSpoken(parts, labelsFor("en"))).toBe(labelsFor("en").t("ask_which", parts[0].vars));
  });
});

describe("synthesize", () => {
  it("sends the documented request and caches the clip", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    }) as unknown as typeof fetch;
    const a = await synthesize("Cache me once", "hi-IN", { apiKey: "k", voiceId: "v1", fetchImpl });
    const b = await synthesize("Cache me once", "hi-IN", { apiKey: "k", voiceId: "v1", fetchImpl });
    expect([...a]).toEqual([1, 2, 3]);
    expect(b).toBe(a);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.elevenlabs.io/v1/text-to-speech/v1?output_format=mp3_44100_128");
    expect((calls[0].init.headers as Record<string, string>)["xi-api-key"]).toBe("k");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ text: "Cache me once", model_id: VOICE_MODEL, language_code: "hi", voice_settings: VOICE_SETTINGS });
  });

  it("reports a refusal without the response body", async () => {
    const fetchImpl = (async () => new Response("quota", { status: 401 })) as unknown as typeof fetch;
    await expect(synthesize("x unique", "en", { apiKey: "k", fetchImpl })).rejects.toEqual(new VoiceFailed(401));
  });
});
