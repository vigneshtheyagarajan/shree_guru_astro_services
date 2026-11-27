/**
 * Checks every model provider that has a key in .env, one at a time:
 * a plain reply, a tool call, and structured JSON (what the classifier needs).
 *
 *   npx tsx scripts/guru/check-providers.ts
 *
 * Use it after adding a key or changing a model name. Each provider costs
 * about three small requests.
 */
import { createModelsFromEnv, type ProviderKind } from "../../src/lib/guru/llm/factory";
import type { LlmProvider } from "../../src/lib/guru/llm/types";

const KEYS: Record<ProviderKind, string> = {
  gemini: "GEMINI_API_KEY",
  groq: "GROQ_API_KEY",
  mistral: "MISTRAL_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
};

async function step(label: string, fn: () => Promise<string>) {
  const started = Date.now();
  try {
    const detail = await fn();
    console.log(`  ok    ${label.padEnd(18)} ${((Date.now() - started) / 1000).toFixed(1)}s  ${detail}`);
    return true;
  } catch (error) {
    const e = error as { kind?: string; retryAfterMs?: number; message?: string };
    const retry = e.retryAfterMs ? ` (retry in ~${Math.round(e.retryAfterMs / 60000)} min)` : "";
    console.log(`  FAIL  ${label.padEnd(18)} ${e.kind ?? "error"}${retry}: ${String(e.message).slice(0, 220)}`);
    return false;
  }
}

async function check(kind: ProviderKind, env: NodeJS.ProcessEnv) {
  const models = createModelsFromEnv({ ...env, GURU_LLM_PROVIDERS: kind });
  const main: LlmProvider = models.provider;
  const cls: LlmProvider = models.classifier;
  console.log(`\n${kind}  (main ${main.model}, classifier ${cls.model})`);

  await step("plain reply", async () => {
    const r = await main.generate({ system: "Reply in one short sentence.", messages: [{ role: "user", parts: [{ type: "text", text: "Say hello." }] }], maxOutputTokens: 400 });
    if (!r.text.trim()) throw new Error(`empty reply (finish: ${r.finishReason})`);
    return JSON.stringify(r.text.trim().slice(0, 50));
  });

  await step("tool call", async () => {
    const r = await main.generate({
      system: "Use the tool whenever the user asks for a number. Do not answer from memory.",
      messages: [{ role: "user", parts: [{ type: "text", text: "Give me my lucky number for date 1990-03-12." }] }],
      tools: [
        {
          name: "lucky_number",
          description: "Returns the lucky number for a birth date.",
          parameters: { type: "object", properties: { date: { type: "string", description: "YYYY-MM-DD" } }, required: ["date"] },
        },
      ],
      maxOutputTokens: 800,
    });
    const call = r.toolCalls[0];
    if (!call) throw new Error(`no tool call (finish: ${r.finishReason}, text: ${JSON.stringify(r.text.slice(0, 60))})`);
    return `${call.name}(${JSON.stringify(call.args)})`;
  });

  await step("structured JSON", async () => {
    const r = await cls.generateStructured({
      system: "Label the message.",
      prompt: "Message: When will I get married?",
      schema: {
        type: "object",
        properties: { kind: { type: "string", enum: ["question", "data", "chitchat"] } },
        required: ["kind"],
      },
    });
    return JSON.stringify(r.data);
  });
}

async function run() {
  try {
    process.loadEnvFile(".env");
  } catch {
    /* rely on the real environment */
  }
  const present = (Object.keys(KEYS) as ProviderKind[]).filter((k) => process.env[KEYS[k]]?.trim());
  if (present.length === 0) {
    console.log("No provider keys found. Set GEMINI_API_KEY, GROQ_API_KEY or MISTRAL_API_KEY in .env.");
    return;
  }
  for (const kind of present) await check(kind, process.env);
  const missing = (Object.keys(KEYS) as ProviderKind[]).filter((k) => !present.includes(k));
  if (missing.length) console.log(`\nNo key for: ${missing.join(", ")}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
