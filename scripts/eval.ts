/**
 * Runs the scripted scenarios in evals/scenarios.ts and writes docs/eval.md.
 *
 *   npm run eval                      # rules extractor (offline, deterministic)
 *   npm run eval -- --extractor=gemini      # Gemini (needs GEMINI_API_KEY; free tier, paced 7 s per request, --pace=ms to change)
 *   GEMINI_MODEL=gemini-3.5-flash-lite npm run eval -- --extractor=gemini   # test one model on its own
 *   npm run eval -- --extractor=anthropic   # Claude extractor (needs ANTHROPIC_API_KEY; costs a few cents)
 *
 * Numbers in docs/eval.md describe these scripted cases only — not real users or real-world accuracy.
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { understand, validateExtraction, type LlmExtraction } from "@/lib/agents/extraction";
import { RulesExtractor } from "@/lib/agents/extraction/rules";
import { AnthropicExtractor, EXTRACTION_MODEL } from "@/lib/agents/extraction/anthropic";
import { GeminiExtractor } from "@/lib/agents/extraction/gemini";
import { GEMINI_MODELS, GeminiFailed } from "@/lib/ai/gemini";
import { assessRisk } from "@/lib/risk/score";
import { GUARDS, PIPELINE, type Expect } from "@/evals/scenarios";

const which = process.argv.find((a) => a.startsWith("--extractor="))?.split("=")[1] ?? "rules";
const extractor = which === "anthropic" ? new AnthropicExtractor() : which === "gemini" ? new GeminiExtractor() : new RulesExtractor();
const paceMs = Number(process.argv.find((a) => a.startsWith("--pace="))?.split("=")[1] ?? (which === "gemini" ? 7000 : 0));

interface Row {
  id: string;
  tags: string[];
  expected: string;
  got: string;
  pass: boolean;
  /** The provider never answered (free quota or outage), so this says nothing about Verbo either way. */
  notRun?: boolean;
}

const fmt = (e: Expect) => (e.ok ? `${e.recipient} · ${e.cents}¢ · ${e.level}` : `✘ ${e.problem}`);

async function main() {
  const rows: Row[] = [];
  let quotaGone = false;
  for (const s of PIPELINE) {
    if (quotaGone) {
      rows.push({ id: s.id, tags: s.tags, expected: fmt(s.expect), got: "not run (free quota used up)", pass: false, notRun: true });
      continue;
    }
    if (paceMs && rows.length) await new Promise((r) => setTimeout(r, paceMs));
    let u: Awaited<ReturnType<typeof understand>>;
    // No fallback: a provider error must show as an error here, not be credited to the rules parser.
    const ask = () => understand({ transcript: s.transcript, language: s.lang }, extractor, undefined, { fallback: false });
    try {
      try {
        u = await ask();
      } catch (err) {
        if (!(err instanceof GeminiFailed && err.reason === "unavailable")) throw err;
        await new Promise((r) => setTimeout(r, 30_000)); // a brief outage shouldn't cost the scenario
        u = await ask();
      }
    } catch (err) {
      if (err instanceof GeminiFailed && (err.reason === "quota" || err.reason === "unavailable")) {
        quotaGone ||= err.reason === "quota";
        rows.push({ id: s.id, tags: s.tags, expected: fmt(s.expect), got: `not run (${err.reason})`, pass: false, notRun: true });
        continue;
      }
      rows.push({ id: s.id, tags: s.tags, expected: fmt(s.expect), got: `error: ${String((err as Error).message).slice(0, 80).replace(/\|/g, "/")}`, pass: false });
      continue;
    }
    let got: string;
    let pass: boolean;
    if (u.result.ok) {
      const d = u.result.draft;
      const risk = assessRisk({
        recipient: d.recipient,
        lookAlikes: d.lookAlikes.map((m) => m.contact),
        cents: d.amount.cents,
        transcript: s.transcript,
        senderLanguage: s.lang,
        modelPressureCues: u.extraction.pressure_cues,
      });
      got = `${d.recipient.id} · ${d.amount.cents}¢ · ${risk.level}`;
      pass = s.expect.ok && s.expect.recipient === d.recipient.id && s.expect.cents === d.amount.cents && s.expect.level === risk.level;
    } else {
      got = `✘ ${u.result.problems.map((p) => p.code).join(", ")}`;
      pass = !s.expect.ok && u.result.problems.some((p) => p.code === (s.expect as { problem: string }).problem);
    }
    rows.push({ id: s.id, tags: s.tags, expected: fmt(s.expect), got, pass });
  }

  const guardRows: Row[] = [];
  for (const g of GUARDS) {
    const base: LlmExtraction = {
      intent: "send_money",
      recipient_spoken: "Manuel Lopez",
      recipient_latin: "Manuel Lopez",
      amount_spoken: null,
      amount: null,
      currency: "USD",
      pressure_cues: [],
      unclear: null,
    };
    const r = validateExtraction({ ...base, ...g.model }, g.transcript);
    const codes: string[] = r.ok ? [] : r.problems.map((p) => p.code);
    guardRows.push({
      id: g.id,
      tags: g.tags,
      expected: `✘ ${g.expect.problem}`,
      got: r.ok ? "accepted" : `✘ ${codes.join(", ")}`,
      pass: !r.ok && codes.includes(g.expect.problem),
    });
  }

  const p = rows.filter((r) => r.pass).length;
  const ran = rows.filter((r) => !r.notRun);
  const skipped = rows.length - ran.length;
  const gp = guardRows.filter((r) => r.pass).length;
  const table = (rs: Row[]) =>
    `| Scenario | Tags | Expected | Got | |\n|---|---|---|---|---|\n` +
    rs.map((r) => `| ${r.id} | ${r.tags.join(", ")} | ${r.expected} | ${r.got} | ${r.notRun ? "–" : r.pass ? "✅" : "❌"} |`).join("\n");

  const label = which === "anthropic" ? `Claude (\`${EXTRACTION_MODEL}\`)` : which === "gemini" ? `Gemini (\`${GEMINI_MODELS.join("`, then `")}\`)` : "rule-based parser (offline)";
  const md = `# Evaluation — scripted scenarios

**What this is:** ${PIPELINE.length + GUARDS.length} scenarios written by the Verbo team (\`evals/scenarios.ts\`),
run by \`npm run eval\` on ${new Date().toISOString().slice(0, 10)}. They check that Verbo behaves the way we intended on cases we chose.
**What this is not:** a measure of real-world accuracy. No real users, no real voice audio, no fraud data.

Extractor: **${label}**.

**Caveats.** The rule-based parser and these scenarios were written by the same team at the same time, so a high
score on the offline run mainly shows the parts are consistent with each other. Risk expectations follow the
documented weights in \`lib/risk/score.ts\`; three expectations were corrected after the first run (Nov 5) because they
contradicted those weights; two more changed on Nov 6 when the parser learned number words and name matching. The offline run and the AI runs are reported separately. Real recorded speech is not covered here.

## Pipeline (transcript → extraction → code validation → risk)
**${p}/${ran.length}** scenarios run matched the expected recipient, amount and risk level (or the expected refusal).${skipped ? ` **${skipped} of ${rows.length} were not run** because the provider gave no answer (free quota or outage); they count neither way.` : ""}

${table(rows)}

## Guards (deliberately wrong model output → code validation)
These feed a wrong extraction straight into validation to check that code — not the model — decides money.
**${gp}/${guardRows.length}** wrong outputs were caught.

${table(guardRows)}
`;
  writeFileSync(which === "rules" ? "docs/eval.md" : `docs/eval-${which}.md`, md);
  console.log(`pipeline ${p}/${ran.length} run${skipped ? ` (${skipped} not run)` : ""} · guards ${gp}/${guardRows.length} · extractor ${which}`);
  for (const r of [...rows, ...guardRows].filter((r) => !r.pass && !r.notRun)) console.log(`  ✘ ${r.id}: expected ${r.expected}, got ${r.got}`);
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
