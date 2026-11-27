import { randomUUID } from "node:crypto";
import { GuruInputError } from "./astro/time";
import { classifyMessage } from "./classifier";
import { DEFAULT_PRICING, type EntitlementSnapshot, type Entitlements, type GuruPricing, type Reservation } from "./entitlements";
import { decideGate, MAX_MESSAGE_CHARS, offerHeldQuestions, type GateDecision, type GateSession } from "./gate";
import { addUsage, type ChatMessage, type LlmProvider, type TokenUsage } from "./llm/types";
import { confirmBundleMessage, heldOfferMessage, paymentRequiredMessage, primaryOnlyNote, refuseMessage, TECHNICAL_ERROR } from "./messages";
import { buildSystemPrompt, type TurnMode } from "./persona";
import { canAnswer, newSession, type GuruSession, type ServiceKind, type SessionStore } from "./session";
import { executeTool, GURU_TOOL_DECLARATIONS } from "./tools";
import type { Geocoder } from "./tools/geocode";

// One user message in, one Guru reply out. The order is fixed and none of it
// is left to the model:
//   classify -> gate (code) -> reserve -> model answers -> commit
// A model failure releases the reservation, so it never costs the user.

export interface GuruDeps {
  provider: LlmProvider;
  /** Cheaper model for labelling messages; defaults to `provider`. */
  classifier?: LlmProvider;
  store: SessionStore;
  /** The entitlements of the user this turn belongs to. */
  entitlements: Entitlements;
  geocoder: Geocoder;
  pricing?: GuruPricing;
  now?: () => Date;
  maxToolRounds?: number;
  maxOutputTokens?: number;
  newId?: () => string;
}

export interface GuruTurnInput {
  sessionId?: string;
  userId?: string | null;
  text: string;
  signal?: AbortSignal;
  /** Receives the model's text as it is generated. */
  onText?: (delta: string) => void;
}

export interface GuruReply {
  sessionId: string;
  text: string;
  decision: GateDecision["type"] | "error";
  service: ServiceKind | null;
  /** Questions answered this turn (free or paid). */
  answered: number;
  chargedRupees: number;
  balance: EntitlementSnapshot;
  usage: TokenUsage;
}

export class GuruAccessError extends Error {}

const DEFAULT_MAX_TOOL_ROUNDS = 6;
const DEFAULT_MAX_OUTPUT_TOKENS = 4096;

export async function handleTurn(input: GuruTurnInput, deps: GuruDeps): Promise<GuruReply> {
  const pricing = deps.pricing ?? DEFAULT_PRICING;
  const now = deps.now ?? (() => new Date());
  const userId = input.userId ?? null;

  const text = input.text.trim();
  if (!text) throw new GuruInputError("Please type a message.");

  const stored = input.sessionId ? await deps.store.load(input.sessionId) : null;
  if (stored && stored.userId !== userId) throw new GuruAccessError("This conversation belongs to another user.");
  const session = stored ?? newSession(input.sessionId ?? (deps.newId ?? randomUUID)(), userId, now());

  const reply = (partial: Partial<GuruReply> & Pick<GuruReply, "text" | "decision">, balance: EntitlementSnapshot): GuruReply => ({
    sessionId: session.id,
    service: session.service,
    answered: 0,
    chargedRupees: 0,
    balance,
    usage: session.usage,
    ...partial,
  });

  const snapshot = await deps.entitlements.snapshot();

  if (text.length > MAX_MESSAGE_CHARS) {
    return reply({ text: refuseMessage("too_long"), decision: "refuse" }, snapshot);
  }

  // 1. What is this message?
  const classified = await classifyMessage(deps.classifier ?? deps.provider, session, text, input.signal);
  const { classification } = classified;
  let usage = addUsage(session.usage, classified.usage);

  // 2. Which service, and is there data to answer from?
  let service = session.service;
  if (classification.service && (classification.kind === "data" || classification.kind === "question")) service = classification.service;
  const gateSession: GateSession = {
    service,
    answerable: canAnswer(session, service),
    pendingQuestions: session.pendingQuestions,
    pendingBundle: session.pendingBundle,
  };

  // 3. What may be answered, and what does it cost? Decided by code.
  const { decision, next } = decideGate({ classification, session: gateSession, snapshot, pricing });

  const persist = async (updates: Partial<GuruSession>, newMessages: ChatMessage[]) => {
    Object.assign(session, updates, { messages: [...session.messages, ...newMessages], updatedAt: now().toISOString(), usage });
    await deps.store.save(session);
  };
  const userMessage: ChatMessage = { role: "user", parts: [{ type: "text", text }] };
  const canned = async (message: string, extra: Partial<GuruSession>): Promise<GuruReply> => {
    await persist({ service, ...extra }, [userMessage, { role: "assistant", parts: [{ type: "text", text: message }] }]);
    input.onText?.(message);
    return reply({ text: message, decision: decision.type }, snapshot);
  };

  // 4. Replies that never involve the model.
  switch (decision.type) {
    case "refuse":
      return canned(refuseMessage(decision.reason), {});
    case "confirm_bundle":
      return canned(confirmBundleMessage(decision.questions, decision.costRupees), { pendingQuestions: next.pendingQuestions, pendingBundle: next.pendingBundle });
    case "payment_required":
      return canned(paymentRequiredMessage(decision), { pendingQuestions: next.pendingQuestions, pendingBundle: next.pendingBundle });
  }

  // 5. Hold the entitlement before spending model time.
  let reservation: Reservation | null = null;
  let mode: TurnMode = { type: "free" };
  let answeredCount = 0;
  if (decision.type === "answer" || decision.type === "answer_primary_only") {
    reservation = await deps.entitlements.reserve(decision.reserve);
    if (!reservation) {
      const fresh = await deps.entitlements.snapshot();
      return canned(paymentRequiredMessage({ questions: decision.reserve, costRupees: decision.reserve * pricing.pricePerQuestionRupees, creditRupees: fresh.creditRupees }), {});
    }
    mode = decision.type === "answer" ? { type: "answer", questions: decision.questions } : { type: "answer_primary_only", primary: decision.primary };
    answeredCount = decision.reserve;
  }

  // 6. The model replies, using tools for every fact.
  const working: GuruSession = { ...session, service };
  try {
    const result = await runModelTurn(working, userMessage, mode, deps, now, input);
    usage = addUsage(usage, result.usage);
    await reservation?.commit();

    let outText = result.text;
    const extras: string[] = [];
    if (decision.type === "answer_primary_only") extras.push(primaryOnlyNote(decision.primary, decision.others, pricing.pricePerQuestionRupees));

    // Once the data exists, questions held from earlier are offered back (once).
    const heldChanged = next.pendingQuestions.join("|") !== session.pendingQuestions.join("|");
    let holdState = {
      pendingQuestions: next.pendingQuestions,
      pendingBundle: next.pendingBundle,
      heldOffered: decision.type === "pass" && !heldChanged ? session.heldOffered : false,
    };
    if (decision.type === "pass" && !holdState.heldOffered) {
      const fresh = await deps.entitlements.snapshot();
      const offer = offerHeldQuestions(
        { service, answerable: canAnswer(working, service), pendingQuestions: next.pendingQuestions, pendingBundle: next.pendingBundle },
        fresh,
        pricing,
      );
      if (offer) {
        extras.push(heldOfferMessage(offer, fresh.creditRupees));
        holdState = { ...offer.next, heldOffered: true };
      }
    }

    if (extras.length > 0) {
      outText = [outText, ...extras].filter(Boolean).join("\n\n");
      input.onText?.(`\n\n${extras.join("\n\n")}`);
    }

    Object.assign(session, working, {
      service,
      pendingQuestions: holdState.pendingQuestions,
      pendingBundle: holdState.pendingBundle,
      heldOffered: holdState.heldOffered,
      questionsAnswered: session.questionsAnswered + answeredCount,
      usage,
      updatedAt: now().toISOString(),
    });
    await deps.store.save(session);

    return reply(
      {
        text: outText,
        decision: decision.type,
        answered: answeredCount,
        chargedRupees: reservation?.chargedRupees ?? 0,
        usage,
      },
      await deps.entitlements.snapshot(),
    );
  } catch (error) {
    await reservation?.release();
    if (input.signal?.aborted) throw error;
    console.error("[guru] turn failed", error);
    // Nothing from this turn is saved, so the transcript stays as it was.
    return reply({ text: TECHNICAL_ERROR, decision: "error" }, await deps.entitlements.snapshot());
  }
}

/** Runs the model with its tools until it produces a final text answer. */
async function runModelTurn(
  session: GuruSession,
  userMessage: ChatMessage,
  mode: TurnMode,
  deps: GuruDeps,
  now: () => Date,
  input: GuruTurnInput,
): Promise<{ text: string; usage: TokenUsage }> {
  const maxRounds = deps.maxToolRounds ?? DEFAULT_MAX_TOOL_ROUNDS;
  const system = buildSystemPrompt(session, mode, now());
  const messages: ChatMessage[] = [...session.messages, userMessage];
  let usage: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

  for (let round = 0; round < maxRounds; round++) {
    const result = await deps.provider.generate({
      system,
      messages: [...messages],
      tools: GURU_TOOL_DECLARATIONS,
      maxOutputTokens: deps.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
      signal: input.signal,
      onText: input.onText,
    });
    usage = addUsage(usage, result.usage);
    messages.push(result.message);

    if (result.toolCalls.length === 0) {
      const text = result.text.trim();
      if (!text) throw new Error(`Model returned no text (finish reason: ${result.finishReason}).`);
      session.messages = messages;
      return { text, usage };
    }

    const results = [];
    for (const call of result.toolCalls) {
      results.push(await executeTool(call, { geocoder: deps.geocoder, now, state: session.tools, signal: input.signal }));
    }
    messages.push({ role: "user", parts: results });
  }
  throw new Error(`Model did not finish within ${maxRounds} tool rounds.`);
}
