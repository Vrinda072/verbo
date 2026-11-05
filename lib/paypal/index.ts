import { config } from "@/lib/config";
import type { PayPalClient } from "./client";
import { MockPayPalClient } from "./mock";
import { RealPayPalClient } from "./real";

export type { PayPalClient } from "./client";
export * from "./types";

const g = globalThis as unknown as { __verboPayPal?: PayPalClient };

/** MOCK=1 → in-memory fake; MOCK=0 → PayPal sandbox. One instance per process (survives dev hot reload). */
export function getPayPal(): PayPalClient {
  g.__verboPayPal ??= config.mock ? new MockPayPalClient() : new RealPayPalClient();
  return g.__verboPayPal;
}
