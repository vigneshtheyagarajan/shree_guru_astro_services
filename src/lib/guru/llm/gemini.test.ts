import { describe, expect, it, vi } from "vitest";
import type { GenerateContentResponse } from "@google/genai";
import { GeminiProvider, toGeminiContents, type GeminiClientLike } from "./gemini";
import { LlmError, type ChatMessage } from "./types";

const response = (parts: unknown[], extra: Record<string, unknown> = {}, finishReason = "STOP") =>
  ({
    candidates: [{ content: { role: "model", parts }, finishReason }],
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, thoughtsTokenCount: 3, totalTokenCount: 18 },
    ...extra,
  }) as unknown as GenerateContentResponse;

function provider(generateContent: GeminiClientLike["models"]["generateContent"], extra: Partial<ConstructorParameters<typeof GeminiProvider>[0]> = {}) {
  const sleep = vi.fn(async (_ms: number) => {});
  const client: GeminiClientLike = {
    models: {
      generateContent,
      generateContentStream: async () => {
        throw new Error("not used");
      },
    },
  };
  return { p: new GeminiProvider({ model: "test-model", client, sleep, ...extra }), sleep };
}

const user = (text: string): ChatMessage => ({ role: "user", parts: [{ type: "text", text }] });

describe("GeminiProvider.generate", () => {
  it("returns text, usage (thinking tokens counted as output) and a stop reason", async () => {
    const { p } = provider(async () => response([{ text: "Namaste." }]));
    const r = await p.generate({ system: "s", messages: [user("hi")] });
    expect(r.text).toBe("Namaste.");
    expect(r.finishReason).toBe("stop");
    expect(r.usage).toEqual({ inputTokens: 10, outputTokens: 8, totalTokens: 18 });
    expect(r.model).toBe("test-model");
    expect(r.message.parts).toEqual([{ type: "text", text: "Namaste." }]);
  });

  it("parses function calls and keeps the model's id", async () => {
    const { p } = provider(async () =>
      response([{ functionCall: { id: "call_1", name: "lookup", args: { query: "Madurai" } }, thoughtSignature: "SIG" }]),
    );
    const r = await p.generate({ system: "s", messages: [user("hi")] });
    expect(r.finishReason).toBe("tool_calls");
    expect(r.toolCalls).toEqual([{ type: "tool_call", id: "call_1", name: "lookup", args: { query: "Madurai" } }]);
  });

  it("never surfaces thought parts", async () => {
    const { p } = provider(async () => response([{ text: "secret reasoning", thought: true }, { text: "Visible." }]));
    const r = await p.generate({ system: "s", messages: [user("hi")] });
    expect(r.text).toBe("Visible.");
  });

  it("keeps the raw model parts (with thought signatures) for the next turn", async () => {
    const raw = [{ functionCall: { id: "c", name: "t", args: {} }, thoughtSignature: "SIG" }];
    const { p } = provider(async () => response(raw));
    const r = await p.generate({ system: "s", messages: [user("hi")] });
    expect(r.message.providerRaw).toEqual({ provider: "gemini", data: { role: "model", parts: raw } });
  });

  it("maps finish reasons: length, blocked (by finish reason and by prompt feedback)", async () => {
    expect((await provider(async () => response([{ text: "cut" }], {}, "MAX_TOKENS")).p.generate({ system: "s", messages: [user("x")] })).finishReason).toBe("length");
    expect((await provider(async () => response([], {}, "SAFETY")).p.generate({ system: "s", messages: [user("x")] })).finishReason).toBe("blocked");
    const noCandidates = { promptFeedback: { blockReason: "PROHIBITED_CONTENT" }, usageMetadata: {} } as unknown as GenerateContentResponse;
    expect((await provider(async () => noCandidates).p.generate({ system: "s", messages: [user("x")] })).finishReason).toBe("blocked");
  });

  it("sends system instruction, tools as JSON-schema declarations, and token cap", async () => {
    const spy = vi.fn(async (_args: unknown) => response([{ text: "ok" }]));
    const { p } = provider(spy);
    await p.generate({
      system: "be Guru",
      messages: [user("hi")],
      maxOutputTokens: 500,
      tools: [{ name: "lookup", description: "d", parameters: { type: "object", properties: { q: { type: "string" } } } }],
    });
    const args = spy.mock.calls[0][0] as { model: string; config: Record<string, unknown> };
    expect(args.model).toBe("test-model");
    expect(args.config.systemInstruction).toBe("be Guru");
    expect(args.config.maxOutputTokens).toBe(500);
    expect(args.config.tools).toEqual([{ functionDeclarations: [{ name: "lookup", description: "d", parametersJsonSchema: { type: "object", properties: { q: { type: "string" } } } }] }]);
  });
});

describe("history mapping", () => {
  it("maps text, tool calls and tool results", () => {
    const contents = toGeminiContents([
      user("hello"),
      { role: "assistant", parts: [{ type: "tool_call", id: "c1", name: "t", args: { a: 1 } }] },
      { role: "user", parts: [{ type: "tool_result", id: "c1", name: "t", result: { ok: true } }] },
      { role: "user", parts: [{ type: "tool_result", id: "c2", name: "t", result: "boom", isError: true }] },
    ]);
    expect(contents).toEqual([
      { role: "user", parts: [{ text: "hello" }] },
      { role: "model", parts: [{ functionCall: { id: "c1", name: "t", args: { a: 1 } }, thoughtSignature: "skip_thought_signature_validator" }] },
      { role: "user", parts: [{ functionResponse: { id: "c1", name: "t", response: { output: { ok: true } } } }] },
      { role: "user", parts: [{ functionResponse: { id: "c2", name: "t", response: { error: "boom" } } }] },
    ]);
  });

  it("echoes Gemini's own raw turn unchanged (so thought signatures survive)", () => {
    const rawContent = { role: "model", parts: [{ functionCall: { name: "t", args: {} }, thoughtSignature: "SIG" }] };
    const [content] = toGeminiContents([{ role: "assistant", parts: [], providerRaw: { provider: "gemini", data: rawContent } }]);
    expect(content).toBe(rawContent);
  });

  it("ignores raw data from a different provider", () => {
    const [content] = toGeminiContents([
      { role: "assistant", parts: [{ type: "text", text: "hi" }], providerRaw: { provider: "anthropic", data: { something: 1 } } },
    ]);
    expect(content).toEqual({ role: "model", parts: [{ text: "hi" }] });
  });
});

describe("streaming", () => {
  it("emits text deltas and returns the assembled turn with the latest cumulative usage", async () => {
    const chunks = [
      response([{ text: "Nam" }], { usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 1, totalTokenCount: 11 } }, undefined as unknown as string),
      response([{ text: "aste." }], { usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 3, thoughtsTokenCount: 2, totalTokenCount: 15 } }),
    ];
    const client: GeminiClientLike = {
      models: {
        generateContent: async () => {
          throw new Error("not used");
        },
        generateContentStream: async () =>
          (async function* () {
            for (const c of chunks) yield c;
          })(),
      },
    };
    const p = new GeminiProvider({ model: "m", client });
    const deltas: string[] = [];
    const r = await p.generate({ system: "s", messages: [user("hi")], onText: (d) => deltas.push(d) });
    expect(deltas).toEqual(["Nam", "aste."]);
    expect(r.text).toBe("Namaste.");
    expect(r.finishReason).toBe("stop");
    expect(r.usage).toEqual({ inputTokens: 10, outputTokens: 5, totalTokens: 15 });
  });
});

describe("errors and retries", () => {
  const httpError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status });

  it("retries rate limits and overload with exponential backoff, then succeeds", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(httpError(429))
      .mockRejectedValueOnce(httpError(503))
      .mockResolvedValueOnce(response([{ text: "finally" }]));
    const { p, sleep } = provider(fn);
    const r = await p.generate({ system: "s", messages: [user("x")] });
    expect(r.text).toBe("finally");
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([800, 1600]);
  });

  it("gives up after the retry budget with a typed error", async () => {
    const { p } = provider(vi.fn().mockRejectedValue(httpError(429)), { maxRetries: 2 });
    await expect(p.generate({ system: "s", messages: [user("x")] })).rejects.toMatchObject({ name: "LlmError", kind: "rate_limited" });
  });

  it("does not retry bad requests or auth failures", async () => {
    const bad = vi.fn().mockRejectedValue(httpError(400));
    await expect(provider(bad).p.generate({ system: "s", messages: [user("x")] })).rejects.toMatchObject({ kind: "bad_request" });
    expect(bad).toHaveBeenCalledTimes(1);
    const auth = vi.fn().mockRejectedValue(httpError(403));
    await expect(provider(auth).p.generate({ system: "s", messages: [user("x")] })).rejects.toMatchObject({ kind: "auth" });
    expect(auth).toHaveBeenCalledTimes(1);
  });

  it("refuses to start without an API key or injected client", () => {
    expect(() => new GeminiProvider({ model: "m" })).toThrow(LlmError);
  });
});

describe("generateStructured", () => {
  it("returns parsed JSON and asks the API for JSON output with the schema", async () => {
    const spy = vi.fn(async (_args: unknown) => ({ text: '{"kind":"question"}', usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 2, totalTokenCount: 6 } }) as unknown as GenerateContentResponse);
    const { p } = provider(spy);
    const r = await p.generateStructured({ system: "s", prompt: "p", schema: { type: "object" } });
    expect(r.data).toEqual({ kind: "question" });
    expect(r.usage.totalTokens).toBe(6);
    const config = (spy.mock.calls[0][0] as { config: Record<string, unknown> }).config;
    expect(config.responseMimeType).toBe("application/json");
    expect(config.responseJsonSchema).toEqual({ type: "object" });
    expect(config.temperature).toBe(0);
  });

  it("throws a typed error on invalid JSON", async () => {
    const { p } = provider(async () => ({ text: "not json" }) as unknown as GenerateContentResponse);
    await expect(p.generateStructured({ system: "s", prompt: "p", schema: {} })).rejects.toBeInstanceOf(LlmError);
  });
});

describe("GeminiProvider: quota errors", () => {
  const quotaError = (retryDelay: string) =>
    Object.assign(new Error(`{"error":{"code":429,"details":[{"@type":"type.googleapis.com/google.rpc.RetryInfo","retryDelay":"${retryDelay}"}]}}`), { status: 429 });

  it("does not wait on a quota that resets in hours, and reports the delay so another provider can take over", async () => {
    const generate = vi.fn(async () => {
      throw quotaError("10833s");
    });
    const { p, sleep } = provider(generate);
    await expect(p.generate({ system: "s", messages: [user("hi")] })).rejects.toMatchObject({ kind: "rate_limited", retryAfterMs: 10_833_000 });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("waits out a short provider-stated delay and retries", async () => {
    const generate = vi.fn().mockRejectedValueOnce(quotaError("7s")).mockResolvedValueOnce(response([{ text: "ok" }]));
    const { p, sleep } = provider(generate);
    expect((await p.generate({ system: "s", messages: [user("hi")] })).text).toBe("ok");
    expect(sleep).toHaveBeenCalledWith(7000);
  });

  it("signs only the first function call of a transferred turn", () => {
    const out = toGeminiContents([
      { role: "assistant", parts: [{ type: "tool_call", id: "a", name: "t", args: {} }, { type: "tool_call", id: "b", name: "u", args: {} }] },
    ]);
    const parts = out[0].parts as { thoughtSignature?: string }[];
    expect(parts[0].thoughtSignature).toBe("skip_thought_signature_validator");
    expect(parts[1].thoughtSignature).toBeUndefined();
  });
});
