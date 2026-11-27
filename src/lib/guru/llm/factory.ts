import { AnthropicProvider, type AnthropicEffort } from "./anthropic";
import { FallbackProvider } from "./fallback";
import { GeminiProvider } from "./gemini";
import { OpenAICompatProvider } from "./openai-compat";
import type { LlmProvider } from "./types";

// Which model Guru talks to is configuration, not code.
//
//   GURU_LLM_PROVIDERS=gemini,groq,mistral   ordered chain; when one runs out of
//                                            quota the next takes over automatically
//   (unset)                                  every free provider that has a key, in
//                                            the order above
//   GURU_LLM_PROVIDER=anthropic              legacy single-provider form (also how
//                                            you move to paid Claude: list it first)
//
//   Keys: GEMINI_API_KEY, GROQ_API_KEY, MISTRAL_API_KEY, ANTHROPIC_API_KEY
//   Models: GURU_<PROVIDER>_MODEL and GURU_<PROVIDER>_CLASSIFIER_MODEL
//           (GURU_MODEL / GURU_CLASSIFIER_MODEL apply to the first provider only)
//   GURU_CLAUDE_EFFORT (low|medium|high|xhigh|max) tunes Claude's reasoning depth

export type Env = Record<string, string | undefined>;
export type ProviderKind = "gemini" | "groq" | "mistral" | "anthropic";

export interface GuruModels {
  provider: LlmProvider;
  classifier: LlmProvider;
  description: string;
  /** The providers in the chain, in order. */
  chain: ProviderKind[];
}

interface Spec {
  keyVar: string;
  main: string;
  classifier: string;
}

const SPECS: Record<ProviderKind, Spec> = {
  gemini: { keyVar: "GEMINI_API_KEY", main: "gemini-3.8-flash", classifier: "gemini-3.1-flash-lite" },
  groq: { keyVar: "GROQ_API_KEY", main: "openai/gpt-oss-120b", classifier: "llama-3.1-8b-instant" },
  mistral: { keyVar: "MISTRAL_API_KEY", main: "mistral-large-latest", classifier: "mistral-small-latest" },
  anthropic: { keyVar: "ANTHROPIC_API_KEY", main: "claude-opus-5-5", classifier: "claude-haiku-5-5" },
};
const KINDS = Object.keys(SPECS) as ProviderKind[];
/** Providers used automatically when keys are present. Paid Claude is never added implicitly. */
const FREE_CHAIN: ProviderKind[] = ["gemini", "groq", "mistral"];
const EFFORTS: readonly string[] = ["low", "medium", "high", "xhigh", "max"];

function resolveChain(env: Env): ProviderKind[] {
  const list = env.GURU_LLM_PROVIDERS ?? env.GURU_LLM_PROVIDER;
  if (list && list.trim()) {
    const kinds = list.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean);
    for (const k of kinds) {
      if (!KINDS.includes(k as ProviderKind)) throw new Error(`Unknown model provider "${k}". Use any of: ${KINDS.join(", ")}.`);
    }
    const chain = [...new Set(kinds)] as ProviderKind[];
    for (const k of chain) {
      if (!env[SPECS[k].keyVar]?.trim()) throw new Error(`${SPECS[k].keyVar} is not set (needed for "${k}").`);
    }
    return chain;
  }
  const chain = FREE_CHAIN.filter((k) => env[SPECS[k].keyVar]?.trim());
  if (chain.length === 0) {
    throw new Error(`No model key found. Set at least one of ${FREE_CHAIN.map((k) => SPECS[k].keyVar).join(", ")}.`);
  }
  return chain;
}

function build(kind: ProviderKind, role: "main" | "classifier", env: Env, isFirst: boolean): LlmProvider {
  const spec = SPECS[kind];
  const apiKey = env[spec.keyVar]!.trim();
  const upper = kind.toUpperCase();
  const generic = isFirst ? (role === "main" ? env.GURU_MODEL : env.GURU_CLASSIFIER_MODEL) : undefined;
  const model = (env[`GURU_${upper}_${role === "main" ? "MODEL" : "CLASSIFIER_MODEL"}`] || generic || spec[role]).trim();

  switch (kind) {
    case "gemini":
      return new GeminiProvider({ apiKey, model, ...(role === "classifier" ? { thinking: "minimal" as const } : {}) });
    case "groq":
      return new OpenAICompatProvider({ name: "groq", baseUrl: "https://api.groq.com/openai/v1", apiKey, model });
    case "mistral":
      return new OpenAICompatProvider({ name: "mistral", baseUrl: "https://api.mistral.ai/v1", apiKey, model, shortToolIds: true });
    case "anthropic": {
      const effortRaw = env.GURU_CLAUDE_EFFORT?.trim().toLowerCase();
      if (effortRaw && !EFFORTS.includes(effortRaw)) throw new Error(`GURU_CLAUDE_EFFORT must be one of ${EFFORTS.join(", ")}.`);
      // Classifying is easy: keep it fast and cheap regardless of the main setting.
      const effort = role === "classifier" ? ("low" as const) : (effortRaw as AnthropicEffort | undefined);
      return new AnthropicProvider({ apiKey, model, effort });
    }
  }
}

function chainOf(role: "main" | "classifier", chain: ProviderKind[], env: Env, onFallback: boolean): LlmProvider {
  const providers = chain.map((kind, i) => build(kind, role, env, i === 0));
  if (providers.length === 1) return providers[0];
  return new FallbackProvider(providers, {
    onFallback: onFallback
      ? ({ from, to, error }) => console.warn(`[guru] ${from} unavailable (${error.kind}); ${to ? `switching to ${to}` : "no more providers to try"}`)
      : undefined,
  });
}

export function createModelsFromEnv(env: Env = process.env): GuruModels {
  const chain = resolveChain(env);
  const provider = chainOf("main", chain, env, true);
  const classifier = chainOf("classifier", chain, env, true);
  const describe = (role: "main" | "classifier") => chain.map((k, i) => build(k, role, env, i === 0).model).join(" > ");
  return {
    provider,
    classifier,
    chain,
    description: `${chain.join(" > ")} (main ${describe("main")}; classifier ${describe("classifier")})`,
  };
}
