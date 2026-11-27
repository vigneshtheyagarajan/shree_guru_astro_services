import { AnthropicProvider, type AnthropicEffort } from "./anthropic";
import { GeminiProvider } from "./gemini";
import type { LlmProvider } from "./types";

// Which model Guru talks to is configuration, not code:
//
//   GURU_LLM_PROVIDER=gemini      (default; free tier, for development)
//   GURU_LLM_PROVIDER=anthropic   (paid Claude, for production)
//   GURU_MODEL / GURU_CLASSIFIER_MODEL override the model names
//   GEMINI_API_KEY / ANTHROPIC_API_KEY supply the keys
//   GURU_CLAUDE_EFFORT (low|medium|high|xhigh|max) tunes Claude's reasoning depth

export type Env = Record<string, string | undefined>;

export interface GuruModels {
  provider: LlmProvider;
  classifier: LlmProvider;
  description: string;
}

const DEFAULTS = {
  gemini: { main: "gemini-3.8-flash", classifier: "gemini-3.1-flash-lite" },
  anthropic: { main: "claude-opus-5-5", classifier: "claude-haiku-5-5" },
} as const;

const EFFORTS: readonly string[] = ["low", "medium", "high", "xhigh", "max"];

export function createModelsFromEnv(env: Env = process.env): GuruModels {
  const kind = (env.GURU_LLM_PROVIDER ?? "gemini").trim().toLowerCase();
  if (kind !== "gemini" && kind !== "anthropic") {
    throw new Error(`GURU_LLM_PROVIDER must be "gemini" or "anthropic" (got "${kind}").`);
  }
  const mainModel = env.GURU_MODEL?.trim() || DEFAULTS[kind].main;
  const classifierModel = env.GURU_CLASSIFIER_MODEL?.trim() || DEFAULTS[kind].classifier;

  if (kind === "gemini") {
    const apiKey = env.GEMINI_API_KEY?.trim();
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");
    return {
      provider: new GeminiProvider({ apiKey, model: mainModel }),
      classifier: new GeminiProvider({ apiKey, model: classifierModel, thinking: "minimal" }),
      description: `gemini (${mainModel}, classifier ${classifierModel})`,
    };
  }

  const apiKey = env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set.");
  const effortRaw = env.GURU_CLAUDE_EFFORT?.trim().toLowerCase();
  if (effortRaw && !EFFORTS.includes(effortRaw)) throw new Error(`GURU_CLAUDE_EFFORT must be one of ${EFFORTS.join(", ")}.`);
  const effort = effortRaw as AnthropicEffort | undefined;
  return {
    provider: new AnthropicProvider({ apiKey, model: mainModel, effort }),
    // Classifying is easy: keep it fast and cheap regardless of the main setting.
    classifier: new AnthropicProvider({ apiKey, model: classifierModel, effort: "low" }),
    description: `anthropic (${mainModel}${effort ? `, effort ${effort}` : ""}, classifier ${classifierModel})`,
  };
}
