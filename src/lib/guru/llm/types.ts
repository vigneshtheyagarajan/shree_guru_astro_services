// Provider-neutral model layer. The conversation engine only ever talks to
// these types, so the underlying model (Gemini free tier for development,
// Claude for production, anything else later) can be swapped by
// configuration without touching conversation logic.

export interface TextPart {
  type: "text";
  text: string;
}
export interface ToolCallPart {
  type: "tool_call";
  id: string;
  name: string;
  args: Record<string, unknown>;
}
export interface ToolResultPart {
  type: "tool_result";
  /** Id of the tool_call this answers. */
  id: string;
  name: string;
  result: unknown;
  isError?: boolean;
}
export type Part = TextPart | ToolCallPart | ToolResultPart;

export interface ChatMessage {
  /** Tool results travel in a "user" message, as in most provider APIs. */
  role: "user" | "assistant";
  parts: Part[];
  /**
   * Opaque provider data that must be echoed back on the next turn (e.g.
   * Gemini's thought signatures, which its API requires alongside function
   * calls). Only the provider that produced it reads it.
   */
  providerRaw?: { provider: string; data: unknown };
}

export interface ToolDeclaration {
  name: string;
  description: string;
  /** JSON Schema (object) for the arguments. */
  parameters: Record<string, unknown>;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface GenerateParams {
  system: string;
  messages: ChatMessage[];
  tools?: ToolDeclaration[];
  maxOutputTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  /** Called with text as it is generated (for streaming to a UI). */
  onText?: (delta: string) => void;
}

export interface GenerateResult {
  /** The assistant turn, ready to append to the history. */
  message: ChatMessage;
  text: string;
  toolCalls: ToolCallPart[];
  finishReason: "stop" | "tool_calls" | "length" | "blocked" | "other";
  usage: TokenUsage;
  model: string;
}

export interface StructuredParams {
  system: string;
  prompt: string;
  /** JSON Schema the output must satisfy. */
  schema: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface StructuredResult {
  /** Parsed JSON; the caller must still validate it. */
  data: unknown;
  usage: TokenUsage;
  model: string;
}

export interface LlmProvider {
  readonly name: string;
  readonly model: string;
  generate(params: GenerateParams): Promise<GenerateResult>;
  generateStructured(params: StructuredParams): Promise<StructuredResult>;
}

/** Raised for provider failures the caller may want to retry or surface. */
export class LlmError extends Error {
  constructor(
    message: string,
    readonly kind: "rate_limited" | "overloaded" | "auth" | "bad_request" | "blocked" | "unknown",
    readonly cause?: unknown,
    /** How long the provider says to wait before trying again, when it says. */
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "LlmError";
  }
}

export const ZERO_USAGE: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

export function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    totalTokens: a.totalTokens + b.totalTokens,
  };
}
