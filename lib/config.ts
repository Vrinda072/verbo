/**
 * App-wide configuration. The product name lives here (and in APP_NAME)
 * so it can be changed in one place.
 */
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || process.env.APP_NAME || "Verbo";

export const config = {
  appName: APP_NAME,
  baseUrl: process.env.APP_BASE_URL || "http://localhost:3000",
  /** MOCK=1 swaps PayPal / speech / LLM clients for deterministic fakes. Default ON. */
  mock: (process.env.MOCK ?? "1") !== "0",
  paypal: {
    env: (process.env.PAYPAL_ENV || "sandbox") as "sandbox" | "live",
    /** Base URL from PayPal's OpenAPI specs (servers[0]). Verbo is sandbox-only. */
    apiBase: "https://api-m.sandbox.paypal.com",
  },
  /** Microphone: the browser's free built-in speech recognition, or Soniox (needs paid credit). */
  speechProvider: (process.env.SPEECH_PROVIDER === "soniox" ? "soniox" : "browser") as "browser" | "soniox",
  /** Risk hold window in minutes (authorization left uncaptured). */
  riskHoldMinutes: Number(process.env.RISK_HOLD_MINUTES || 10),
} as const;

export function assertSandbox(): void {
  if (config.paypal.env !== "sandbox") {
    throw new Error("Verbo runs against the PayPal sandbox only. Set PAYPAL_ENV=sandbox.");
  }
}
