import { describe, expect, it } from "vitest";
import { paypalLocale } from "@/lib/paypal/locale";
import { startTransfer } from "@/lib/paypal/flows";
import { money } from "@/lib/paypal/money";
import type { PayPalClient } from "@/lib/paypal/client";

describe("PayPal page language", () => {
  it("maps each read-back language to a locale PayPal accepted", () => {
    expect(["en", "hi", "te", "es", "pt", "ar"].map(paypalLocale)).toEqual(["en-US", "hi-IN", "te-IN", "es-MX", "pt-BR", "ar-EG"]);
    expect(paypalLocale("hi-IN")).toBe("hi-IN");
    expect(paypalLocale("vi")).toBeUndefined();
    expect(paypalLocale(null)).toBeUndefined();
  });

  it("passes the sender's language to the order", async () => {
    const seen: unknown[] = [];
    const pp = {
      kind: "mock",
      createOrder: async (input: unknown) => {
        seen.push(input);
        return { id: "O1", status: "PAYER_ACTION_REQUIRED", approveUrl: "https://example.test/a" };
      },
    } as unknown as PayPalClient;
    await startTransfer(pp, {
      id: "tr_locale1",
      amount: money(4000),
      senderEmail: "s@example.test",
      recipientEmail: "r@example.test",
      urls: { returnUrl: "https://example.test/r", cancelUrl: "https://example.test/c" },
      locale: paypalLocale("hi"),
    });
    expect(seen[0]).toMatchObject({ locale: "hi-IN" });
  });
});
