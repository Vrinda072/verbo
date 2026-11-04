import { config } from "@/lib/config";
import type { PayPalClient } from "./client";
import { MockPayPalClient } from "./mock";
import { RealPayPalClient } from "./real";

export type { PayPalClient } from "./client";
export * from "./types";

let instance: PayPalClient | undefined;

/** MOCK=1 → in-memory fake; MOCK=0 → PayPal sandbox. */
export function getPayPal(): PayPalClient {
  instance ??= config.mock ? new MockPayPalClient() : new RealPayPalClient();
  return instance;
}
