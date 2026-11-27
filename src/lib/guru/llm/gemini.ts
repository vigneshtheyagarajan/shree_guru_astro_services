import { GoogleGenAI, ThinkingLevel, type Content, type GenerateContentResponse, type Part as GeminiPart } from "@google/genai";
import {
  LlmError,
  type ChatMessage,
  type GenerateParams,
  type GenerateResult,
  type LlmProvider,
  type Part,
  type StructuredParams,
  type StructuredResult,
  type TokenUsage,
  type ToolCallPart,
} from "./types";

/** The slice of the SDK this adapter uses; lets tests inject a fake. */
export interface GeminiClientLike {
  models: {
    generateContent(args: unknown): Promise<GenerateContentResponse>;
    generateContentStream(args: unknown): Promise<AsyncIterable<GenerateContentResponse>>;
  };
}

export type GeminiThinking = "minimal" | "low" | "medium" | "high";

export interface GeminiOptions {
  apiKey?: string;
  model: string;
  client?: GeminiClientLike;
  /** Optional reasoning depth; omit to use the model's default. */
  thinking?: GeminiThinking;
  /** Retries for 429/503 (default 3, with exponential backoff). */
  maxRetries?: number;
  /** Injectable for tests. */
  sleep?: (ms: number) => Promise<void>;
}

const THINKING_LEVELS: Record<GeminiThinking, ThinkingLevel> = {
  minimal: ThinkingLevel.MINIMAL,
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
};

/** Longest a retry will wait for a provider-stated delay; longer means "use another provider". */
const MAX_INLINE_WAIT_MS = 20_000;

/** Gemini 3 insists on a thought signature for function calls; ones another model made have none. */
export const FOREIGN_THOUGHT_SIGNATURE = "skip_thought_signature_validator";

const BLOCKED_REASONS = new Set(["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION", "LANGUAGE"]);

/** Gemini reports how long to wait as `"retryDelay":"10833s"` in the error body. */
function retryDelayMs(message: string): number | undefined {
  const m = message.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  return m ? Math.round(Number(m[1]) * 1000) : undefined;
}

function classifyError(error: unknown): LlmError {
  const status = (error as { status?: number })?.status;
  const full = String((error as Error)?.message ?? error);
  const message = full.slice(0, 300);
  if (status === 429) return new LlmError(`Gemini rate limit: ${message}`, "rate_limited", error, retryDelayMs(full));
  if (status === 500 || status === 503 || status === 504) return new LlmError(`Gemini overloaded: ${message}`, "overloaded", error);
  if (status === 401 || status === 403) return new LlmError(`Gemini auth error: ${message}`, "auth", error);
  if (status === 400 || status === 404) return new LlmError(`Gemini rejected the request: ${message}`, "bad_request", error);
  return new LlmError(`Gemini error: ${message}`, "unknown", error);
}

function toUsage(response: GenerateContentResponse | undefined): TokenUsage {
  const u = response?.usageMetadata;
  const input = u?.promptTokenCount ?? 0;
  // Thinking tokens are billed as output, so count them there.
  const output = (u?.candidatesTokenCount ?? 0) + (u?.thoughtsTokenCount ?? 0);
  return { inputTokens: input, outputTokens: output, totalTokens: u?.totalTokenCount ?? input + output };
}

/** Neutral history -> Gemini contents. */
export function toGeminiContents(messages: ChatMessage[]): Content[] {
  return messages.map((message): Content => {
    if (message.role === "assistant" && message.providerRaw?.provider === "gemini") {
      return message.providerRaw.data as Content;
    }
    let signed = false;
    const parts: GeminiPart[] = message.parts.map((part): GeminiPart => {
      switch (part.type) {
        case "text":
          return { text: part.text };
        case "tool_call": {
          // Only the first function call of a turn carries the signature.
          const signature = signed ? {} : { thoughtSignature: FOREIGN_THOUGHT_SIGNATURE };
          signed = true;
          return { functionCall: { id: part.id, name: part.name, args: part.args }, ...signature };
        }
        case "tool_result":
          return {
            functionResponse: {
              id: part.id,
              name: part.name,
              response: part.isError ? { error: part.result } : { output: part.result },
            },
          };
      }
    });
    return { role: message.role === "assistant" ? "model" : "user", parts };
  });
}

export class GeminiProvider implements LlmProvider {
  readonly name = "gemini";
  readonly model: string;
  private readonly client: GeminiClientLike;
  private readonly thinking?: GeminiThinking;
  private readonly maxRetries: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(options: GeminiOptions) {
    this.model = options.model;
    this.thinking = options.thinking;
    this.maxRetries = options.maxRetries ?? 3;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    if (options.client) {
      this.client = options.client;
    } else {
      if (!options.apiKey) throw new LlmError("GEMINI_API_KEY is not set.", "auth");
      this.client = new GoogleGenAI({ apiKey: options.apiKey }) as unknown as GeminiClientLike;
    }
  }

  private async withRetry<T>(fn: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    let attempt = 0;
    for (;;) {
      try {
        return await fn();
      } catch (raw) {
        const error = raw instanceof LlmError ? raw : classifyError(raw);
        const retryable = error.kind === "rate_limited" || error.kind === "overloaded";
        if (!retryable || attempt >= this.maxRetries || signal?.aborted) throw error;
        // A quota that resets in minutes or hours (e.g. the daily limit) will not clear by waiting here.
        if (error.retryAfterMs !== undefined && error.retryAfterMs > MAX_INLINE_WAIT_MS) throw error;
        await this.sleep(Math.max(800 * 2 ** attempt, error.retryAfterMs ?? 0));
        attempt++;
      }
    }
  }

  private thinkingConfig() {
    return this.thinking ? { thinkingConfig: { thinkingLevel: THINKING_LEVELS[this.thinking] } } : {};
  }

  async generate(params: GenerateParams): Promise<GenerateResult> {
    const args = {
      model: this.model,
      contents: toGeminiContents(params.messages),
      config: {
        systemInstruction: params.system,
        maxOutputTokens: params.maxOutputTokens,
        temperature: params.temperature,
        abortSignal: params.signal,
        ...this.thinkingConfig(),
        ...(params.tools?.length
          ? {
              tools: [
                {
                  functionDeclarations: params.tools.map((t) => ({
                    name: t.name,
                    description: t.description,
                    parametersJsonSchema: t.parameters,
                  })),
                },
              ],
            }
          : {}),
      },
    };

    // Collect every response chunk (a single one when not streaming).
    const collect = async (): Promise<GenerateContentResponse[]> => {
      if (!params.onText) return [await this.client.models.generateContent(args)];
      const chunks: GenerateContentResponse[] = [];
      const stream = await this.client.models.generateContentStream(args);
      for await (const chunk of stream) {
        chunks.push(chunk);
        for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
          if (part.text && !part.thought) params.onText(part.text);
        }
      }
      return chunks;
    };

    const chunks = await this.withRetry(collect, params.signal);
    const last = chunks[chunks.length - 1];

    const rawParts: GeminiPart[] = chunks.flatMap((c) => c.candidates?.[0]?.content?.parts ?? []);
    const finish = chunks.map((c) => c.candidates?.[0]?.finishReason).filter(Boolean).pop() as string | undefined;
    const blockReason = chunks.find((c) => c.promptFeedback?.blockReason)?.promptFeedback?.blockReason;

    const parts: Part[] = [];
    const toolCalls: ToolCallPart[] = [];
    let text = "";
    let callIndex = 0;
    for (const part of rawParts) {
      if (part.thought) continue; // never surface reasoning
      if (part.text) {
        text += part.text;
        const prev = parts[parts.length - 1];
        if (prev?.type === "text") prev.text += part.text;
        else parts.push({ type: "text", text: part.text });
      } else if (part.functionCall?.name) {
        const call: ToolCallPart = {
          type: "tool_call",
          id: part.functionCall.id ?? `call_${Date.now()}_${callIndex++}`,
          name: part.functionCall.name,
          args: (part.functionCall.args ?? {}) as Record<string, unknown>,
        };
        toolCalls.push(call);
        parts.push(call);
      }
    }

    let finishReason: GenerateResult["finishReason"] = "other";
    if (blockReason || (finish && BLOCKED_REASONS.has(finish))) finishReason = "blocked";
    else if (toolCalls.length) finishReason = "tool_calls";
    else if (finish === "MAX_TOKENS") finishReason = "length";
    else if (finish === "STOP" || (!finish && text)) finishReason = "stop";

    return {
      message: {
        role: "assistant",
        parts,
        // Echo the untouched model parts next turn so thought signatures survive.
        providerRaw: { provider: "gemini", data: { role: "model", parts: rawParts } satisfies Content },
      },
      text,
      toolCalls,
      finishReason,
      usage: chunks.reduce((acc, c) => {
        const u = toUsage(c);
        // Streaming reports cumulative usage on every chunk; keep the latest.
        return u.totalTokens >= acc.totalTokens ? u : acc;
      }, toUsage(last)),
      model: this.model,
    };
  }

  async generateStructured(params: StructuredParams): Promise<StructuredResult> {
    const response = await this.withRetry(
      () =>
        this.client.models.generateContent({
          model: this.model,
          contents: [{ role: "user", parts: [{ text: params.prompt }] }],
          config: {
            systemInstruction: params.system,
            responseMimeType: "application/json",
            responseJsonSchema: params.schema,
            abortSignal: params.signal,
            temperature: 0,
            ...this.thinkingConfig(),
          },
        }),
      params.signal,
    );
    const raw = response.text ?? "";
    try {
      return { data: JSON.parse(raw), usage: toUsage(response), model: this.model };
    } catch (error) {
      throw new LlmError(`Gemini returned invalid JSON: ${raw.slice(0, 120)}`, "unknown", error);
    }
  }
}
