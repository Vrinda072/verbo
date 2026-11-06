/**
 * Runs the scripted scenarios in evals/scenarios.ts and writes docs/eval.md.
 *
 *   npm run eval                      # rules extractor (offline, deterministic)
 *   npm run eval -- --extractor=gemini      # Gemini (needs GEMINI_API_KEY; free tier, paced 7 s per request, --pace=ms to change)
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
import { GEMINI_MODEL } from "@/lib/ai/gemini";
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
}

const fmt = (e: Expect) => (e.ok ? `${e.recipient} · ${e.cents}¢ · ${e.level}` : `✘ ${e.problem}`);

async function main() {
  const rows: Row[] = [];
  for (const s of PIPELINE) {
    if (paceMs && rows.length) await new Promise((r) => setTimeout(r, paceMs));
    let u: Awaited<ReturnType<typeof understand>>;
    try {
      // No fallback: a provider error must show as an error here, not be credited to the rules parser.
      u = await understand({ transcript: s.transcript, language: s.lang }, extractor, undefined, { fallback: false });
    } catch (err) {
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
  const gp = guardRows.filter((r) => r.pass).length;
  const table = (rs: Row[]) =>
    `| Scenario | Tags | Expected | Got | |\n|---|---|---|---|---|\n` +
    rs.map((r) => `| ${r.id} | ${r.tags.join(", ")} | ${r.expected} | ${r.got} | ${r.pass ? "✅" : "❌"} |`).join("\n");

  const label = which === "anthropic" ? `Claude (\`${EXTRACTION_MODEL}\`)` : which === "gemini" ? `Gemini (\`${GEMINI_MODEL}\`)` : "rule-based parser (offline)";
  const md = `# Evaluation — scripted scenarios

**What this is:** ${PIPELINE.length + GUARDS.length} scenarios written by the Verbo team (\`evals/scenarios.ts\`),
run by \`npm run eval\` on ${new Date().toISOString().slice(0, 10)}. They check that Verbo behaves the way we intended on cases we chose.
**What this is not:** a measure of real-world accuracy. No real users, no real voice audio, no fraud data.

Extractor: **${label}**.

**Caveats.** The rule-based parser and these scenarios were written by the same team at the same time, so a high
score on the offline run mainly shows the parts are consistent with each other. Risk expectations follow the
documented weights in \`lib/risk/score.ts\`; three expectations were corrected after the first run (Nov 5) because they
contradicted those weights; two more changed on Nov 6 when the parser learned number words and name matching. The meaningful tests still to run are the Claude extractor (\`--extractor=anthropic\`)
and real recorded speech.

## Pipeline (transcript → extraction → code validation → risk)
**${p}/${rows.length}** scenarios matched the expected recipient, amount and risk level (or the expected refusal).

${table(rows)}

## Guards (deliberately wrong model output → code validation)
These feed a wrong extraction straight into validation to check that code — not the model — decides money.
**${gp}/${guardRows.length}** wrong outputs were caught.

${table(guardRows)}
`;
  writeFileSync(which === "rules" ? "docs/eval.md" : `docs/eval-${which}.md`, md);
  console.log(`pipeline ${p}/${rows.length} · guards ${gp}/${guardRows.length} · extractor ${which}`);
  for (const r of [...rows, ...guardRows].filter((r) => !r.pass)) console.log(`  ✘ ${r.id}: expected ${r.expected}, got ${r.got}`);
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
