import { describe, expect, it } from "vitest";
import { labelsFor, templateLanguages } from "@/lib/bridge/readback";

describe("read-back parts keep values separate from the sentence", () => {
  it("splits the Arabic read-back so the amount and name can be isolated", () => {
    const parts = labelsFor("ar").parts("readback", { amount: "US$ 40.00", recipient: "Manuel Lopez" });
    expect(parts.filter((p) => p.value).map((p) => [p.value, p.text])).toEqual([
      ["amount", "US$ 40.00"],
      ["recipient", "Manuel Lopez"],
    ]);
    expect(parts.map((p) => p.text).join("")).toBe(labelsFor("ar").t("readback", { amount: "US$ 40.00", recipient: "Manuel Lopez" }));
  });

  it("rebuilds every template exactly in every language", () => {
    const vars = { amount: "$1", recipient: "R", other: "O", contact: "C", sender: "S", minutes: "10", numbers: "1", a: "A", b: "B", n: "1", name: "N", letter: "z" };
    for (const lang of templateLanguages()) {
      const L = labelsFor(lang);
      for (const k of ["readback", "lookalike", "number_near", "rc_body", "sent", "case_sent", "returned_sender"] as const) {
        expect(L.parts(k, vars).map((p) => p.text).join("")).toBe(L.t(k, vars));
      }
    }
  });
});
