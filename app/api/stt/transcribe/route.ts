import { NextResponse } from "next/server";
import { log } from "@/lib/log";
import { TranscribeFailed, transcribe } from "@/lib/speech/transcribe";

export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024; // far above a 90-second recording
const LANGUAGE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

/**
 * POST /api/stt/transcribe (multipart: audio, language) → { text }.
 * Audio is passed straight through and never stored; text is not logged. Moves no money: the text still goes through
 * /api/understand, code validation and the person's own confirmation.
 */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  const language = form?.get("language");
  if (!(audio instanceof File) || typeof language !== "string" || !LANGUAGE.test(language)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  if (!audio.size || audio.size > MAX_BYTES) return NextResponse.json({ error: "invalid_request" }, { status: 413 });
  try {
    const text = await transcribe({ audio, fileName: audio.name, language });
    return NextResponse.json({ text });
  } catch (err) {
    const code = err instanceof TranscribeFailed ? err.code : "failed";
    log.warn("transcription failed", { code });
    return NextResponse.json({ error: code }, { status: code === "empty" ? 422 : 503 });
  }
}
