import { describe, expect, it, vi } from "vitest";
import { AnthropicProvider, toAnthropicMessages, withNoExtraProperties, type AnthropicClientLike } from "./anthropic";
import { LlmError, type ChatMessage } from "./types";

const usage = { input_tokens: 100, output_tokens: 40, cache_read_input_tokens: 20, cache_creation_input_tokens: 0 };
const msg = (content: unknown[], stop_reason = "end_turn") => ({ content, stop_reason, usage }) as never;

function fakeClient(create: (p: Record<string, unknown>) => unknown): AnthropicClientLike & { create: ReturnType<typeof vi.fn> } {
  const fn = vi.fn(async (p: Record<string, unknown>) => {
    const r = create(p);
    if (r instanceof Error) throw r;
    return r as never;
  });
  return {
    create: fn,
    messages: {
      create: fn,
      stream: (p) => ({
        on(_e, listener) {
          listener("Hel");
          listener("lo");
        },
        finalMessage: () => fn(p),
      }),
    },
  };
}

describe("toAnthropicMessages", () => {
  it("maps text, tool calls and tool results", () => {
    const history: ChatMessage[] = [
      { role: "user", parts: [{ type: "text", text: "hi" }] },
      { role: "assistant", parts: [{ type: "tool_call", id: "t1", name: "get_transits", args: { a: 1 } }] },
      { role: "user", parts: [{ type: "tool_result", id: "t1", name: "get_transits", result: { ok: true }, isError: true }] },
    ];
    expect(toAnthropicMessages(history)).toEqual([
      { role: "user", content: [{ type: "text", text: "hi" }] },
      { role: "assistant", content: [{ type: "tool_use", id: "t1", name: "get_transits", input: { a: 1 } }] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: '{"ok":true}', is_error: true }] },
    ]);
  });

  it("echoes Claude's own turns verbatim (thinking blocks included)", () => {
    const raw = [{ type: "thinking", thinking: "", signature: "sig" }, { type: "text", text: "x" }];
    const out = toAnthropicMessages([{ role: "assistant", parts: [{ type: "text", text: "x" }], providerRaw: { provider: "anthropic", data: raw } }]);
    expect(out[0].content).toBe(raw);
  });

  it("ignores raw data from another provider", () => {
    const out = toAnthropicMessages([{ role: "assistant", parts: [{ type: "text", text: "x" }], providerRaw: { provider: "gemini", data: {} } }]);
    expect(out[0].content).toEqual([{ type: "text", text: "x" }]);
  });
});

describe("AnthropicProvider.generate", () => {
  it("returns text, usage and the raw turn", async () => {
    const client = fakeClient(() => msg([{ type: "text", text: "Namaste" }]));
    const p = new AnthropicProvider({ model: "claude-opus-5-5", client });
    const r = await p.generate({ system: "s", messages: [{ role: "user", parts: [{ type: "text", text: "hi" }] }], maxOutputTokens: 4096 });
    expect(r).toMatchObject({ text: "Namaste", finishReason: "stop", toolCalls: [], usage: { inputTokens: 120, outputTokens: 40, totalTokens: 160 } });
    expect(r.message.providerRaw).toEqual({ provider: "anthropic", data: [{ type: "text", text: "Namaste" }] });
  });

  it("gives thinking room: max_tokens is at least the floor, and no sampling params are sent", async () => {
    const client = fakeClient(() => msg([{ type: "text", text: "ok" }]));
    await new AnthropicProvider({ model: "claude-opus-5-5", client, effort: "medium" }).generate({ system: "s", messages: [], maxOutputTokens: 4096, temperature: 0.7 });
    const sent = client.create.mock.calls[0][0] as Record<string, unknown>;
    expect(sent.max_tokens).toBe(8192);
    expect(sent).not.toHaveProperty("temperature");
    expect(sent.output_config).toEqual({ effort: "medium" });
  });

  it("sends tools as input_schema and parses tool_use blocks", async () => {
    const client = fakeClient(() => msg([{ type: "tool_use", id: "tu1", name: "draw_tarot", input: { spread: "single" } }], "tool_use"));
    const r = await new AnthropicProvider({ model: "m", client }).generate({
      system: "s",
      messages: [],
      tools: [{ name: "draw_tarot", description: "d", parameters: { type: "object", properties: {} } }],
    });
    expect((client.create.mock.calls[0][0] as { tools: unknown[] }).tools).toEqual([{ name: "draw_tarot", description: "d", input_schema: { type: "object", properties: {} } }]);
    expect(r.finishReason).toBe("tool_calls");
    expect(r.toolCalls).toEqual([{ type: "tool_call", id: "tu1", name: "draw_tarot", args: { spread: "single" } }]);
  });

  it("streams text to onText", async () => {
    const client = fakeClient(() => msg([{ type: "text", text: "Hello" }]));
    const seen: string[] = [];
    const r = await new AnthropicProvider({ model: "m", client }).generate({ system: "s", messages: [], onText: (d) => seen.push(d) });
    expect(seen.join("")).toBe("Hello");
    expect(r.text).toBe("Hello");
  });

  it("maps refusal and truncation", async () => {
    const refusal = await new AnthropicProvider({ model: "m", client: fakeClient(() => msg([], "refusal")) }).generate({ system: "s", messages: [] });
    expect(refusal.finishReason).toBe("blocked");
    const cut = await new AnthropicProvider({ model: "m", client: fakeClient(() => msg([{ type: "text", text: "partial" }], "max_tokens")) }).generate({ system: "s", messages: [] });
    expect(cut.finishReason).toBe("length");
  });

  it.each([
    [429, "rate_limited"],
    [529, "overloaded"],
    [500, "overloaded"],
    [401, "auth"],
    [400, "bad_request"],
  ])("classifies HTTP %i as %s", async (status, kind) => {
    const client = fakeClient(() => Object.assign(new Error("boom"), { status }));
    await expect(new AnthropicProvider({ model: "m", client }).generate({ system: "s", messages: [] })).rejects.toMatchObject({ kind });
  });
});

describe("AnthropicProvider.generateStructured", () => {
  const schema = { type: "object", properties: { kind: { type: "string" }, nested: { type: "object", properties: {} } }, required: ["kind"] };

  it("requests a json_schema format with additionalProperties false and parses the text", async () => {
    const client = fakeClient(() => msg([{ type: "text", text: '{"kind":"data"}' }]));
    const r = await new AnthropicProvider({ model: "claude-haiku-5-5", client }).generateStructured({ system: "s", prompt: "p", schema });
    expect(r.data).toEqual({ kind: "data" });
    const sent = client.create.mock.calls[0][0] as { output_config: { format: { type: string; schema: { additionalProperties: boolean; properties: { nested: { additionalProperties: boolean } } } } } };
    expect(sent.output_config.format.type).toBe("json_schema");
    expect(sent.output_config.format.schema.additionalProperties).toBe(false);
    expect(sent.output_config.format.schema.properties.nested.additionalProperties).toBe(false);
  });

  it("fails clearly on refusal, truncation or non-JSON", async () => {
    for (const reply of [msg([], "refusal"), msg([{ type: "text", text: "{" }], "max_tokens"), msg([{ type: "text", text: "not json" }])]) {
      const p = new AnthropicProvider({ model: "m", client: fakeClient(() => reply) });
      await expect(p.generateStructured({ system: "s", prompt: "p", schema })).rejects.toBeInstanceOf(LlmError);
    }
  });
});

describe("withNoExtraProperties", () => {
  it("does not overwrite an explicit setting and does not mutate the input", () => {
    const input = { type: "object", additionalProperties: true, properties: { a: { type: "object" } } };
    const out = withNoExtraProperties(input) as typeof input;
    expect(out.additionalProperties).toBe(true);
    expect((out.properties.a as Record<string, unknown>).additionalProperties).toBe(false);
    expect((input.properties.a as Record<string, unknown>).additionalProperties).toBeUndefined();
  });
});
