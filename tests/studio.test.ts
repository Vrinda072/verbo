import { describe, expect, it } from "vitest";
import type { DeskRow } from "@/lib/desk/queries";
import { evidenceBand, stalledCases, summariseCases, toStudioRows } from "@/lib/desk/studio";
import { toChatBody, toChatMessages, verboAdapter } from "@/lib/desk/studioAdapter";

const row = (over: Partial<DeskRow>): DeskRow => ({
  id: "case_1", shortId: "ABC", simulated: true, state: "LINK_SENT", cents: 1234, senderName: "S", senderLanguage: "hi", recipientName: "R",
  recipientLanguage: "pt", riskLevel: "high", openedAt: "", updatedAt: "", ageHours: 72, lastEvent: null, remindersSent: 0, messages: 2, evidence: 85, everReturned: false, ...over,
});

describe("Case Desk data for AG Studio", () => {
  it("labels simulated rows, converts money and carries no personal names", () => {
    const [r] = toStudioRows([row({})]);
    expect(r.dataset).toBe("Simulated");
    expect(r.amountUsd).toBe(12.34);
    expect(r.recipientLanguage).toBe("Portuguese");
    expect(r.risk).toBe("High");
    expect(JSON.stringify(r)).not.toMatch(/"R"|"S"/);
    expect(toStudioRows([row({ simulated: false })])[0].dataset).toBe("Live sandbox");
  });

  it("counts each case in the right buckets", () => {
    const [open, returned, escalated, refused] = toStudioRows([
      row({ state: "VIEWED" }),
      row({ state: "RETURNED", everReturned: true }),
      row({ state: "ESCALATED" }),
      row({ state: "REFUSED" }),
    ]);
    expect([open.open, open.resolved, open.outcome]).toEqual([1, 0, "Open"]);
    expect([returned.returned, returned.resolved, returned.outcome]).toEqual([1, 1, "Returned"]);
    expect([escalated.escalated, escalated.outcome]).toEqual([1, "Escalated"]);
    expect([refused.resolved, refused.outcome]).toEqual([1, "Refused"]);
  });

  it("keeps the evidence band boundaries", () => {
    expect([evidenceBand(80), evidenceBand(79), evidenceBand(50), evidenceBand(49)]).toEqual(["Ready (80+)", "Partial (50–79)", "Partial (50–79)", "Weak (under 50)"]);
  });

  it("finds only old, open, unreminded cases, oldest first", () => {
    const rows = toStudioRows([
      row({ shortId: "NEW", ageHours: 10 }),
      row({ shortId: "OLD", ageHours: 100 }),
      row({ shortId: "OLDER", ageHours: 200 }),
      row({ shortId: "NUDGED", ageHours: 100, remindersSent: 1 }),
      row({ shortId: "DONE", ageHours: 100, state: "RETURNED", everReturned: true }),
    ]);
    expect(stalledCases(rows).map((r) => r.caseId)).toEqual(["OLDER", "OLD"]);
    expect(stalledCases(rows, 150).map((r) => r.caseId)).toEqual(["OLDER"]);
  });
});

describe("case summary for the agent", () => {
  const rows = toStudioRows([
    row({ state: "RETURNED", everReturned: true, recipientLanguage: "pt" }),
    row({ state: "REFUSED", recipientLanguage: "pt" }),
    row({ state: "VIEWED", recipientLanguage: "hi" }),
    row({ state: "RETURNED", everReturned: true, recipientLanguage: "hi", simulated: false }),
  ]);

  it("calculates totals and rates, and says when simulated cases are included", () => {
    const all = summariseCases(rows);
    expect(all.dataset).toContain("simulated");
    expect([all.cases, all.open, all.resolved, all.returned]).toEqual([4, 1, 3, 2]);
    expect(all.returnRatePercent).toBe(67);
  });

  it("limits to one data set and gives each language its own rate", () => {
    const sim = summariseCases(rows, "Simulated");
    expect(sim.cases).toBe(3);
    expect(sim.byLanguage.find((l) => l.language === "Portuguese")?.returnRatePercent).toBe(50);
    expect(sim.byLanguage.find((l) => l.language === "Hindi")?.returnRatePercent).toBeNull();
    expect(summariseCases(rows, "Live sandbox").cases).toBe(1);
  });
});

describe("agent adapter", () => {
  const call = (callId: string, name = "view_schema") => ({ id: `i-${callId}`, kind: "output", type: "function_call", callId, name, arguments: "{}" });
  const input = [
    { id: "1", kind: "input", type: "message", role: "user", status: "completed", content: [{ type: "text", text: "How many?" }] },
    call("a"),
    call("b", "execute_query"),
    { type: "function_call_output", callId: "a", output: "A", status: "completed" },
    { type: "function_call_output", callId: "b", output: "B", status: "completed" },
    { id: "2", kind: "output", type: "reasoning", content: [] },
  ] as never;

  it("passes unsigned calls, such as Studio's own, as plain context", () => {
    const msgs = toChatMessages({ input, instructions: "Be plain." });
    expect(msgs.map((m) => m.role)).toEqual(["system", "user", "user", "user"]);
    expect(msgs[2].content).toBe("Result of view_schema:\nA");
    expect(msgs[3].content).toBe("Result of execute_query:\nB");
  });

  it("repairs malformed arguments from an earlier turn", () => {
    const bad = [{ id: "i", kind: "output", type: "function_call", callId: "a", name: "n", arguments: '{"a":' }] as never;
    const msgs = toChatMessages({ input: bad }, new Map([["a", {}]]));
    expect(msgs[0].tool_calls?.[0].function.arguments).toBe("{}");
  });

  it("groups a turn's calls, answers each one, drops reasoning and restores provider data", () => {
    const msgs = toChatMessages({ input, instructions: "Be plain." }, new Map([["a", { google: { thought_signature: "sig" } }]]));
    expect(msgs.map((m) => m.role)).toEqual(["system", "user", "assistant", "tool", "tool"]);
    expect(msgs[2].tool_calls?.map((c) => c.id)).toEqual(["a", "b"]);
    expect(msgs[2].tool_calls?.[0].extra_content).toEqual({ google: { thought_signature: "sig" } });
    expect(msgs[3]).toMatchObject({ tool_call_id: "a", content: "A" });
  });

  it("maps tools and a forced tool choice", () => {
    const body = toChatBody({ input: [], tools: [{ name: "t", description: "d", parameters: {} }], toolChoice: { name: "t" }, responseFormat: { type: "text" } } as never);
    expect(body.tools?.[0]).toEqual({ type: "function", function: { name: "t", description: "d", parameters: {} } });
    expect(body.tool_choice).toEqual({ type: "function", function: { name: "t" } });
    expect(body.response_format).toBeUndefined();
  });

  const run = async (fetcher: typeof fetch, req: object = { input: [], responseFormat: { type: "text" } }) => {
    const handler = verboAdapter("/x", fetcher).executeTurn(req as never, {} as never);
    const events: { type: string }[] = [];
    for await (const e of handler.stream as AsyncIterable<{ type: string }>) events.push(e);
    return { events, done: await handler.complete };
  };

  it("replays an answer as text and tool events, and reports it as complete", async () => {
    const message = { role: "assistant", content: "Hi", tool_calls: [{ id: "c1", type: "function", function: { name: "n", arguments: '{"a":1}' } }] };
    const { events, done } = await run((async () => new Response(JSON.stringify({ message, model: "m" }))) as never);
    expect(events.map((e) => e.type)).toEqual(["TEXT_MESSAGE_START", "TEXT_MESSAGE_CONTENT", "TEXT_MESSAGE_END", "TOOL_CALL_START", "TOOL_CALL_ARGS", "TOOL_CALL_END"]);
    expect(done.status).toBe("completed");
    expect(done.output.map((o) => o.type)).toEqual(["message", "function_call"]);
  });

  it("sends a provider's tool-call data back on the next turn", async () => {
    const extra = { google: { thought_signature: "sig" } };
    const bodies: { messages: { tool_calls?: { extra_content?: unknown }[] }[] }[] = [];
    const fetcher = (async (_u: string, init: RequestInit) => {
      bodies.push(JSON.parse(init.body as string));
      return new Response(JSON.stringify({ message: { role: "assistant", content: null, tool_calls: [{ id: "c1", type: "function", function: { name: "n", arguments: "{}" }, extra_content: extra }] } }));
    }) as never;
    const adapter = verboAdapter("/x", fetcher);
    await adapter.executeTurn({ input: [], responseFormat: { type: "text" } } as never, {} as never).complete;
    const next = [{ id: "i", kind: "output", type: "function_call", callId: "c1", name: "n", arguments: "{}" }];
    await adapter.executeTurn({ input: next, responseFormat: { type: "text" } } as never, {} as never).complete;
    expect(bodies[1].messages[0].tool_calls?.[0].extra_content).toEqual(extra);
  });

  it("reports failures on `complete`, with no stream events, as the docs require", async () => {
    const { events, done } = await run((async () => new Response(JSON.stringify({ error: "busy" }), { status: 503 })) as never);
    expect(events).toEqual([]);
    expect(done.status).toBe("failed");
    expect(done.error?.message).toContain("busy");
  });
});
