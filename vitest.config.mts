import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: { include: ["tests/**/*.test.ts"], environment: "node", env: { MOCK: "1", PAYPAL_ENV: "sandbox", PGLITE_DIR: "memory", DATABASE_URL: "", SANDBOX_SENDER_EMAIL: "", SANDBOX_INTENDED_RECIPIENT_EMAIL: "", SANDBOX_WRONG_RECIPIENT_EMAIL: "" } },
});
