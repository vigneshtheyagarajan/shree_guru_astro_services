import { describe, expect, it } from "vitest";
import { FallbackProvider } from "./fallback";
import { createModelsFromEnv } from "./factory";

describe("createModelsFromEnv", () => {
  it("needs at least one key", () => {
    expect(() => createModelsFromEnv({})).toThrow(/GEMINI_API_KEY.*GROQ_API_KEY.*MISTRAL_API_KEY/);
  });

  it("with only a Gemini key, uses Gemini alone", () => {
    const m = createModelsFromEnv({ GEMINI_API_KEY: "k" });
    expect(m.chain).toEqual(["gemini"]);
    expect(m.provider.name).toBe("gemini");
    expect(m.provider.model).toBe("gemini-3.8-flash");
    expect(m.classifier.model).toBe("gemini-3.1-flash-lite");
  });

  it("builds a free fallback chain automatically from whichever keys exist", () => {
    const m = createModelsFromEnv({ GEMINI_API_KEY: "k", GROQ_API_KEY: "g", MISTRAL_API_KEY: "m" });
    expect(m.chain).toEqual(["gemini", "groq", "mistral"]);
    expect(m.provider).toBeInstanceOf(FallbackProvider);
    expect(m.classifier).toBeInstanceOf(FallbackProvider);
    expect(m.description).toContain("gemini-3.8-flash > openai/gpt-oss-120b > mistral-large-latest");
    // Groq alone is also fine (Gemini key missing).
    expect(createModelsFromEnv({ GROQ_API_KEY: "g" }).chain).toEqual(["groq"]);
  });

  it("never adds paid Claude implicitly", () => {
    expect(createModelsFromEnv({ GEMINI_API_KEY: "k", ANTHROPIC_API_KEY: "a" }).chain).toEqual(["gemini"]);
  });

  it("takes an explicit ordered chain, which is how to move to paid Claude with free fallbacks behind it", () => {
    const m = createModelsFromEnv({ GURU_LLM_PROVIDERS: "anthropic, gemini", ANTHROPIC_API_KEY: "a", GEMINI_API_KEY: "k", GURU_CLAUDE_EFFORT: "high" });
    expect(m.chain).toEqual(["anthropic", "gemini"]);
    expect(m.description).toContain("claude-opus-5-5 > gemini-3.8-flash");
  });

  it("keeps the single-provider form working", () => {
    const m = createModelsFromEnv({ GURU_LLM_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "k" });
    expect(m.provider.name).toBe("anthropic");
    expect(m.classifier.model).toBe("claude-haiku-5-5");
  });

  it("per-provider model overrides, and the generic override applies to the first provider only", () => {
    const m = createModelsFromEnv({ GEMINI_API_KEY: "k", GROQ_API_KEY: "g", GURU_MODEL: "gemini-x", GURU_GROQ_MODEL: "llama-y" });
    expect(m.description).toContain("gemini-x > llama-y");
  });

  it("rejects bad configuration with a clear message", () => {
    expect(() => createModelsFromEnv({ GURU_LLM_PROVIDERS: "openai", GEMINI_API_KEY: "k" })).toThrow(/Unknown model provider "openai"/);
    expect(() => createModelsFromEnv({ GURU_LLM_PROVIDERS: "gemini,groq", GEMINI_API_KEY: "k" })).toThrow(/GROQ_API_KEY is not set/);
    expect(() => createModelsFromEnv({ GURU_LLM_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "k", GURU_CLAUDE_EFFORT: "turbo" })).toThrow(/GURU_CLAUDE_EFFORT/);
  });
});
