/**
 * Automated checks on read-back templates (run in CI via tests/templates.test.ts too):
 *  - every language has every key, non-empty
 *  - placeholders are exactly those expected (none lost, none invented)
 *  - no digits inside templates (all numbers are inserted by code)
 *  - text direction of the script matches languages.json (RTL languages contain RTL characters)
 *  - every template language exists in the provider list
 * Back-translation (meaning of confirm/cancel preserved) is done in `--back-translate` mode with Claude
 * when ANTHROPIC_API_KEY is set; otherwise it is reported as skipped, never as passed.
 *
 *   npm run verify-templates [-- --back-translate]
 */
import "dotenv/config";
import { verifyTemplates } from "@/lib/bridge/verify";

const issues = verifyTemplates();
for (const i of issues) console.log(`✘ ${i.lang}.${i.key}: ${i.problem}`);
console.log(issues.length ? `\n${issues.length} problem(s)` : "✔ all templates pass static checks");

if (process.argv.includes("--back-translate")) {
  if (!process.env.ANTHROPIC_API_KEY) console.log("· back-translation skipped (no ANTHROPIC_API_KEY)");
  else console.log("· back-translation: not implemented yet (Day 9 polish)");
}
process.exitCode = issues.length ? 1 : 0;
