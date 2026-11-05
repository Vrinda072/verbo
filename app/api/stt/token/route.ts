import { NextResponse } from "next/server";
import { mintTemporaryKey, SONIOX_RT_MODEL } from "@/lib/speech/soniox";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * POST /api/stt/token → a 5-minute, single-use Soniox key for one microphone session.
 * The project key never leaves the server. Without a key, the client falls back to typing.
 */
export async function POST() {
  const projectKey = process.env.SONIOX_API_KEY;
  if (!projectKey) return NextResponse.json({ available: false, reason: "speech_not_configured" }, { status: 503 });
  try {
    const { apiKey, expiresAt } = await mintTemporaryKey(projectKey);
    return NextResponse.json(
      { available: true, apiKey, expiresAt, model: SONIOX_RT_MODEL },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    log.error("stt token mint failed", { message: (err as Error).message });
    return NextResponse.json({ available: false, reason: "speech_unavailable" }, { status: 502 });
  }
}
