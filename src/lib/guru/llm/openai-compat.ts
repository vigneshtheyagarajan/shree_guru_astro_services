import {
  LlmError,
  type ChatMessage,
  type GenerateParams,
  type GenerateResult,
  type LlmProvider,
  type StructuredParams,
  type StructuredResult,
  type TokenUsage,
  type ToolCallPart,
} from "./types";

// One adapter for every provider that speaks the OpenAI-style
// /chat/completions API: Groq and Mistral (both with free tiers) today,
// and others later, by changing the base URL. Plain fetch, no SDK.

export interface OpenAICompatOptions {
  /** Short provider label used in logs and errors, e.g. "groq". */
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  /** Mistral only accepts tool-call ids of exactly 9 letters/digits; ids are rewritten per request. */
  shortToolIds?: boolean;
  /** Injectable for tests. */
  fetch?: typeof fetch;
  /** Extra JSON merged into every request body (provider-specific knobs). */
  extraBody?: Record<string, unknown>;
}

type WireToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
type WireMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: WireToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

interface WireResponse {
  choices?: { message?: { content?: unknown; tool_calls?: { id?: string; function?: { name?: string; arguments?: unknown } }[] }; finish_reason?: string | null }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

/** Neutral history -> OpenAI-style messages. */
export function toWireMessages(system: string, messages: ChatMessage[], shortToolIds = false): WireMessage[] {
  const ids = new Map<string, string>();
  const wireId = (id: string) => {
    if (!shortToolIds) return id;
    if (!ids.has(id)) ids.set(id, `tc${String(ids.size + 1).padStart(7, "0")}`);
    return ids.get(id)!;
  };

  const out: WireMessage[] = [{ role: "system", content: system }];
  for (const message of messages) {
    if (message.role === "assistant") {
      const text = message.parts.flatMap((p) => (p.type === "text" ? [p.text] : [])).join("");
      const calls: WireToolCall[] = message.parts.flatMap((p) =>
        p.type === "tool_call" ? [{ id: wireId(p.id), type: "function" as const, function: { name: p.name, arguments: JSON.stringify(p.args ?? {}) } }] : [],
      );
      out.push({ role: "assistant", content: text || null, ...(calls.length ? { tool_calls: calls } : {}) });
      continue;
    }
    // A "user" turn can carry tool results (one wire message each) and/or text.
    for (const part of message.parts) {
      if (part.type === "tool_result") {
        out.push({ role: "tool", tool_call_id: wireId(part.id), content: JSON.stringify(part.isError ? { error: part.result } : (part.result ?? null)) });
      }
    }
    const text = message.parts.flatMap((p) => (p.type === "text" ? [p.text] : [])).join("");
    if (text) out.push({ role: "user", content: text });
  }
  return out;
}

const FINISH: Record<string, GenerateResult["finishReason"]> = {
  stop: "stop",
  tool_calls: "tool_calls",
  length: "length",
  content_filter: "blocked",
};

/** Message content is a string, or on some providers a list of text chunks. */
function contentText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((c) => (typeof c === "string" ? c : typeof (c as { text?: unknown })?.text === "string" ? (c as { text: string }).text : "")).join("");
  }
  return "";
}

function toUsage(u: WireResponse["usage"]): TokenUsage {
  const input = u?.prompt_tokens ?? 0;
  const output = u?.completion_tokens ?? 0;
  return { inputTokens: input, outputTokens: output, totalTokens: u?.total_tokens ?? input + output };
}

/** "7m12.5s", "850ms", "30s" -> milliseconds (Groq puts these in error text). */
export function parseDuration(text: string): number | undefined {
  const m = text.match(/(?:(\d+)h)?\s*(?:(\d+)m(?!s))?\s*(?:(\d+(?:\.\d+)?)s)?\s*(?:(\d+(?:\.\d+)?)ms)?/);
  if (!m || !m[0].trim()) return undefined;
  const ms = Number(m[1] ?? 0) * 3_600_000 + Number(m[2] ?? 0) * 60_000 + Number(m[3] ?? 0) * 1000 + Number(m[4] ?? 0);
  return ms > 0 ? Math.round(ms) : undefined;
}

function stripJsonFence(text: string): string {
  const t = text.trim();
  const fenced = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : t;
}

export class OpenAICompatProvider implements LlmProvider {
  readonly name: string;
  readonly model: string;
  private readonly options: OpenAICompatOptions;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OpenAICompatOptions) {
    if (!options.apiKey) throw new LlmError(`${options.name} API key is not set.`, "auth");
    this.options = options;
    this.name = options.name;
    this.model = options.model;
    this.fetchImpl = options.fetch ?? fetch;
  }

  private async post(body: Record<string, unknown>, signal?: AbortSignal): Promise<WireResponse> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.options.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${this.options.apiKey}` },
        body: JSON.stringify({ model: this.model, ...this.options.extraBody, ...body }),
        signal,
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new LlmError(`${this.name} network error: ${String((error as Error)?.message ?? error).slice(0, 200)}`, "overloaded", error);
    }
    if (response.ok) return (await response.json()) as WireResponse;

    const detail = (await response.text().catch(() => "")).slice(0, 400);
    const retryHeader = Number(response.headers.get("retry-after"));
    const retryAfterMs = Number.isFinite(retryHeader) && retryHeader > 0 ? retryHeader * 1000 : parseDuration(detail.match(/try again in ([\dhms.\s]+)/i)?.[1] ?? "");
    const message = `${this.name} HTTP ${response.status}: ${detail}`;
    const status = response.status;
    if (status === 429) throw new LlmError(message, "rate_limited", detail, retryAfterMs);
    if (status === 401 || status === 403) throw new LlmError(message, "auth", detail);
    if (status === 400 || status === 404 || status === 413 || status === 422) throw new LlmError(message, "bad_request", detail);
    if (status >= 500 || status === 408) throw new LlmError(message, "overloaded", detail, retryAfterMs);
    throw new LlmError(message, "unknown", detail);
  }

  async generate(params: GenerateParams): Promise<GenerateResult> {
    const body: Record<string, unknown> = {
      messages: toWireMessages(params.system, params.messages, this.options.shortToolIds),
      ...(params.maxOutputTokens ? { max_tokens: params.maxOutputTokens } : {}),
      ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
      ...(params.tools?.length
        ? { tools: params.tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } })), tool_choice: "auto" }
        : {}),
    };
    const data = await this.post(body, params.signal);
    const choice = data.choices?.[0];
    if (!choice?.message) throw new LlmError(`${this.name} returned no message.`, "unknown", data);

    const toolCalls: ToolCallPart[] = [];
    for (const [i, call] of (choice.message.tool_calls ?? []).entries()) {
      const name = call.function?.name;
      if (!name) throw new LlmError(`${this.name} returned a tool call with no name.`, "bad_request", call);
      let args: Record<string, unknown> = {};
      const raw = call.function?.arguments;
      if (typeof raw === "string" && raw.trim()) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) args = parsed as Record<string, unknown>;
        } catch (error) {
          throw new LlmError(`${this.name} returned malformed tool arguments for ${name}.`, "bad_request", error);
        }
      } else if (raw && typeof raw === "object") {
        args = raw as Record<string, unknown>;
      }
      toolCalls.push({ type: "tool_call", id: call.id || `call_${i}_${name}`, name, args });
    }

    const text = contentText(choice.message.content);
    if (text) params.onText?.(text);
    const parts: ChatMessage["parts"] = [];
    if (text) parts.push({ type: "text", text });
    parts.push(...toolCalls);

    return {
      message: { role: "assistant", parts },
      text,
      toolCalls,
      finishReason: toolCalls.length > 0 ? "tool_calls" : (FINISH[choice.finish_reason ?? ""] ?? "other"),
      usage: toUsage(data.usage),
      model: this.model,
    };
  }

  async generateStructured(params: StructuredParams): Promise<StructuredResult> {
    // json_object mode is the common denominator; the schema is given in the prompt and the caller validates.
    const system = `${params.system}\n\nReply with a single JSON object and nothing else. It must satisfy this JSON Schema:\n${JSON.stringify(params.schema)}`;
    const data = await this.post(
      {
        messages: [
          { role: "system", content: system },
          { role: "user", content: params.prompt },
        ],
        response_format: { type: "json_object" },
        max_tokens: 1024,
        temperature: 0,
      },
      params.signal,
    );
    const choice = data.choices?.[0];
    if (choice?.finish_reason === "length") throw new LlmError(`${this.name} structured reply was cut off.`, "unknown");
    const text = stripJsonFence(contentText(choice?.message?.content));
    try {
      return { data: JSON.parse(text), usage: toUsage(data.usage), model: this.model };
    } catch (error) {
      throw new LlmError(`${this.name} returned text that was not valid JSON.`, "unknown", error);
    }
  }
}
