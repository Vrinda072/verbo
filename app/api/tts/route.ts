import { z } from "zod";
import { labelsFor } from "@/lib/bridge/readback";
import { overLimit } from "@/lib/rateLimit";
import { synthesize } from "@/lib/speech/elevenlabs";
import { MAX_PARTS, partsAreAllowed, renderSpoken, SPOKEN_KEYS, type SpokenPart } from "@/lib/speech/spoken";

export const dynamic = "force-dynamic";

const Body = z.object({
  lang: z.string().regex(/^[a-z]{2,3}(-[A-Za-z0-9]+)*$/),
  parts: z.array(z.object({ key: z.enum(SPOKEN_KEYS), vars: z.record(z.string(), z.string().max(60)).optional(), choice: z.union([z.literal(1), z.literal(2)]).optional() })).max(MAX_PARTS),
});

const json = (body: unknown, status: number) => Response.json(body, { status });

/** POST /api/tts — speaks one of Verbo's fixed sentences with ElevenLabs. 404 when no key is set: the page uses the browser voice. */
export async function POST(req: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return json({ error: "no_voice" }, 404);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !partsAreAllowed(parsed.data.parts as SpokenPart[])) return json({ error: "invalid_request" }, 400);
  if (overLimit("tts", 30)) return json({ error: "busy" }, 503);
  const L = labelsFor(parsed.data.lang);
  try {
    const audio = await synthesize(renderSpoken(parsed.data.parts as SpokenPart[], L), L.usedLang, {
      apiKey,
      voiceId: process.env.ELEVENLABS_VOICE_ID,
    });
    return new Response(new Uint8Array(audio), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=3600" } });
  } catch {
    return json({ error: "voice_failed" }, 502);
  }
}
