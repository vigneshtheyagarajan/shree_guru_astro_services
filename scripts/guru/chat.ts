/**
 * Talk to Guru in the terminal (development only).
 *
 *   npx tsx scripts/guru/chat.ts [--free 1] [--credit 0] [--script file.txt] [--verbose]
 *
 * Uses the model from GURU_LLM_PROVIDER (default: Gemini free tier, key in
 * .env). Entitlements are in memory, so --free and --credit let you try the
 * free question, the paywall and bundled-question confirmation without a
 * wallet. Use fictional birth details; Gemini's free tier may train on
 * what you send.
 */
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { handleTurn, type GuruDeps } from "../../src/lib/guru/conversation";
import { DEFAULT_PRICING, InMemoryEntitlements } from "../../src/lib/guru/entitlements";
import { createModelsFromEnv } from "../../src/lib/guru/llm/factory";
import { InMemorySessionStore } from "../../src/lib/guru/session";
import { OpenMeteoGeocoder } from "../../src/lib/guru/tools/geocode";

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] ?? "" : undefined;
}

async function run() {
  try {
    process.loadEnvFile(".env");
  } catch {
    /* no .env: rely on the real environment */
  }

  const models = createModelsFromEnv();
  const pricing = { ...DEFAULT_PRICING };
  const entitlements = new InMemoryEntitlements(pricing, {
    freeRemaining: Number(flag("free") ?? pricing.freeQuestions),
    creditRupees: Number(flag("credit") ?? 0),
  });
  const deps: GuruDeps = {
    provider: models.provider,
    classifier: models.classifier,
    store: new InMemorySessionStore(),
    entitlements,
    geocoder: new OpenMeteoGeocoder(),
    pricing,
  };
  const verbose = process.argv.includes("--verbose");

  console.log(`Guru dev chat  [${models.description}]`);
  console.log(`free questions: ${entitlements.freeRemaining}, wallet: ₹${entitlements.creditRupees}, ₹${pricing.pricePerQuestionRupees}/question`);
  console.log("Type /quit to leave, /topup 200 to add wallet credit.\n");

  const scriptPath = flag("script");
  const scripted = scriptPath ? readFileSync(scriptPath, "utf8").split("\n").map((l) => l.trim()).filter(Boolean) : null;
  const rl = scripted ? null : createInterface({ input: process.stdin, output: process.stdout });
  let sessionId: string | undefined;

  for (let i = 0; ; i++) {
    let line: string;
    if (scripted) {
      if (i >= scripted.length) break;
      line = scripted[i];
      console.log(`you> ${line}`);
    } else {
      line = (await rl!.question("you> ")).trim();
    }
    if (!line) continue;
    if (line === "/quit") break;
    const topup = line.match(/^\/topup\s+(\d+)$/);
    if (topup) {
      entitlements.creditRupees += Number(topup[1]);
      console.log(`(wallet now ₹${entitlements.creditRupees})\n`);
      continue;
    }

    const started = Date.now();
    const reply = await handleTurn({ sessionId, text: line }, deps);
    sessionId = reply.sessionId;
    console.log(`\nguru> ${reply.text}\n`);
    console.log(
      `  [${reply.decision}${reply.answered ? `, answered ${reply.answered}` : ""}${reply.chargedRupees ? `, charged ₹${reply.chargedRupees}` : ""} | free ${reply.balance.freeRemaining}, wallet ₹${reply.balance.creditRupees} | ${((Date.now() - started) / 1000).toFixed(1)}s${verbose ? ` | tokens in ${reply.usage.inputTokens} out ${reply.usage.outputTokens}` : ""}]\n`,
    );
  }
  rl?.close();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
