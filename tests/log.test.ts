import { describe, expect, it } from "vitest";
import { mask, maskEmail } from "@/lib/core/log";

describe("log masking", () => {
  it("masks emails and phone numbers", () => {
    expect(maskEmail("maria.lopes@example.com")).toBe("m***@example.com");
    expect(mask("call +1 (555) 123-4567 now")).not.toContain("123-4567");
  });
  it("redacts secret-looking keys at any depth", () => {
    const out = mask({ a: { client_secret: "x", Authorization: "Bearer y", nested: [{ api_key: "z" }] } }) as { a: { client_secret: string; Authorization: string; nested: { api_key: string }[] } };
    expect(out.a.client_secret).toBe("[redacted]");
    expect(out.a.Authorization).toBe("[redacted]");
    expect(out.a.nested[0].api_key).toBe("[redacted]");
  });
});
