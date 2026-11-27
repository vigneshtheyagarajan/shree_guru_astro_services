import { describe, expect, it, vi } from "vitest";
import { FallbackProvider } from "./fallback";
import { LlmError, type GenerateResult, type LlmProvider } from "./types";

const result = (text: string, model: string): GenerateResult => ({
  message: { role: "assistant", parts: [{ type: "text", text }] },
  text,
  toolCalls: [],
  finishReason: "stop",
  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
  model,
});

function fake(name: string, behave: () => GenerateResult | LlmError): LlmProvider & { calls: number } {
  const p = {
    name,
    model: `${name}-model`,
    calls: 0,
    async generate() {
      p.calls++;
      const r = behave();
      if (r instanceof Error) throw r;
      return r;
    },
    async generateStructured() {
      p.calls++;
      const r = behave();
      if (r instanceof Error) throw r;
      return { data: { from: name }, usage: r.usage, model: r.model };
    },
  };
  return p;
}

const params = { system: "s", messages: [] };
const rate = (ms?: number) => new LlmError("quota", "rate_limited", undefined, ms);

describe("FallbackProvider", () => {
  it("uses the first provider while it works", async () => {
    const a = fake("a", () => result("A", "a"));
    const b = fake("b", () => result("B", "b"));
    const f = new FallbackProvider([a, b]);
    expect((await f.generate(params)).text).toBe("A");
    expect(b.calls).toBe(0);
    expect(f.model).toBe("a:a-model");
  });

  it("moves to the next provider when the first is out of quota, and reports it", async () => {
    const a = fake("a", () => rate(3_600_000));
    const b = fake("b", () => result("B", "b"));
    const events: string[] = [];
    const f = new FallbackProvider([a, b], { onFallback: (e) => events.push(`${e.from}->${e.to}`) });
    const r = await f.generate(params);
    expect(r.text).toBe("B");
    expect(r.model).toBe("b:b"); // says who actually answered
    expect(events).toEqual(["a:a-model->b:b-model"]);
    expect(f.model).toBe("b:b-model");
  });

  it("does not hammer an exhausted provider: it is skipped until its retry time, then tried again first", async () => {
    let t = 0;
    let aWorks = false;
    const a = fake("a", () => (aWorks ? result("A", "a") : rate(60_000)));
    const b = fake("b", () => result("B", "b"));
    const f = new FallbackProvider([a, b], { now: () => t });

    await f.generate(params); // a fails, b answers
    expect(a.calls).toBe(1);
    t = 30_000;
    await f.generate(params); // a still cooling down
    expect(a.calls).toBe(1);
    expect(b.calls).toBe(2);

    aWorks = true;
    t = 61_000;
    expect((await f.generate(params)).text).toBe("A"); // recovered, preferred again
    expect(a.calls).toBe(2);
  });

  it("walks the whole chain and throws the last error when everything is down", async () => {
    const a = fake("a", () => rate());
    const b = fake("b", () => new LlmError("busy", "overloaded"));
    const c = fake("c", () => new LlmError("bad key", "auth"));
    const f = new FallbackProvider([a, b, c]);
    await expect(f.generate(params)).rejects.toMatchObject({ kind: "auth" });
    expect([a.calls, b.calls, c.calls]).toEqual([1, 1, 1]);
  });

  it("still tries providers that are cooling down rather than failing outright when all are", async () => {
    const t = 0;
    let works = false;
    const a = fake("a", () => (works ? result("A", "a") : rate(600_000)));
    const f = new FallbackProvider([a], { now: () => t });
    await expect(f.generate(params)).rejects.toBeInstanceOf(LlmError);
    works = true;
    expect((await f.generate(params)).text).toBe("A");
  });

  it("does not put a bad_request provider on cooldown (the request may have been the problem)", async () => {
    let bad = true;
    const a = fake("a", () => (bad ? new LlmError("malformed tool call", "bad_request") : result("A", "a")));
    const b = fake("b", () => result("B", "b"));
    const f = new FallbackProvider([a, b]);
    expect((await f.generate(params)).text).toBe("B");
    bad = false;
    expect((await f.generate(params)).text).toBe("A");
  });

  it("does not retry a policy block on another provider, and honours abort", async () => {
    const a = fake("a", () => new LlmError("blocked", "blocked"));
    const b = fake("b", () => result("B", "b"));
    await expect(new FallbackProvider([a, b]).generate(params)).rejects.toMatchObject({ kind: "blocked" });
    expect(b.calls).toBe(0);

    const ctrl = new AbortController();
    const c = fake("c", () => {
      ctrl.abort();
      return rate();
    });
    const d = fake("d", () => result("D", "d"));
    await expect(new FallbackProvider([c, d]).generate({ ...params, signal: ctrl.signal })).rejects.toBeInstanceOf(LlmError);
    expect(d.calls).toBe(0);
  });

  it("applies to structured calls too", async () => {
    const a = fake("a", () => rate(60_000));
    const b = fake("b", () => result("B", "b"));
    const f = new FallbackProvider([a, b]);
    expect((await f.generateStructured({ system: "s", prompt: "p", schema: {} })).data).toEqual({ from: "b" });
  });

  it("needs at least one provider", () => {
    expect(() => new FallbackProvider([])).toThrow();
    void vi;
  });
});
