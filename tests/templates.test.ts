import { describe, expect, it } from "vitest";
import { verifyTemplates } from "@/lib/bridge/verify";
import { formatAmount, labelsFor } from "@/lib/bridge/readback";
import { money } from "@/lib/paypal/money";
import templatesFile from "@/lib/bridge/templates.json";

describe("read-back templates", () => {
  it("pass static checks (keys, placeholders, no digits, RTL script)", () => {
    expect(verifyTemplates()).toEqual([]);
  });

  it("catches a lost placeholder and an inserted digit", () => {
    const broken = structuredClone(templatesFile);
    broken.templates.es.strings.readback = "¿Enviar 12 a alguien?";
    const issues = verifyTemplates(broken);
    expect(issues.some((i) => i.lang === "es" && i.problem.startsWith("placeholders"))).toBe(true);
    expect(issues.some((i) => i.lang === "es" && i.problem.includes("digits"))).toBe(true);
  });

  it("renders Telugu read-back with code-inserted values and flags it as machine-translated", () => {
    const l = labelsFor("te-IN");
    const amt = formatAmount(money(1234), "te");
    expect(l.t("readback", { amount: amt.localized, recipient: "Manuel Lopez" })).toContain("Manuel Lopez");
    expect(l.machineTranslated).toBe(true);
    expect(l.reviewed).toBe(false);
    expect(amt.digits).toBe("12.34");
  });

  it("marks Arabic as RTL and falls back to English (flagged) for languages without templates", () => {
    expect(labelsFor("ar").dir).toBe("rtl");
    const sw = labelsFor("sw");
    expect(sw.fallback).toBe(true);
    expect(sw.usedLang).toBe("en");
  });
});
