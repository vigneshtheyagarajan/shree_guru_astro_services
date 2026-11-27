import { describe, expect, it, vi } from "vitest";
import { OpenAICompatProvider, parseDuration, toWireMessages } from "./openai-compat";
import { LlmError, type ChatMessage } from "./types";

const ok = (message: Record<string, unknown>, finish = "stop") =>
  new Response(JSON.stringify({ choices: [{ message, finish_reason: finish }], usage: { prompt_tokens: 12, completion_tokens: 7, total_tokens: 19 } }), { status: 200 });

function make(handler: (url: string, init: RequestInit) => Response | Promise<Response>, extra: { shortToolIds?: boolean } = {}) {
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => handler(String(url), init ?? {}));
  const p = new OpenAICompatProvider({ name: "groq", baseUrl: "https://api.example.com/v1/", apiKey: "k", model: "m1", fetch: fetchMock as unknown as typeof fetch, ...extra });
  return { p, fetchMock };
}
const user = (text: string): ChatMessage => ({ role: "user", parts: [{ type: "text", text }] });
const body = (fetchMock: ReturnType<typeof vi.fn>) => JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);

describe("toWireMessages", () => {
  const history: ChatMessage[] = [
    user("hi"),
    { role: "assistant", parts: [{ type: "text", text: "checking" }, { type: "tool_call", id: "gem-abc", name: "draw_tarot", args: { spread: "single" } }] },
    { role: "user", parts: [{ type: "tool_result", id: "gem-abc", name: "draw_tarot", result: { card: "Sun" } }] },
  ];

  it("maps system, text, tool calls and tool results", () => {
    expect(toWireMessages("SYS", history)).toEqual([
      { role: "system", content: "SYS" },
      { role: "user", content: "hi" },
      { role: "assistant", content: "checking", tool_calls: [{ id: "gem-abc", type: "function", function: { name: "draw_tarot", arguments: '{"spread":"single"}' } }] },
      { role: "tool", tool_call_id: "gem-abc", content: '{"card":"Sun"}' },
    ]);
  });

  it("rewrites tool ids to 9 characters consistently when asked (Mistral)", () => {
    const wire = toWireMessages("S", history, true);
    const callId = (wire[2] as { tool_calls: { id: string }[] }).tool_calls[0].id;
    expect(callId).toMatch(/^[a-z0-9]{9}$/i);
    expect((wire[3] as { tool_call_id: string }).tool_call_id).toBe(callId);
  });

  it("wraps tool errors and gives a null-content assistant turn when it only called tools", () => {
    const wire = toWireMessages("S", [
      { role: "assistant", parts: [{ type: "tool_call", id: "a", name: "t", args: {} }] },
      { role: "user", parts: [{ type: "tool_result", id: "a", name: "t", result: "bad", isError: true }] },
    ]);
    expect(wire[1]).toMatchObject({ role: "assistant", content: null });
    expect(wire[2]).toEqual({ role: "tool", tool_call_id: "a", content: '{"error":"bad"}' });
  });
});

describe("OpenAICompatProvider.generate", () => {
  it("posts to the base URL with auth, tools and max_tokens, and returns text and usage", async () => {
    const { p, fetchMock } = make(() => ok({ content: "Namaste" }));
    const seen: string[] = [];
    const r = await p.generate({
      system: "S",
      messages: [user("hi")],
      maxOutputTokens: 500,
      tools: [{ name: "t", description: "d", parameters: { type: "object", properties: {} } }],
      onText: (d) => seen.push(d),
    });
    expect(r).toMatchObject({ text: "Namaste", finishReason: "stop", usage: { inputTokens: 12, outputTokens: 7, totalTokens: 19 }, model: "m1" });
    expect(seen).toEqual(["Namaste"]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/v1/chat/completions");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer k");
    expect(body(fetchMock)).toMatchObject({ model: "m1", max_tokens: 500, tool_choice: "auto", tools: [{ type: "function", function: { name: "t" } }] });
  });

  it("parses tool calls and reports tool_calls as the finish reason", async () => {
    const { p } = make(() => ok({ content: null, tool_calls: [{ id: "x1", function: { name: "draw_tarot", arguments: '{"spread":"single","question":"q"}' } }] }, "tool_calls"));
    const r = await p.generate({ system: "S", messages: [user("hi")] });
    expect(r.finishReason).toBe("tool_calls");
    expect(r.toolCalls).toEqual([{ type: "tool_call", id: "x1", name: "draw_tarot", args: { spread: "single", question: "q" } }]);
  });

  it("accepts content given as a list of chunks", async () => {
    const { p } = make(() => ok({ content: [{ type: "text", text: "Hel" }, { type: "text", text: "lo" }] }));
    expect((await p.generate({ system: "S", messages: [user("hi")] })).text).toBe("Hello");
  });

  it("treats malformed tool arguments as a failure the fallback layer can move past", async () => {
    const { p } = make(() => ok({ content: null, tool_calls: [{ id: "x", function: { name: "t", arguments: "{not json" } }] }, "tool_calls"));
    await expect(p.generate({ system: "S", messages: [user("hi")] })).rejects.toMatchObject({ kind: "bad_request" });
  });

  it("classifies HTTP errors and surfaces retry hints", async () => {
    const run = async (status: number, headers: Record<string, string> = {}, text = "x") => {
      const { p } = make(() => new Response(text, { status, headers }));
      return p.generate({ system: "S", messages: [user("hi")] }).catch((e) => e as LlmError);
    };
    expect(await run(429, { "retry-after": "42" })).toMatchObject({ kind: "rate_limited", retryAfterMs: 42_000 });
    expect(await run(429, {}, "Rate limit reached. Please try again in 7m12.5s. Need more?")).toMatchObject({ kind: "rate_limited", retryAfterMs: 432_500 });
    expect(await run(401)).toMatchObject({ kind: "auth" });
    expect(await run(400)).toMatchObject({ kind: "bad_request" });
    expect(await run(503)).toMatchObject({ kind: "overloaded" });
  });

  it("reports network failures as overloaded so another provider can take over", async () => {
    const { p } = make(() => {
      throw new TypeError("fetch failed");
    });
    await expect(p.generate({ system: "S", messages: [user("hi")] })).rejects.toMatchObject({ kind: "overloaded" });
  });

  it("refuses to be built without a key", () => {
    expect(() => new OpenAICompatProvider({ name: "groq", baseUrl: "u", apiKey: "", model: "m" })).toThrow(/API key/);
  });
});

describe("OpenAICompatProvider.generateStructured", () => {
  it("asks for JSON mode with the schema in the prompt and parses fenced output", async () => {
    const { p, fetchMock } = make(() => ok({ content: '```json\n{"kind":"data"}\n```' }));
    const r = await p.generateStructured({ system: "S", prompt: "P", schema: { type: "object" } });
    expect(r.data).toEqual({ kind: "data" });
    const sent = body(fetchMock);
    expect(sent.response_format).toEqual({ type: "json_object" });
    expect(sent.messages[0].content).toContain('{"type":"object"}');
  });

  it("fails on non-JSON or truncated output", async () => {
    await expect(make(() => ok({ content: "sorry" })).p.generateStructured({ system: "S", prompt: "P", schema: {} })).rejects.toBeInstanceOf(LlmError);
    await expect(make(() => ok({ content: "{" }, "length")).p.generateStructured({ system: "S", prompt: "P", schema: {} })).rejects.toBeInstanceOf(LlmError);
  });
});

describe("parseDuration", () => {
  it.each([
    ["7m12.5s", 432_500],
    ["30s", 30_000],
    ["2h3m", 7_380_000],
    ["850ms", 850],
    ["", undefined],
  ])("%s", (text, ms) => expect(parseDuration(text)).toBe(ms));
});
