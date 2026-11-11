/**
 * Refuses a commit if any staged file contains a value from .env or a secret-looking string.
 * Prints file names only — never the matching value. Usage: npm run precommit-check
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const staged = execSync("git diff --cached --name-only --diff-filter=ACM", { encoding: "utf8" })
  .split("\n")
  .filter(Boolean);

const blockedFiles = staged.filter((f) => /(^|\/)\.env(?!\.example$)/.test(f) || f.endsWith(".pem"));

const envValues: string[] = [];
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    const [, key, raw] = m;
    const v = raw.trim().replace(/^["']|["']$/g, "");
    // Non-secret config values are allowed to appear in code.
    if (["APP_NAME", "NEXT_PUBLIC_APP_NAME", "APP_BASE_URL", "MOCK", "PAYPAL_ENV", "LLM_PROVIDER", "ELEVENLABS_VOICE_ID"].includes(key)) continue;
    if (v.length >= 8) envValues.push(v);
  }
}

const PATTERNS = [
  /sk-ant-[A-Za-z0-9_-]{20,}/, // Anthropic
  /gsk_[A-Za-z0-9]{20,}/, // Groq
  /AIza[A-Za-z0-9_-]{30,}|AQ\.[A-Za-z0-9_-]{30,}/, // Google
  /A21AA[A-Za-z0-9_-]{40,}/, // PayPal access token
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /ghp_[A-Za-z0-9]{30,}|gho_[A-Za-z0-9]{30,}/,
  /\bsk_[a-f0-9]{40,}/, // ElevenLabs
];

const hits: string[] = [];
for (const f of staged) {
  if (!existsSync(f)) continue;
  const content = execSync(`git show :${JSON.stringify(f).slice(1, -1)}`, { encoding: "utf8", maxBuffer: 50e6 });
  if (envValues.some((v) => content.includes(v)) || PATTERNS.some((p) => p.test(content))) hits.push(f);
}

if (blockedFiles.length || hits.length) {
  console.error("✘ Possible secret in staged files (values not shown):");
  for (const f of [...blockedFiles, ...hits]) console.error("   -", f);
  process.exit(1);
}
console.log(`✔ No secrets found in ${staged.length} staged file(s).`);
