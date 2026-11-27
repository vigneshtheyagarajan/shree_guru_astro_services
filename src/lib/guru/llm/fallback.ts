import {
  LlmError,
  type GenerateParams,
  type GenerateResult,
  type LlmProvider,
  type StructuredParams,
  type StructuredResult,
} from "./types";

// Tries providers in order. When one runs out of quota, is overloaded or
// rejects the request, the next takes over, and the exhausted one is left
// alone until it should have recovered (the provider's own retry hint when it
// gives one, otherwise a short default). Callers see a single LlmProvider.

export interface FallbackOptions {
  now?: () => number;
  /** Called whenever a provider is skipped over, for logging. */
  onFallback?: (event: { from: string; to: string | null; error: LlmError }) => void;
}

const MIN_COOLDOWN_MS = 5_000;
const MAX_COOLDOWN_MS = 6 * 3_600_000;

/** Failures another provider might not share. A policy block is the user's content, so it is not retried elsewhere. */
const FALLBACK_KINDS = new Set<LlmError["kind"]>(["rate_limited", "overloaded", "auth", "bad_request", "unknown"]);

function cooldownMs(error: LlmError): number {
  const hinted = error.retryAfterMs;
  switch (error.kind) {
    case "rate_limited":
      return clamp(hinted ?? 60_000);
    case "overloaded":
      return clamp(hinted ?? 30_000);
    case "auth":
      return 3_600_000; // a bad key will not fix itself
    case "bad_request":
      return 0; // likely specific to this request, not to the provider
    default:
      return 30_000;
  }
}
const clamp = (ms: number) => Math.min(Math.max(ms, MIN_COOLDOWN_MS), MAX_COOLDOWN_MS);

export class FallbackProvider implements LlmProvider {
  readonly name = "fallback";
  private readonly cooldownUntil = new Map<LlmProvider, number>();
  private readonly now: () => number;
  private readonly onFallback?: FallbackOptions["onFallback"];
  /** The provider that served the most recent successful call. */
  lastUsed: LlmProvider;

  constructor(
    private readonly providers: LlmProvider[],
    options: FallbackOptions = {},
  ) {
    if (providers.length === 0) throw new Error("FallbackProvider needs at least one provider.");
    this.now = options.now ?? Date.now;
    this.onFallback = options.onFallback;
    this.lastUsed = providers[0];
  }

  /** Model name of the provider that most recently answered. */
  get model(): string {
    return `${this.lastUsed.name}:${this.lastUsed.model}`;
  }

  /** Providers in the order they will be tried right now: those not cooling down, then those that are. */
  private order(): LlmProvider[] {
    const t = this.now();
    const ready = this.providers.filter((p) => (this.cooldownUntil.get(p) ?? 0) <= t);
    const waiting = this.providers.filter((p) => !ready.includes(p));
    return [...ready, ...waiting];
  }

  private async run<T>(call: (p: LlmProvider) => Promise<T>, signal?: AbortSignal): Promise<T> {
    const order = this.order();
    let lastError: LlmError | undefined;
    for (const [i, provider] of order.entries()) {
      try {
        const result = await call(provider);
        this.lastUsed = provider;
        return result;
      } catch (raw) {
        if (signal?.aborted) throw raw;
        const error = raw instanceof LlmError ? raw : new LlmError(String((raw as Error)?.message ?? raw), "unknown", raw);
        if (!FALLBACK_KINDS.has(error.kind)) throw error;
        const wait = cooldownMs(error);
        if (wait > 0) this.cooldownUntil.set(provider, this.now() + wait);
        lastError = error;
        this.onFallback?.({ from: `${provider.name}:${provider.model}`, to: order[i + 1] ? `${order[i + 1].name}:${order[i + 1].model}` : null, error });
      }
    }
    throw lastError ?? new LlmError("No model provider is available.", "unknown");
  }

  /** Results name the provider that produced them ("groq:openai/gpt-oss-120b"). */
  generate(params: GenerateParams): Promise<GenerateResult> {
    return this.run(async (p) => {
      const r = await p.generate(params);
      return { ...r, model: `${p.name}:${r.model}` };
    }, params.signal);
  }

  generateStructured(params: StructuredParams): Promise<StructuredResult> {
    return this.run(async (p) => {
      const r = await p.generateStructured(params);
      return { ...r, model: `${p.name}:${r.model}` };
    }, params.signal);
  }
}
