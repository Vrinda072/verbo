/**
 * Finds soft, calm voices on your ElevenLabs account and saves the same Verbo question in each, so you can pick by ear.
 *   npm run voice-samples
 * Then set ELEVENLABS_VOICE_ID in .env to the id of the one you like.
 * Source: elevenlabs.io/docs/api-reference/voices/search (GET /v2/voices, read Nov 11, 2026).
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { labelsFor } from "@/lib/bridge/readback";
import { synthesize } from "@/lib/speech/elevenlabs";

const SOFT = /soft|calm|gentle|warm|soothing|friendly|relaxed|kind/i;
const OUT = "voice-samples";
const MAX_VOICES = 4;

const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) {
  console.error("Add ELEVENLABS_API_KEY to .env first.");
  process.exit(1);
}

async function main(apiKey: string) {
  const res = await fetch("https://api.elevenlabs.io/v2/voices?page_size=100", { headers: { "xi-api-key": apiKey } });
  if (!res.ok) {
    console.error(`ElevenLabs refused the voice list (${res.status}). Check that the key allows reading voices.`);
    process.exit(1);
  }
  type Voice = { voice_id: string; name: string; description?: string | null; labels?: Record<string, string> };
  const { voices } = (await res.json()) as { voices: Voice[] };
  const describe = (v: Voice) => [v.description ?? "", ...Object.values(v.labels ?? {})].join(" ");
  const soft = voices.filter((v) => SOFT.test(describe(v)));
  const picks = (soft.length ? soft : voices).slice(0, MAX_VOICES);
  console.log(`${voices.length} voices on the account, ${soft.length} described as soft or calm.\n`);

  mkdirSync(OUT, { recursive: true });
  const vars = { a: "Manuel Lopez", b: "Manuel Lopes" };
  for (const v of picks) {
    for (const lang of ["en", "hi"]) {
      const text = labelsFor(lang).t("ask_which", vars);
      try {
        const audio = await synthesize(text, lang, { apiKey, voiceId: v.voice_id });
        const file = `${OUT}/${v.name.replace(/[^\w-]+/g, "_")}-${lang}.mp3`;
        writeFileSync(file, audio);
        console.log(`${file}`);
      } catch (err) {
        console.log(`${v.name} ${lang}: failed (${(err as Error).message})`);
      }
    }
    console.log(`  ${v.name}: ELEVENLABS_VOICE_ID=${v.voice_id}  (${describe(v).trim().slice(0, 80)})\n`);
  }
}

void main(apiKey);
