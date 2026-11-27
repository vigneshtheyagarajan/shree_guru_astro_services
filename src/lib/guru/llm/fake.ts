import type { ChatMessage, GenerateParams, GenerateResult, LlmProvider, StructuredParams, StructuredResult, ToolCallPart } from "./types";

// A scripted stand-in for a real model, for tests and for running the
// conversation engine offline. It replays what it is told to and records
// what it was asked.

type GenerateStep = GenerateResult | Error | ((params: GenerateParams) => GenerateResult | Error);
type StructuredStep = unknown | Error | ((params: StructuredParams) => unknown | Error);

const usage = { inputTokens: 10, outputTokens: 5, totalTokens: 15 };

export function textReply(text: string): GenerateResult {
  const message: ChatMessage = { role: "assistant", parts: [{ type: "text", text }] };
  return { message, text, toolCalls: [], finishReason: "stop", usage, model: "scripted-1" };
}

export function toolReply(...calls: Array<{ name: string; args: Record<string, unknown> }>): GenerateResult {
  const toolCalls: ToolCallPart[] = calls.map((c, i) => ({ type: "tool_call", id: `call_${i}_${c.name}`, name: c.name, args: c.args }));
  return { message: { role: "assistant", parts: toolCalls }, text: "", toolCalls, finishReason: "tool_calls", usage, model: "scripted-1" };
}

export class ScriptedProvider implements LlmProvider {
  readonly name = "scripted";
  readonly model = "scripted-1";
  readonly generateCalls: GenerateParams[] = [];
  readonly structuredCalls: StructuredParams[] = [];

  constructor(
    private readonly generateSteps: GenerateStep[] = [],
    private readonly structuredSteps: StructuredStep[] | StructuredStep = [],
  ) {}

  async generate(params: GenerateParams): Promise<GenerateResult> {
    this.generateCalls.push(params);
    const step = this.generateSteps.shift();
    if (step === undefined) throw new Error("ScriptedProvider: no generate step left");
    const out = typeof step === "function" ? step(params) : step;
    if (out instanceof Error) throw out;
    return out;
  }

  async generateStructured(params: StructuredParams): Promise<StructuredResult> {
    this.structuredCalls.push(params);
    const steps = this.structuredSteps;
    const step = Array.isArray(steps) ? steps.shift() : steps;
    if (step === undefined) throw new Error("ScriptedProvider: no structured step left");
    const out = typeof step === "function" ? (step as (p: StructuredParams) => unknown)(params) : step;
    if (out instanceof Error) throw out;
    return { data: out, usage, model: "scripted-1" };
  }
}
