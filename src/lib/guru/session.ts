import type { ChatMessage, TokenUsage } from "./llm/types";
import { ZERO_USAGE } from "./llm/types";
import { emptyToolState, type GuruToolState } from "./tools";

export type ServiceKind = "vedic" | "tarot" | "numerology" | "matching";
export const SERVICES: readonly ServiceKind[] = ["vedic", "tarot", "numerology", "matching"];

export interface GuruSession {
  id: string;
  /** Who owns it (null for anonymous/dev sessions). */
  userId: string | null;
  /** The service the conversation is currently about, once known. */
  service: ServiceKind | null;
  /** Full transcript including tool turns (replayed to the model each turn). */
  messages: ChatMessage[];
  /** Computed charts, numerology results, tarot draws: verified facts. */
  tools: GuruToolState;
  /**
   * Questions the user asked before there was enough data to answer. They
   * are held, not charged, and offered back once the data is in.
   */
  pendingQuestions: string[];
  /** Whether the held questions have already been offered back to the user. */
  heldOffered: boolean;
  /** A multi-question message awaiting the user's price confirmation. */
  pendingBundle: { questions: string[]; costRupees: number } | null;
  /** Number of questions answered in this session (free or paid). */
  questionsAnswered: number;
  usage: TokenUsage;
  createdAt: string;
  updatedAt: string;
}

export function newSession(id: string, userId: string | null = null, now: Date = new Date()): GuruSession {
  return {
    id,
    userId,
    service: null,
    messages: [],
    tools: emptyToolState(),
    pendingQuestions: [],
    heldOffered: false,
    pendingBundle: null,
    questionsAnswered: 0,
    usage: { ...ZERO_USAGE },
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export interface SessionStore {
  load(id: string): Promise<GuruSession | null>;
  save(session: GuruSession): Promise<void>;
}

/** Process-local store for development, tests and evaluation runs. */
export class InMemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, GuruSession>();
  async load(id: string) {
    const s = this.sessions.get(id);
    return s ? structuredClone(s) : null;
  }
  async save(session: GuruSession) {
    this.sessions.set(session.id, structuredClone(session));
  }
}

/** Whether the data needed to answer a question about this service exists yet. */
export function canAnswer(session: GuruSession, service: ServiceKind | null): boolean {
  switch (service) {
    case "tarot":
      return true; // the draw happens in the reply itself
    case "vedic":
      return Object.keys(session.tools.charts).length >= 1;
    case "numerology":
      return Object.keys(session.tools.numerology).length >= 1;
    case "matching":
      return session.tools.matches.length >= 1;
    default:
      return false;
  }
}
