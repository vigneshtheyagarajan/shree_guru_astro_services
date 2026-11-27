import { planCost, type EntitlementSnapshot, type GuruPricing } from "./entitlements";
import type { ServiceKind } from "./session";

// The question gate. This is deliberately plain code, not the AI: what is
// answered and what is charged cannot be argued with, injected into, or
// "forgotten". The AI only ever sees the question(s) the gate approved.

export type MessageKind =
  | "question" // asks for a prediction / insight / answer about the user's life
  | "followup" // clarifies or explains an answer already given
  | "data" // supplies or corrects personal details, picks a service or spread
  | "chitchat" // greeting, thanks, questions about Guru or the app
  | "confirm" // says yes to something Guru just proposed
  | "decline" // says no to something Guru just proposed
  | "abuse"; // tries to override the rules, get free answers, or misuse the chat

export const MESSAGE_KINDS: readonly MessageKind[] = ["question", "followup", "data", "chitchat", "confirm", "decline", "abuse"];

export interface Classification {
  kind: MessageKind;
  /** Distinct questions (one topic and one time frame each), in the order asked. */
  questions: string[];
  /** Index into `questions` of the most important one. */
  primaryIndex: number;
  /** The service this message is about, when clear. */
  service: ServiceKind | null;
}

export interface GateSession {
  service: ServiceKind | null;
  /** Whether the data needed to answer exists for the effective service. */
  answerable: boolean;
  pendingQuestions: string[];
  pendingBundle: { questions: string[]; costRupees: number } | null;
}

export type GateDecision =
  /** Free turn: the AI replies normally (collecting details, explaining, chatting). */
  | { type: "pass" }
  /** Answer exactly these questions; hold `reserve` questions' worth of entitlement. */
  | { type: "answer"; questions: string[]; reserve: number }
  /** Free/low-credit user bundled questions: answer the primary one only. */
  | { type: "answer_primary_only"; primary: string; others: string[]; reserve: 1 }
  /** Multiple questions that cost money: show the price and wait for a yes. */
  | { type: "confirm_bundle"; questions: string[]; costRupees: number }
  /** Cannot cover the cost: say what it costs and what the balance is. */
  | { type: "payment_required"; questions: number; costRupees: number; creditRupees: number }
  /** Not answered at all. */
  | { type: "refuse"; reason: "abuse" | "too_long" };

export interface GateResult {
  decision: GateDecision;
  /** What the session's holding state becomes after this turn. */
  next: { pendingQuestions: string[]; pendingBundle: GateSession["pendingBundle"] };
}

export interface GateInput {
  classification: Classification;
  session: GateSession;
  snapshot: EntitlementSnapshot;
  pricing: GuruPricing;
}

/** Longest user message the chat will take, in characters. */
export const MAX_MESSAGE_CHARS = 1500;
/** Most distinct questions one message can be split into. */
export const MAX_QUESTIONS_PER_MESSAGE = 5;

export function decideGate({ classification, session, snapshot, pricing }: GateInput): GateResult {
  const keep = { pendingQuestions: session.pendingQuestions, pendingBundle: session.pendingBundle };
  const pass: GateResult = { decision: { type: "pass" }, next: keep };

  /** Question path shared by a fresh question, a confirmed held question, ... */
  const askPath = (questions: string[], primaryIndex = 0): GateResult => {
    const cleared = { pendingQuestions: [], pendingBundle: null };
    const n = questions.length;
    const plan = planCost(snapshot, pricing, n);

    if (n === 1) {
      return plan.affordable
        ? { decision: { type: "answer", questions, reserve: 1 }, next: cleared }
        : { decision: { type: "payment_required", questions: 1, costRupees: plan.rupees, creditRupees: snapshot.creditRupees }, next: cleared };
    }

    // Several questions in one message.
    if (n <= snapshot.freeRemaining) {
      return { decision: { type: "answer", questions, reserve: n }, next: cleared };
    }
    if (plan.affordable) {
      return {
        decision: { type: "confirm_bundle", questions, costRupees: plan.rupees },
        next: { pendingQuestions: [], pendingBundle: { questions, costRupees: plan.rupees } },
      };
    }
    if (snapshot.freeRemaining >= 1) {
      const primary = questions[Math.min(Math.max(primaryIndex, 0), n - 1)];
      return {
        decision: { type: "answer_primary_only", primary, others: questions.filter((q) => q !== primary), reserve: 1 },
        next: cleared,
      };
    }
    return {
      decision: { type: "payment_required", questions: n, costRupees: plan.rupees, creditRupees: snapshot.creditRupees },
      next: cleared,
    };
  };

  const { kind } = classification;
  const questions = classification.questions.slice(0, MAX_QUESTIONS_PER_MESSAGE).filter((q) => q.trim());

  switch (kind) {
    case "abuse":
      return { decision: { type: "refuse", reason: "abuse" }, next: keep };

    case "followup":
    case "data":
    case "chitchat":
      return pass;

    case "decline":
      return { decision: { type: "pass" }, next: { pendingQuestions: [], pendingBundle: null } };

    case "confirm": {
      if (session.pendingBundle) {
        const bundle = session.pendingBundle;
        const plan = planCost(snapshot, pricing, bundle.questions.length);
        if (plan.affordable) {
          return {
            decision: { type: "answer", questions: bundle.questions, reserve: bundle.questions.length },
            next: { pendingQuestions: [], pendingBundle: null },
          };
        }
        return {
          decision: { type: "payment_required", questions: bundle.questions.length, costRupees: plan.rupees, creditRupees: snapshot.creditRupees },
          next: keep,
        };
      }
      if (session.pendingQuestions.length > 0 && session.answerable) {
        return askPath(session.pendingQuestions);
      }
      return pass;
    }

    case "question": {
      const asked = questions.length > 0 ? questions : [];
      if (asked.length === 0) return pass;
      // Not enough data yet to answer: hold the question (free, uncharged) and
      // offer it back once the chart or numbers exist.
      if (!session.answerable) {
        return { decision: { type: "pass" }, next: { pendingQuestions: asked, pendingBundle: null } };
      }
      return askPath(asked, classification.primaryIndex);
    }
  }
}

/** Fallback when the classifier is unavailable: err on the side of treating a message as one question. */
export function heuristicClassify(text: string, service: ServiceKind | null): Classification {
  const trimmed = text.trim();
  const marks = (trimmed.match(/\?/g) ?? []).length;
  const looksLikeQuestion =
    marks > 0 || (/^(will|when|should|how|what|why|which|can|could|is|am|does|do)\b/i.test(trimmed) && trimmed.length >= 20);
  if (!looksLikeQuestion) return { kind: "data", questions: [], primaryIndex: 0, service };
  // Split on question marks only when there are several, otherwise keep it whole.
  const parts = marks > 1 ? trimmed.split("?").map((p) => p.trim()).filter((p) => p.length > 3).map((p) => `${p}?`) : [trimmed];
  const questions = parts.slice(0, MAX_QUESTIONS_PER_MESSAGE);
  return { kind: "question", questions, primaryIndex: 0, service };
}

export interface HeldOffer {
  questions: string[];
  /** True when the free allowance covers every held question. */
  free: boolean;
  costRupees: number;
  affordable: boolean;
  /** Several questions, only the free allowance to spend: the user picks which one to take up. */
  choose: boolean;
  perQuestionRupees: number;
  /** Holding state once the offer has been made. */
  next: GateResult["next"];
}

/**
 * Once the data to answer exists, questions held from earlier are offered
 * back. A multi-question offer that costs money becomes a pending bundle, so
 * the user's "yes" to the price they were just shown is the confirmation.
 */
export function offerHeldQuestions(session: GateSession, snapshot: EntitlementSnapshot, pricing: GuruPricing): HeldOffer | null {
  const questions = session.pendingQuestions;
  if (questions.length === 0 || !session.answerable) return null;
  const plan = planCost(snapshot, pricing, questions.length);
  const free = plan.rupees === 0;
  if (questions.length > 1 && !free && plan.affordable) {
    return {
      questions,
      free,
      costRupees: plan.rupees,
      affordable: true,
      choose: false,
      perQuestionRupees: pricing.pricePerQuestionRupees,
      next: { pendingQuestions: [], pendingBundle: { questions, costRupees: plan.rupees } },
    };
  }
  const choose = questions.length > 1 && !plan.affordable && snapshot.freeRemaining >= 1;
  return {
    questions,
    free,
    costRupees: plan.rupees,
    affordable: plan.affordable,
    choose,
    perQuestionRupees: pricing.pricePerQuestionRupees,
    // When the user picks one, that choice arrives as a fresh question.
    next: { pendingQuestions: choose ? [] : questions, pendingBundle: null },
  };
}
