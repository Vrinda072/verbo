import { NextResponse } from "next/server";
import { z } from "zod";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * One turn for the Case Desk agent, so API keys stay on the server. Both providers take OpenAI-style chat completions with
 * tools (Gemini: generativelanguage.googleapis.com/v1beta/openai; Groq: api.groq.com/openai/v1; both exercised with tool
 * calls on Nov 7, 2026). The model is chosen here, never by the browser. Nothing in this route can reach PayPal: it returns
 * the model's answer, and the only tools it can ask for are the dashboard tools the page offers.
 */
const TARGETS = () => [
  { url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", key: process.env.GEMINI_API_KEY, model: "gemini-3.5-flash-lite" },
  { url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", key: process.env.GEMINI_API_KEY, model: "gemini-3.1-flash-lite" },
  { url: "https://api.groq.com/openai/v1/chat/completions", key: process.env.GROQ_API_KEY, model: "openai/gpt-oss-120b" },
];

const Body = z.object({
  messages: z.array(z.record(z.string(), z.unknown())).min(1).max(200),
  tools: z.array(z.record(z.string(), z.unknown())).max(100).optional(),
  tool_choice: z.unknown().optional(),
  response_format: z.unknown().optional(),
});

const MAX_BYTES = 2_000_000;
const PER_MINUTE = 60;
const g = globalThis as unknown as { __verboAgentCalls?: number[] };

/** Free quotas are shared, so a public page can't be allowed to spend them freely. */
function overLimit(now = Date.now()): boolean {
  const recent = (g.__verboAgentCalls ?? []).filter((t) => now - t < 60_000);
  g.__verboAgentCalls = recent;
  if (recent.length >= PER_MINUTE) return true;
  recent.push(now);
  return false;
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > MAX_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });
  let json: unknown = null;
  try {
    json = JSON.parse(raw);
  } catch {
    // handled by the schema check below
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  if (overLimit()) return NextResponse.json({ error: "busy" }, { status: 429 });

  const targets = TARGETS().filter((t) => t.key);
  if (!targets.length) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  for (const t of targets) {
    try {
      const res = await fetch(t.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${t.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: t.model, temperature: 0.2, ...parsed.data }),
        signal: AbortSignal.timeout(45_000),
      });
      if (res.status === 429 || res.status === 413 || res.status >= 500) {
        log.warn("desk agent: trying next model", { model: t.model, status: res.status });
        continue;
      }
      if (!res.ok) {
        // Another provider may accept what this one refused. The provider's reason is logged, never the conversation.
        const detail = (await res.json().catch(() => ({}))) as { error?: { message?: string }; [0]?: { error?: { message?: string } } };
        log.warn("desk agent: request refused", { model: t.model, status: res.status, reason: (detail.error?.message ?? detail[0]?.error?.message ?? "").slice(0, 200) });
        continue;
      }
      const body = (await res.json()) as { choices?: { message?: unknown }[] };
      const message = body.choices?.[0]?.message;
      if (message) return NextResponse.json({ message, model: t.model });
    } catch {
      log.warn("desk agent: request failed", { model: t.model });
    }
  }
  return NextResponse.json({ error: "busy" }, { status: 503 });
}
