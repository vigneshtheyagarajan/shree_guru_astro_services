import { buildVedicChart } from "./astro/chart";
import type { BirthInput } from "./astro/time";
import type { NodeType } from "./astro/ephemeris";
import type { ChatMessage, TokenUsage } from "./llm/types";
import type { GuruSession, ServiceKind, SessionStore } from "./session";
import type { GuruToolState } from "./tools";
import type { NumerologyResult } from "./numerology";
import type { TarotReading } from "./tarot";

// A session is stored as JSON. Charts are NOT stored as computed objects
// (they hold Dates and are large): only their birth inputs and settings are,
// and the deterministic engine rebuilds the identical chart on load.

export interface StoredChart {
  label: string;
  input: BirthInput;
  nodeType: NodeType;
  dashaYearDays: number;
}

export interface StoredSessionState {
  version: 1;
  messages: ChatMessage[];
  charts: Record<string, StoredChart>;
  tarot: Record<string, TarotReading>;
  numerology: Record<string, NumerologyResult>;
  matches: string[];
  pendingQuestions: string[];
  heldOffered: boolean;
  pendingBundle: GuruSession["pendingBundle"];
}

export interface StoredSessionRow {
  id: string;
  userId: string | null;
  service: string | null;
  state: unknown;
  questionsAnswered: number;
  inputTokens: number;
  outputTokens: number;
  createdAt: Date;
  updatedAt: Date;
}

export function serializeSession(session: GuruSession): { row: Omit<StoredSessionRow, "createdAt" | "updatedAt">; state: StoredSessionState } {
  const charts: Record<string, StoredChart> = {};
  for (const [id, entry] of Object.entries(session.tools.charts)) {
    charts[id] = { label: entry.label, input: entry.chart.input, nodeType: entry.chart.settings.nodeType, dashaYearDays: entry.chart.settings.dashaYearDays };
  }
  const state: StoredSessionState = {
    version: 1,
    messages: session.messages,
    charts,
    tarot: session.tools.tarot,
    numerology: session.tools.numerology,
    matches: session.tools.matches,
    pendingQuestions: session.pendingQuestions,
    heldOffered: session.heldOffered,
    pendingBundle: session.pendingBundle,
  };
  return {
    state,
    row: {
      id: session.id,
      userId: session.userId,
      service: session.service,
      state: state as unknown,
      questionsAnswered: session.questionsAnswered,
      inputTokens: session.usage.inputTokens,
      outputTokens: session.usage.outputTokens,
    },
  };
}

export function deserializeSession(row: StoredSessionRow): GuruSession {
  const state = row.state as StoredSessionState;
  if (!state || state.version !== 1) throw new Error(`Unsupported Guru session state in ${row.id}.`);

  const charts: GuruToolState["charts"] = {};
  for (const [id, c] of Object.entries(state.charts)) {
    charts[id] = { label: c.label, chart: buildVedicChart(c.input, { nodeType: c.nodeType, yearDays: c.dashaYearDays }) };
  }
  const usage: TokenUsage = {
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    totalTokens: row.inputTokens + row.outputTokens,
  };
  return {
    id: row.id,
    userId: row.userId,
    service: (row.service as ServiceKind | null) ?? null,
    messages: state.messages,
    tools: { charts, tarot: state.tarot, numerology: state.numerology, matches: state.matches },
    pendingQuestions: state.pendingQuestions,
    heldOffered: state.heldOffered,
    pendingBundle: state.pendingBundle,
    questionsAnswered: row.questionsAnswered,
    usage,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** The few Prisma calls the store needs; lets tests use a fake and keeps this file free of the generated client. */
export interface GuruSessionTable {
  findUnique(args: { where: { id: string } }): Promise<StoredSessionRow | null>;
  upsert(args: {
    where: { id: string };
    create: Omit<StoredSessionRow, "createdAt" | "updatedAt">;
    update: Omit<StoredSessionRow, "id" | "createdAt" | "updatedAt">;
  }): Promise<unknown>;
}

export class PrismaSessionStore implements SessionStore {
  constructor(private readonly table: GuruSessionTable) {}

  async load(id: string): Promise<GuruSession | null> {
    const row = await this.table.findUnique({ where: { id } });
    return row ? deserializeSession(row) : null;
  }

  async save(session: GuruSession): Promise<void> {
    const { row } = serializeSession(session);
    const { id, ...update } = row;
    await this.table.upsert({ where: { id }, create: row, update });
  }
}
