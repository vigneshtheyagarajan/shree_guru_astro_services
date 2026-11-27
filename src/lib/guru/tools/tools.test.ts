import { describe, expect, it, vi } from "vitest";
import { GURU_TOOL_DECLARATIONS, emptyToolState, executeTool, type GuruToolContext } from "./index";
import type { Geocoder } from "./geocode";
import type { ToolCallPart } from "../llm/types";

const madurai = { name: "Madurai", region: "Tamil Nadu", country: "India", latitude: 9.919, longitude: 78.11953, timezone: "Asia/Kolkata" };
const geocoder: Geocoder = { search: vi.fn(async (q: string) => (q.toLowerCase().includes("madurai") ? [madurai] : [])) };

function ctx(overrides: Partial<GuruToolContext> = {}): GuruToolContext {
  return { geocoder, now: () => new Date("1950-01-01T06:30:00Z"), state: emptyToolState(), ...overrides };
}
let n = 0;
const call = (name: string, args: Record<string, unknown>): ToolCallPart => ({ type: "tool_call", id: `c${++n}`, name, args });

const independence = { date: "1947-08-15", time: "00:00", timezone: "Asia/Kolkata", latitude: 28.6139, longitude: 77.209 };

describe("tool declarations", () => {
  it("have unique names and object-typed JSON schemas", () => {
    const names = GURU_TOOL_DECLARATIONS.map((d) => d.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual(["lookup_birth_place", "compute_vedic_chart", "get_transits", "get_transit_timeline", "match_kundli", "compute_numerology", "draw_tarot"]);
    for (const d of GURU_TOOL_DECLARATIONS) {
      expect(d.description.length).toBeGreaterThan(40);
      expect(d.parameters.type).toBe("object");
    }
  });
});

describe("lookup_birth_place", () => {
  it("returns coordinates and time zone candidates", async () => {
    const r = await executeTool(call("lookup_birth_place", { query: "Madurai" }), ctx());
    expect(r.isError).toBeUndefined();
    expect((r.result as { candidates: unknown[] }).candidates).toEqual([madurai]);
  });
  it("says so when nothing matches", async () => {
    const r = await executeTool(call("lookup_birth_place", { query: "Atlantis" }), ctx());
    expect((r.result as { candidates: unknown[]; note: string }).candidates).toEqual([]);
    expect((r.result as { note: string }).note).toMatch(/No match/);
  });
  it("reports missing input as a recoverable error", async () => {
    const r = await executeTool(call("lookup_birth_place", {}), ctx());
    expect(r.isError).toBe(true);
    expect((r.result as { error: string }).error).toMatch(/"query" is required/);
  });
});

describe("compute_vedic_chart", () => {
  it("returns a compact chart summary with the running dasha", async () => {
    const c = ctx();
    const r = await executeTool(call("compute_vedic_chart", { ...independence, label: "self", placeName: "New Delhi" }), c);
    const s = r.result as ReturnType<typeof import("./index").summarizeChart>;
    expect(s.chartId).toBe("chart_1");
    expect(s.lagna.sign).toBe("Taurus");
    expect(s.planets).toHaveLength(9);
    expect(s.houses).toHaveLength(12);
    expect(s.birth.place).toBe("New Delhi");
    expect(s.dasha.running?.mahadasha.lord).toBe("Saturn"); // as of 1950, Moon in Pushya
    expect(s.dasha.antardashasInRunningMahadasha.length).toBeGreaterThan(5);
    expect(s.dasha.upcomingMahadashas[0].lord).toBe("Mercury");
    expect(c.state.charts.chart_1.chart.ascendant.signName).toBe("Taurus");
  });

  it("keeps ids stable for the same birth data and issues a new id for different data", async () => {
    const c = ctx();
    const a = await executeTool(call("compute_vedic_chart", independence), c);
    const again = await executeTool(call("compute_vedic_chart", independence), c);
    const other = await executeTool(call("compute_vedic_chart", { ...independence, time: "06:00" }), c);
    expect((a.result as { chartId: string }).chartId).toBe("chart_1");
    expect((again.result as { chartId: string }).chartId).toBe("chart_1");
    expect((other.result as { chartId: string }).chartId).toBe("chart_2");
    expect(Object.keys(c.state.charts)).toEqual(["chart_1", "chart_2"]);
  });

  it("accepts numeric strings for coordinates (models sometimes quote numbers)", async () => {
    const r = await executeTool(call("compute_vedic_chart", { ...independence, latitude: "28.6139", longitude: "77.209" }), ctx());
    expect(r.isError).toBeUndefined();
  });

  it("returns engine validation errors in plain words", async () => {
    const r = await executeTool(call("compute_vedic_chart", { ...independence, date: "1947-02-30" }), ctx());
    expect(r.isError).toBe(true);
    expect((r.result as { error: string }).error).toMatch(/not valid/i);
    const bad = await executeTool(call("compute_vedic_chart", { ...independence, timezone: "Nowhere/Land" }), ctx());
    expect((bad.result as { error: string }).error).toMatch(/Unknown time zone/);
    const missing = await executeTool(call("compute_vedic_chart", { date: "1947-08-15" }), ctx());
    expect((missing.result as { error: string }).error).toMatch(/required/);
  });
});

describe("get_transits", () => {
  it("needs a chart first", async () => {
    const r = await executeTool(call("get_transits", {}), ctx());
    expect(r.isError).toBe(true);
    expect((r.result as { error: string }).error).toMatch(/Compute the birth chart first/);
  });

  it("returns positions and Saturn/Jupiter status for the latest chart, for a given date", async () => {
    const c = ctx();
    await executeTool(call("compute_vedic_chart", independence), c);
    const r = await executeTool(call("get_transits", { date: "2024-06-01" }), c);
    const t = r.result as { asOf: string; positions: { graha: string; sign: string }[]; saturn: { ashtamaShani: boolean } };
    expect(t.asOf).toBe("2024-06-01");
    expect(t.positions.find((p) => p.graha === "Saturn")!.sign).toBe("Aquarius");
    expect(t.saturn.ashtamaShani).toBe(true); // Cancer Moon, Saturn in Aquarius
  });

  it("rejects unknown charts, malformed dates and dates far from today", async () => {
    const c = ctx();
    await executeTool(call("compute_vedic_chart", independence), c);
    expect(((await executeTool(call("get_transits", { chartId: "chart_9" }), c)).result as { error: string }).error).toMatch(/Unknown chartId/);
    expect(((await executeTool(call("get_transits", { date: "June 1" }), c)).result as { error: string }).error).toMatch(/YYYY-MM-DD/);
    expect(((await executeTool(call("get_transits", { date: "2300-01-01" }), c)).result as { error: string }).error).toMatch(/within 100 years/);
  });
});

describe("match_kundli", () => {
  it("scores two computed charts and returns doshas and cautions", async () => {
    const c = ctx();
    await executeTool(call("compute_vedic_chart", { ...independence, label: "groom" }), c);
    await executeTool(call("compute_vedic_chart", { date: "1990-06-15", time: "04:20", timezone: "Asia/Kolkata", latitude: 13.0827, longitude: 80.2707, label: "bride" }), c);
    const r = await executeTool(call("match_kundli", { groomChartId: "chart_1", brideChartId: "chart_2" }), c);
    const m = r.result as { total: number; outOf: number; koota: unknown[]; doshas: object; cautions: string[]; kujaDosha: { groom: object; bride: object } };
    expect(m.outOf).toBe(36);
    expect(m.koota).toHaveLength(8);
    expect(m.total).toBeGreaterThanOrEqual(0);
    expect(m.total).toBeLessThanOrEqual(36);
    expect(m.kujaDosha.groom).toBeDefined();
    expect(m.kujaDosha.bride).toBeDefined();
  });

  it("names the known charts when an id is wrong", async () => {
    const c = ctx();
    await executeTool(call("compute_vedic_chart", independence), c);
    const r = await executeTool(call("match_kundli", { groomChartId: "chart_1", brideChartId: "chart_7" }), c);
    expect(r.isError).toBe(true);
    expect((r.result as { error: string }).error).toMatch(/chart_7.*Known charts: chart_1/);
  });
});

describe("compute_numerology", () => {
  it("returns both systems", async () => {
    const r = await executeTool(call("compute_numerology", { fullName: "John", birthDate: "1990-06-15" }), ctx());
    const n = r.result as { pythagorean: { lifePath: { number: number } }; indian: { mulank: number } };
    expect(n.pythagorean.lifePath.number).toBe(4);
    expect(n.indian.mulank).toBe(6);
  });
  it("explains bad input", async () => {
    const r = await executeTool(call("compute_numerology", { fullName: "குமார்", birthDate: "1990-06-15" }), ctx());
    expect(r.isError).toBe(true);
  });
});

describe("draw_tarot", () => {
  it("returns the same cards if the same question is asked again (no re-drawing)", async () => {
    const c = ctx();
    const first = await executeTool(call("draw_tarot", { spread: "three-card", question: "Will my job change?" }), c);
    const again = await executeTool(call("draw_tarot", { spread: "three-card", question: "  will my JOB change? " }), c);
    expect(again.result).toEqual(first.result);
    expect((first.result as { cards: unknown[] }).cards).toHaveLength(3);
    expect(Object.keys(c.state.tarot)).toHaveLength(1);
  });
  it("rejects an unknown spread", async () => {
    const r = await executeTool(call("draw_tarot", { spread: "horseshoe", question: "q" }), ctx());
    expect(r.isError).toBe(true);
    expect((r.result as { error: string }).error).toMatch(/spread must be one of/);
  });
});

describe("executeTool safety", () => {
  it("reports an unknown tool", async () => {
    const r = await executeTool(call("delete_everything", {}), ctx());
    expect(r.isError).toBe(true);
  });

  it("does not leak internal error details to the model", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const broken: Geocoder = { search: async () => { throw new Error("ECONNREFUSED 10.0.0.5:5432 secret-host"); } };
    const r = await executeTool(call("lookup_birth_place", { query: "Madurai" }), ctx({ geocoder: broken }));
    expect(r.isError).toBe(true);
    expect(JSON.stringify(r.result)).not.toMatch(/ECONNREFUSED|secret-host/);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("get_transit_timeline", () => {
  const now = () => new Date("2025-01-01T06:30:00Z");

  it("needs a chart first", async () => {
    const r = await executeTool(call("get_transit_timeline", {}), ctx({ now }));
    expect(r.isError).toBe(true);
  });

  it("lists dated ingresses with houses from the natal Moon and lagna", async () => {
    const c = ctx({ now });
    await executeTool(call("compute_vedic_chart", independence), c);
    const r = await executeTool(call("get_transit_timeline", { years: 2 }), c);
    const t = r.result as { natalMoonSign: string; events: { date: string; graha: string; toSign: string; direction: string; houseFromMoon: number }[]; from: string; to: string };
    expect(t.from).toBe("2025-01-01");
    expect(t.natalMoonSign).toBe("Cancer");
    const saturn = t.events.find((e) => e.graha === "Saturn" && e.toSign === "Pisces")!;
    expect(saturn.direction).toBe("forward");
    expect(saturn.houseFromMoon).toBe(9); // Pisces is the 9th from Cancer
    expect(Math.abs(Date.parse(saturn.date) - Date.parse("2025-03-29")) / 86_400_000).toBeLessThanOrEqual(1);
  });

  it("clamps the horizon to 1-8 years and rejects unknown charts", async () => {
    const c = ctx({ now });
    await executeTool(call("compute_vedic_chart", independence), c);
    const r = await executeTool(call("get_transit_timeline", { years: 50 }), c);
    expect((r.result as { to: string }).to.slice(0, 4)).toBe("2033");
    expect(((await executeTool(call("get_transit_timeline", { chartId: "chart_9" }), c)).result as { error: string }).error).toMatch(/Unknown chartId/);
  });
});
