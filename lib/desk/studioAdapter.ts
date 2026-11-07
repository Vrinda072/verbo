/**
 * Connects AG Studio's agents to our server route. AG Studio ships no model connection; an adapter is what we supply.
 * Source: AG Studio 3.1.0 Direct LLM Runner docs and types AgLlmRequest, AgLlmResponse, AgLlmResponseHandler, AgAiEvent
 * (read Nov 7, 2026). Tool calls are only relayed here; Studio executes them, and none of its tools can touch money.
 */
import type { AgLlmAdapter, AgLlmRequest, AgLlmResponse } from "ag-studio";

export interface ChatToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
  /** Provider data that must be sent back with the call. Gemini keeps its thought signature here. */
  extra_content?: unknown;
}
export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ChatToolCall[];
  tool_call_id?: string;
}

const textOf = (content: { type: string; text?: string }[]) =>
  content.flatMap((c) => (c.type === "text" && c.text ? [c.text] : [])).join("\n");

const validJson = (text: string) => {
  try {
    JSON.parse(text);
    return text;
  } catch {
    return "{}"; // providers refuse a whole turn over malformed arguments from an earlier one
  }
};

/**
 * Studio's conversation → OpenAI-style chat messages. `extras` restores provider data per tool call.
 * Gemini 3 refuses a function call without its thought signature (seen live, Nov 7, 2026), and only the first call of a
 * parallel group carries one. Calls with none, such as those Studio makes itself, are passed as plain context instead.
 */
export function toChatMessages(request: Pick<AgLlmRequest, "input" | "instructions">, extras: ReadonlyMap<string, unknown> = new Map()): ChatMessage[] {
  const out: ChatMessage[] = request.instructions ? [{ role: "system", content: request.instructions }] : [];
  const asContext = new Map<string, string>();
  let groupSigned = false;
  let previousType = "";
  for (const item of request.input) {
    if (item.type === "message") {
      out.push({ role: item.role, content: textOf(item.content as { type: string; text?: string }[]) });
    } else if (item.type === "function_call") {
      if (previousType !== "function_call") groupSigned = extras.has(item.callId);
      if (!groupSigned) {
        asContext.set(item.callId, item.name);
      } else {
        const call: ChatToolCall = { id: item.callId, type: "function", function: { name: item.name, arguments: validJson(item.arguments || "{}") } };
        const extra = extras.get(item.callId);
        if (extra) call.extra_content = extra;
        // Calls made in one turn belong to one assistant message.
        const last = out[out.length - 1];
        if (last?.role === "assistant" && last.tool_calls) last.tool_calls.push(call);
        else out.push({ role: "assistant", content: null, tool_calls: [call] });
      }
    } else if (item.type === "function_call_output") {
      const name = asContext.get(item.callId);
      if (name) out.push({ role: "user", content: `Result of ${name}:\n${item.output}` });
      else out.push({ role: "tool", tool_call_id: item.callId, content: item.output });
    }
    previousType = item.type;
  }
  return out;
}

export function toChatBody(request: AgLlmRequest, extras?: ReadonlyMap<string, unknown>) {
  const choice = request.toolChoice;
  return {
    messages: toChatMessages(request, extras),
    tools: request.tools?.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } })),
    tool_choice: !request.tools?.length ? undefined : typeof choice === "object" ? { type: "function", function: { name: choice.name } } : choice,
    response_format:
      request.responseFormat?.type === "json"
        ? { type: "json_schema", json_schema: { name: request.responseFormat.name, schema: request.responseFormat.schema } }
        : undefined,
  };
}

let counter = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now()}-${++counter}`;

/** Asks `endpoint` for one turn, then replays the answer as Studio's stream events. */
export function verboAdapter(endpoint = "/api/desk/agent", fetcher: typeof fetch = (...a) => fetch(...a)): AgLlmAdapter {
  const extras = new Map<string, unknown>();
  return {
    executeTurn(request, options) {
      const answer = (async () => {
        const res = await fetcher(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(toChatBody(request, extras)),
          signal: options?.signal,
        });
        const body = (await res.json().catch(() => ({}))) as { message?: ChatMessage; error?: string; model?: string };
        if (!res.ok || !body.message) throw new Error(body.error === "busy" ? "The AI service is busy. Please try again in a moment." : "The AI service is unavailable.");
        return { message: body.message, model: body.model };
      })();

      const complete: Promise<AgLlmResponse> = answer.then(
        ({ message, model }) => {
          const output: AgLlmResponse["output"] = [];
          if (message.content) {
            output.push({ id: nextId("msg"), kind: "output", type: "message", role: "assistant", status: "completed", content: [{ type: "text", text: message.content, annotations: [] }] });
          }
          for (const call of message.tool_calls ?? []) {
            if (call.extra_content) extras.set(call.id, call.extra_content);
            output.push({ id: nextId("call"), kind: "output", type: "function_call", callId: call.id, name: call.function.name, arguments: call.function.arguments, status: "completed" });
          }
          return { id: nextId("resp"), createdAt: Date.now(), status: "completed", output, model };
        },
        (err: Error) => ({ id: nextId("resp"), createdAt: Date.now(), status: "failed", output: [], error: { code: "unavailable", message: err.message } }) as AgLlmResponse,
      );

      async function* events() {
        let message: ChatMessage;
        try {
          ({ message } = await answer);
        } catch {
          return; // reported through `complete`, as the docs require
        }
        if (message.content) {
          const messageId = nextId("msg");
          yield { type: "TEXT_MESSAGE_START", messageId, role: "assistant" };
          yield { type: "TEXT_MESSAGE_CONTENT", messageId, delta: message.content };
          yield { type: "TEXT_MESSAGE_END", messageId };
        }
        for (const call of message.tool_calls ?? []) {
          yield { type: "TOOL_CALL_START", toolCallId: call.id, toolCallName: call.function.name };
          yield { type: "TOOL_CALL_ARGS", toolCallId: call.id, delta: call.function.arguments };
          yield { type: "TOOL_CALL_END", toolCallId: call.id };
        }
      }

      return { stream: events() as never, complete };
    },
  };
}
