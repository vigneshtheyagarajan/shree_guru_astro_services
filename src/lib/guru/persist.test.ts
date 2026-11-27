import { describe, expect, it } from "vitest";
import { handleTurn } from "./conversation";
import { InMemoryEntitlements } from "./entitlements";
import { ScriptedProvider, textReply, toolReply } from "./llm/fake";
import { PrismaSessionStore, deserializeSession, serializeSession, type GuruSessionTable, type StoredSessionRow } from "./persist";
import { newSession } from "./session";

// A fake table that behaves like the database: only JSON survives.
function fakeTable(): GuruSessionTable & { rows: Map<string, StoredSessionRow> } {
  const rows = new Map<string, StoredSessionRow>();
  return {
    rows,
    async findUnique({ where }) {
      const r = rows.get(where.id);
      return r ? JSON.parse(JSON.stringify(r), (k, v) => (k === "createdAt" || k === "updatedAt" ? new Date(v) : v)) : null;
    },
    async upsert({ where, create, update }) {
      const existing = rows.get(where.id);
      const now = new Date("2026-11-27T06:30:00Z");
      const merged = existing ? { ...existing, ...update, state: JSON.parse(JSON.stringify(update.state)), updatedAt: now } : { ...create, state: JSON.parse(JSON.stringify(create.state)), createdAt: now, updatedAt: now };
      rows.set(where.id, merged as StoredSessionRow);
    },
  };
}

const chartTurn = toolReply(
  { name: "compute_vedic_chart", args: { label: "self", date: "1990-03-12", time: "10:30", timezone: "Asia/Kolkata", latitude: 9.9252, longitude: 78.1198, placeName: "Madurai" } },
  { name: "compute_numerology", args: { fullName: "Test Person", birthDate: "1990-03-12" } },
  { name: "draw_tarot", args: { spread: "single", question: "career" } },
);

describe("session persistence", () => {
  it("an empty session round-trips", () => {
    const s = newSession("a", "u1", new Date("2026-01-01T00:00:00Z"));
    const { row } = serializeSession(s);
    const back = deserializeSession({ ...row, createdAt: new Date(s.createdAt), updatedAt: new Date(s.updatedAt) });
    expect(back).toEqual(s);
  });

  it("a real conversation survives a trip through JSON, and the rebuilt chart is identical", async () => {
    const table = fakeTable();
    const store = new PrismaSessionStore(table);
    const provider = new ScriptedProvider(
      [chartTurn, textReply("Your first look...")],
      [{ kind: "data", questions: [], primaryIndex: 0, service: "vedic" }],
    );
    const deps = {
      provider,
      store,
      entitlements: new InMemoryEntitlements(),
      geocoder: { search: async () => [] },
      now: () => new Date("2026-11-27T06:30:00Z"),
      newId: () => "s1",
    };
    await handleTurn({ text: "my details", userId: "u1" }, deps);

    const before = [...table.rows.values()][0];
    expect(JSON.stringify(before.state).length).toBeLessThan(200_000); // charts are stored as inputs, not as computed objects
    expect((before.state as { charts: Record<string, unknown> }).charts.chart_1).toMatchObject({ input: { date: "1990-03-12" }, nodeType: "mean" });

    const loaded = (await store.load("s1"))!;
    expect(loaded.userId).toBe("u1");
    expect(loaded.service).toBe("vedic");
    expect(loaded.messages.length).toBeGreaterThan(2);
    expect(Object.keys(loaded.tools.numerology)).toHaveLength(1);
    expect(Object.keys(loaded.tools.tarot)).toHaveLength(1);

    // Same input -> same chart: key facts match a fresh build.
    const rebuilt = loaded.tools.charts.chart_1.chart;
    expect(rebuilt.ascendant.signName).toBeTruthy();
    expect(rebuilt.dashas[0].start).toBeInstanceOf(Date);
    const again = deserializeSession({ ...before, createdAt: new Date(), updatedAt: new Date() }).tools.charts.chart_1.chart;
    expect(again.planets.Moon.longitude).toBe(rebuilt.planets.Moon.longitude);

    // And a second turn on the loaded session works (reuses the stored chart).
    provider["generateSteps"].push(textReply("Hello again"));
    (provider as unknown as { structuredSteps: unknown[] }).structuredSteps.push({ kind: "chitchat", questions: [], primaryIndex: 0, service: "none" });
    const r = await handleTurn({ sessionId: "s1", text: "thanks", userId: "u1" }, deps);
    expect(r.text).toBe("Hello again");
    expect(provider.generateCalls.at(-1)!.system).toContain("chart_1 = self");
  });

  it("refuses unknown stored versions", () => {
    expect(() => deserializeSession({ id: "x", userId: null, service: null, state: { version: 9 }, questionsAnswered: 0, inputTokens: 0, outputTokens: 0, createdAt: new Date(), updatedAt: new Date() })).toThrow(/Unsupported/);
  });
});
