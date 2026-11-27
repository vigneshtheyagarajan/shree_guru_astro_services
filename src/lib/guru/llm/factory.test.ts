import { describe, expect, it } from "vitest";
import { createModelsFromEnv } from "./factory";

describe("createModelsFromEnv", () => {
  it("defaults to Gemini and needs its key", () => {
    expect(() => createModelsFromEnv({})).toThrow(/GEMINI_API_KEY/);
    const m = createModelsFromEnv({ GEMINI_API_KEY: "k" });
    expect(m.provider.name).toBe("gemini");
    expect(m.provider.model).toBe("gemini-3.8-flash");
    expect(m.classifier.model).toBe("gemini-3.1-flash-lite");
  });

  it("swaps to Claude by configuration only", () => {
    const m = createModelsFromEnv({ GURU_LLM_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "k", GURU_CLAUDE_EFFORT: "high" });
    expect(m.provider.name).toBe("anthropic");
    expect(m.provider.model).toBe("claude-opus-5-5");
    expect(m.classifier.model).toBe("claude-haiku-5-5");
    expect(m.description).toContain("effort high");
  });

  it("allows model overrides (for example a cheaper Claude for testing)", () => {
    const m = createModelsFromEnv({ GURU_LLM_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "k", GURU_MODEL: "claude-sonnet-5-5" });
    expect(m.provider.model).toBe("claude-sonnet-5-5");
  });

  it("rejects bad configuration", () => {
    expect(() => createModelsFromEnv({ GURU_LLM_PROVIDER: "openai" })).toThrow(/gemini.*anthropic/);
    expect(() => createModelsFromEnv({ GURU_LLM_PROVIDER: "anthropic" })).toThrow(/ANTHROPIC_API_KEY/);
    expect(() => createModelsFromEnv({ GURU_LLM_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "k", GURU_CLAUDE_EFFORT: "turbo" })).toThrow(/GURU_CLAUDE_EFFORT/);
  });
});
