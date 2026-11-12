/**
 * Speech spike: synthetic voice (macOS `say`) → Soniox real-time STT (same temp-key + WebSocket path as the
 * browser) → extraction → code validation. Proves the pipeline end to end per language.
 *
 *   npm run speech-spike                 # all cases
 *   npm run speech-spike -- --only=es    # one language
 *   npm run speech-spike -- --file=clip.m4a --lang=te --expect=c_lopez:1234   # a real recording
 *
 * Results are written to docs/eval/speech-spike.md. Synthetic voices are NOT real speakers; the doc says so.
 * Needs SONIOX_API_KEY, macOS `say`, and ffmpeg.
 */
import "dotenv/config";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";
import { buildConfig, mintTemporaryKey, SONIOX_AUTH_PROTOCOL, SONIOX_WS_URL, TranscriptAccumulator, type SonioxResponse } from "@/lib/speech/soniox";
import { understand } from "@/lib/agents/extraction";
import { getExtractor } from "@/lib/agents/extraction";
import { CONTACTS } from "@/lib/people/contacts";

interface Case {
  lang: string;
  voice?: string;
  text?: string;
  file?: string;
  expect: { recipient: string; cents: number };
}

const CASES: Case[] = [
  { lang: "en", voice: "Samantha", text: "Send 12.34 dollars to Manuel Lopez", expect: { recipient: "c_lopez", cents: 1234 } },
  { lang: "es", voice: "Paulina", text: "Envía 20 dólares a Manuel López", expect: { recipient: "c_lopez", cents: 2000 } },
  { lang: "pt", voice: "Luciana", text: "Envie 15 dólares para Manuel Lopes", expect: { recipient: "c_lopes", cents: 1500 } },
  { lang: "hi", voice: "Lekha", text: "मैनुअल लोपेज़ को 25 डॉलर भेजो", expect: { recipient: "c_lopez", cents: 2500 } },
  { lang: "ar", voice: "Majed", text: "أرسل 30 دولارا إلى مانويل لوبيز", expect: { recipient: "c_lopez", cents: 3000 } },
];

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=");
const tmp = mkdtempSync(join(tmpdir(), "verbo-spike-"));

function toPcm(c: Case, i: number): Buffer {
  const src = c.file ?? join(tmp, `${i}.aiff`);
  if (!c.file) execFileSync("say", ["-v", c.voice!, "-o", src, c.text!]);
  const out = join(tmp, `${i}.raw`);
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", src, "-ac", "1", "-ar", "16000", "-f", "s16le", out]);
  return readFileSync(out);
}

async function transcribe(pcm: Buffer, lang: string): Promise<{ text: string; detected?: string; ms: number }> {
  const { apiKey } = await mintTemporaryKey(process.env.SONIOX_API_KEY!, 120);
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(SONIOX_WS_URL, [SONIOX_AUTH_PROTOCOL, apiKey]);
    const acc = new TranscriptAccumulator();
    ws.on("open", async () => {
      const terms = CONTACTS.flatMap((c) => [c.name]);
      ws.send(JSON.stringify(buildConfig({ language: lang, audio: { audio_format: "pcm_s16le", sample_rate: 16000, num_channels: 1 }, terms })));
      const chunk = 3200; // 100 ms
      for (let o = 0; o < pcm.length; o += chunk) {
        ws.send(pcm.subarray(o, o + chunk));
        await new Promise((r) => setTimeout(r, 25)); // ~4x real time
      }
      ws.send(""); // empty text frame ends the stream
    });
    ws.on("message", (data) => {
      const res = JSON.parse(data.toString()) as SonioxResponse;
      if (res.error_code) return reject(new Error(`Soniox ${res.error_code}: ${res.error_message}`));
      acc.push(res);
      if (res.finished) {
        ws.close();
        resolve({ text: acc.final, detected: acc.detectedLanguage, ms: Date.now() - started });
      }
    });
    ws.on("error", reject);
  });
}

async function main() {
  if (!process.env.SONIOX_API_KEY) throw new Error("SONIOX_API_KEY missing");
  let cases = CASES;
  const file = arg("file");
  if (file) {
    const [recipient, cents] = (arg("expect") ?? "c_lopez:0").split(":");
    cases = [{ lang: arg("lang") ?? "te", file, expect: { recipient, cents: Number(cents) } }];
  } else if (arg("only")) cases = CASES.filter((c) => c.lang === arg("only"));

  const extractor = getExtractor();
  const rows: string[] = [];
  let pass = 0;
  for (const [i, c] of cases.entries()) {
    try {
      const t = await transcribe(toPcm(c, i), c.lang);
      const u = await understand({ transcript: t.text, language: c.lang }, extractor);
      const got = u.result.ok ? `${u.result.draft.recipient.id} · ${u.result.draft.amount.cents}¢ (${u.result.draft.amountSource})` : `✘ ${u.result.problems.map((p) => p.code).join(", ")}`;
      const ok = u.result.ok && u.result.draft.recipient.id === c.expect.recipient && u.result.draft.amount.cents === c.expect.cents;
      if (ok) pass++;
      console.log(`${ok ? "✔" : "✘"} ${c.lang}  "${t.text}"  →  ${got}  [${t.ms} ms, detected ${t.detected ?? "?"}]`);
      rows.push(`| ${c.lang} | ${c.file ? "recording" : `synthetic (${c.voice})`} | ${t.text.replace(/\|/g, "/")} | ${t.detected ?? "?"} | ${got} | ${ok ? "✅" : "❌"} |`);
    } catch (err) {
      console.log(`✘ ${c.lang}  error: ${(err as Error).message}`);
      rows.push(`| ${c.lang} | ${c.voice ?? "recording"} | — | — | error: ${(err as Error).message} | ❌ |`);
    }
  }
  console.log(`\n${pass}/${cases.length} passed (extractor: ${extractor.kind})`);
  if (!file && !arg("only")) {
    writeFileSync(
      "docs/eval/speech-spike.md",
      `# Speech spike (${new Date().toISOString().slice(0, 10)})\n\n` +
        `Pipeline: macOS \`say\` **synthetic voice** → Soniox \`stt-rt-v6\` over WebSocket (temporary key, same path as the browser) → ` +
        `extraction (\`${extractor.kind}\`) → code validation. **These are synthetic voices, not real speakers; they say nothing about accuracy for real users.** ` +
        `Telugu has no macOS voice and still needs a real recording.\n\n` +
        `Result: **${pass}/${cases.length}** cases resolved to the expected recipient and amount.\n\n` +
        `| Lang | Audio | Transcript | Detected | Validated as | OK |\n|---|---|---|---|---|---|\n${rows.join("\n")}\n`,
    );
    console.log("Wrote docs/eval/speech-spike.md");
  }
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
