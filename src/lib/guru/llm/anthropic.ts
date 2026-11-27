import Anthropic from "@anthropic-ai/sdk";
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

// Claude adapter: the paid, production-quality option. It implements the same
// LlmProvider interface as the Gemini adapter, so switching is configuration.
// Retries (429/5xx) are handled by the SDK itself.

type Message = Anthropic.Message;
type MessageParam = Anthropic.MessageParam;

/** The slice of the SDK this adapter uses; lets tests inject a fake. */
export interface AnthropicClientLike {
  messages: {
    create(params: Record<string, unknown>, options?: { signal?: AbortSignal }): Promise<Message>;
    stream(
      params: Record<string, unknown>,
      options?: { signal?: AbortSignal },
    ): { on(event: "text", listener: (delta: string) => void): unknown; finalMessage(): Promise<Message> };
  };
}

export type AnthropicEffort = "low" | "medium" | "high" | "xhigh" | "max";

export interface AnthropicOptions {
  model: string;
  /** Client to use; defaults to a real one built from `apiKey` / ANTHROPIC_API_KEY. */
  client?: AnthropicClientLike;
  apiKey?: string;
  /** Reasoning depth (output_config.effort); omit for the model's default. */
  effort?: AnthropicEffort;
  /**
   * Thinking tokens count against max_tokens on Claude, so requests are
   * given at least this much room to avoid answers being cut short.
   */
  maxTokensFloor?: number;
}

function classifyError(error: unknown): LlmError {
  const status = (error as { status?: number })?.status;
  const message = String((error as Error)?.message ?? error).slice(0, 300);
  if (status === 429) return new LlmError(`Claude rate limit: ${message}`, "rate_limited", error);
  if (status === 529 || (status !== undefined && status >= 500)) return new LlmError(`Claude overloaded: ${message}`, "overloaded", error);
  if (status === 401 || status === 403) return new LlmError(`Claude auth error: ${message}`, "auth", error);
  if (status === 400 || status === 404) return new LlmError(`Claude rejected the request: ${message}`, "bad_request", error);
  return new LlmError(`Claude error: ${message}`, "unknown", error);
}

function toUsage(message: Message | undefined): TokenUsage {
  const u = message?.usage as { input_tokens?: number; output_tokens?: number; cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null } | undefined;
  const input = (u?.input_tokens ?? 0) + (u?.cache_creation_input_tokens ?? 0) + (u?.cache_read_input_tokens ?? 0);
  const output = u?.output_tokens ?? 0;
  return { inputTokens: input, outputTokens: output, totalTokens: input + output };
}

/** Neutral history -> Claude messages. */
export function toAnthropicMessages(messages: ChatMessage[]): MessageParam[] {
  return messages.map((message): MessageParam => {
    // Echo Claude's own turns exactly (thinking blocks included) so tool loops stay valid.
    if (message.role === "assistant" && message.providerRaw?.provider === "anthropic") {
      return { role: "assistant", content: message.providerRaw.data as MessageParam["content"] };
    }
    const content = message.parts.map((part) => {
      switch (part.type) {
        case "text":
          return { type: "text" as const, text: part.text };
        case "tool_call":
          return { type: "tool_use" as const, id: part.id, name: part.name, input: part.args };
        case "tool_result":
          return {
            type: "tool_result" as const,
            tool_use_id: part.id,
            content: JSON.stringify(part.result ?? null),
            ...(part.isError ? { is_error: true } : {}),
          };
      }
    });
    return { role: message.role, content } as MessageParam;
  });
}

const FINISH: Record<string, GenerateResult["finishReason"]> = {
  end_turn: "stop",
  stop_sequence: "stop",
  tool_use: "tool_calls",
  max_tokens: "length",
  refusal: "blocked",
};

export class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic";
  readonly model: string;
  private readonly client: AnthropicClientLike;
  private readonly effort?: AnthropicEffort;
  private readonly floor: number;

  constructor(options: AnthropicOptions) {
    this.model = options.model;
    this.effort = options.effort;
    this.floor = options.maxTokensFloor ?? 8192;
    this.client = options.client ?? (new Anthropic(options.apiKey ? { apiKey: options.apiKey } : undefined) as unknown as AnthropicClientLike);
  }

  async generate(params: GenerateParams): Promise<GenerateResult> {
    const request: Record<string, unknown> = {
      model: this.model,
      max_tokens: Math.max(params.maxOutputTokens ?? 0, this.floor),
      system: params.system,
      messages: toAnthropicMessages(params.messages),
      ...(params.tools?.length
        ? { tools: params.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })) }
        : {}),
      ...(this.effort ? { output_config: { effort: this.effort } } : {}),
    };
    const options = { signal: params.signal };

    let message: Message;
    try {
      if (params.onText) {
        const stream = this.client.messages.stream(request, options);
        stream.on("text", params.onText);
        message = await stream.finalMessage();
      } else {
        message = await this.client.messages.create(request, options);
      }
    } catch (error) {
      throw classifyError(error);
    }

    const toolCalls: ToolCallPart[] = [];
    let text = "";
    for (const block of message.content) {
      if (block.type === "text") text += block.text;
      else if (block.type === "tool_use") toolCalls.push({ type: "tool_call", id: block.id, name: block.name, args: (block.input ?? {}) as Record<string, unknown> });
    }

    const parts: ChatMessage["parts"] = [];
    if (text) parts.push({ type: "text", text });
    parts.push(...toolCalls);

    return {
      message: { role: "assistant", parts, providerRaw: { provider: "anthropic", data: message.content } },
      text,
      toolCalls,
      finishReason: FINISH[message.stop_reason ?? ""] ?? "other",
      usage: toUsage(message),
      model: this.model,
    };
  }

  async generateStructured(params: StructuredParams): Promise<StructuredResult> {
    let message: Message;
    try {
      message = await this.client.messages.create(
        {
          model: this.model,
          max_tokens: Math.max(2048, this.floor),
          system: params.system,
          messages: [{ role: "user", content: params.prompt }],
          output_config: { ...(this.effort ? { effort: this.effort } : {}), format: { type: "json_schema", schema: withNoExtraProperties(params.schema) } },
        },
        { signal: params.signal },
      );
    } catch (error) {
      throw classifyError(error);
    }
    if (message.stop_reason === "refusal") throw new LlmError("Claude declined to classify this message.", "blocked");
    if (message.stop_reason === "max_tokens") throw new LlmError("Claude's structured reply was cut off.", "unknown");

    const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    try {
      return { data: JSON.parse(text), usage: toUsage(message), model: this.model };
    } catch (error) {
      throw new LlmError("Claude returned text that was not valid JSON.", "unknown", error);
    }
  }
}

/** Claude's structured outputs require `additionalProperties: false` on every object. */
export function withNoExtraProperties(schema: Record<string, unknown>): Record<string, unknown> {
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node)) out[k] = walk(v);
      if (out.type === "object" && out.additionalProperties === undefined) out.additionalProperties = false;
      return out;
    }
    return node;
  };
  return walk(schema) as Record<string, unknown>;
}
