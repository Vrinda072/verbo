import { describe, expect, it } from "vitest";
import { CONTACTS } from "@/lib/people/contacts";
import { assessRisk } from "@/lib/risk/score";
import { findPressureCues } from "@/lib/risk/pressure";

const c = (id: string) => CONTACTS.find((x) => x.id === id)!;

describe("pressure cues", () => {
  it("finds cues across languages", () => {
    expect(findPressureCues("Send it right now, the police are coming").map((x) => x.category)).toEqual(
      expect.arrayContaining(["urgency", "authority"]),
    );
    expect(findPressureCues("వెంటనే పంపండి, ఎవరికీ చెప్పకండి").length).toBeGreaterThanOrEqual(2);
    expect(findPressureCues("Envía rápido, es urgente").length).toBeGreaterThan(0);
  });
  it("uses word boundaries for Latin cues", () => {
    expect(findPressureCues("pay the taxi driver 20")).toEqual([]);
  });
  it("ignores model cues that are not in the transcript", () => {
    expect(findPressureCues("send 20 to Kiran", ["the police said so"])).toEqual([]);
    expect(findPressureCues("my nephew says send it before tonight", ["before tonight"])[0].category).toBe("model");
  });
});

describe("assessRisk", () => {
  it("low: known payee, normal amount, calm", () => {
    const r = assessRisk({ recipient: c("c_kiran"), lookAlikes: [], cents: 2500, transcript: "send 25 to Kiran", senderLanguage: "te" });
    expect(r.level).toBe("low");
    expect(r.hold).toBe(false);
  });

  it("intended Manuel Lopez stays low-ish: look-alike exists but he is a known payee", () => {
    const r = assessRisk({ recipient: c("c_lopez"), lookAlikes: [c("c_lopes")], cents: 1234, transcript: "send 12.34 to Manuel Lopez", senderLanguage: "te" });
    expect(r.level).toBe("low");
    expect(r.signals.map((s) => s.code)).toEqual(["similar_recipient"]);
  });

  it("high + hold: the look-alike Manuel Lopes, never paid, different language (the demo mistake)", () => {
    const r = assessRisk({ recipient: c("c_lopes"), lookAlikes: [c("c_lopez")], cents: 1234, transcript: "send 12.34 to Manuel Lopes", senderLanguage: "te" });
    expect(r.level).toBe("high");
    expect(r.hold).toBe(true);
    expect(r.signals.map((s) => s.code)).toEqual(["similar_recipient", "first_time", "language_mismatch"]);
  });

  it("high: pressure language + unusual amount even to a known payee", () => {
    const r = assessRisk({ recipient: c("c_lakshmi"), lookAlikes: [], cents: 90000, transcript: "send 900 to Lakshmi immediately", senderLanguage: "en" });
    expect(r.level).toBe("high");
  });

  it("medium: unusual amount alone", () => {
    const r = assessRisk({ recipient: c("c_lakshmi"), lookAlikes: [], cents: 50000, transcript: "send 500 to Lakshmi", senderLanguage: "te" });
    expect(r.level).toBe("medium");
    expect(r.hold).toBe(false);
  });

  it("$1,000+ is always unusual", () => {
    const r = assessRisk({ recipient: c("c_kiran"), lookAlikes: [], cents: 100000, transcript: "send 1000 to Kiran", senderLanguage: "te" });
    expect(r.signals.some((s) => s.code === "unusual_amount")).toBe(true);
  });
});
