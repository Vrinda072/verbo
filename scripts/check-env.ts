/**
 * Prints which env variables are set or missing — by NAME only, never values.
 * Usage: npm run check-env
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const example = readFileSync(join(process.cwd(), ".env.example"), "utf8");
const names = example
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#") && l.includes("="))
  .map((l) => l.split("=")[0]);

/** Needed for the real (MOCK=0) money loop. */
const REQUIRED_FOR_SANDBOX = new Set([
  "PAYPAL_CLIENT_ID",
  "PAYPAL_CLIENT_SECRET",
  "SANDBOX_SENDER_EMAIL",
  "SANDBOX_INTENDED_RECIPIENT_EMAIL",
  "SANDBOX_WRONG_RECIPIENT_EMAIL",
  "TOKEN_SIGNING_SECRET",
]);
/** Optional: something falls back sensibly when empty. */
const OPTIONAL: Record<string, string> = {
  DATABASE_URL: "empty → embedded PGlite (./.pglite)",
  PAYPAL_WEBHOOK_ID: "needed only to verify webhook signatures",
  SONIOX_API_KEY: "needed from Day 2 (speech)",
  GROQ_API_KEY: "for the microphone: records until you tap stop, then Whisper writes it down",
  GEMINI_API_KEY: "needed for AI understanding and translation (free key from Google AI Studio)",
  ANTHROPIC_API_KEY: "optional alternative to Gemini",
  AG_GRID_LICENSE_KEY: "removes the AG Grid watermark",
  AG_STUDIO_LICENSE_KEY: "removes the AG Studio watermark",
};

let missingRequired = 0;
console.log("Verbo env check (names only, values are never printed)\n");
for (const name of names) {
  const set = (process.env[name] ?? "").trim().length > 0;
  const tag = set ? "✔ set    " : REQUIRED_FOR_SANDBOX.has(name) ? "✘ MISSING" : "· empty  ";
  if (!set && REQUIRED_FOR_SANDBOX.has(name)) missingRequired++;
  const note = !set && OPTIONAL[name] ? `  (${OPTIONAL[name]})` : "";
  console.log(`${tag}  ${name}${note}`);
}
console.log(
  missingRequired === 0
    ? "\nAll variables needed for the sandbox money loop are set."
    : `\n${missingRequired} variable(s) needed for the sandbox money loop are missing. MOCK=1 still works.`,
);
