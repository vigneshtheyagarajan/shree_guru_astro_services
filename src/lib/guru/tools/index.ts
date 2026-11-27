import { buildVedicChart, currentDasha, type VedicChart } from "../astro/chart";
import { formatDms } from "../astro/format";
import { kujaDosha } from "../astro/kuja";
import { ashtakootaFromCharts } from "../astro/matching";
import { transitsFor, transitTimeline } from "../astro/transit";
import { GuruInputError, type BirthInput } from "../astro/time";
import type { ToolCallPart, ToolDeclaration, ToolResultPart } from "../llm/types";
import { computeNumerology, type NumerologyResult } from "../numerology";
import { SPREADS, drawTarot, type SpreadName, type TarotReading } from "../tarot";
import type { Geocoder } from "./geocode";

// The model never computes a position, score, number or card. It calls
// these tools, and what they return is the only source of chart facts it
// may state. State (computed charts, tarot draws) lives in the session so
// it is consistent across turns and can be audited later.

export interface GuruToolState {
  charts: Record<string, { label: string; chart: VedicChart }>;
  tarot: Record<string, TarotReading>;
  numerology: Record<string, NumerologyResult>;
  /** Keys ("groomChartId|brideChartId") of the matches that have been run. */
  matches: string[];
}
export const emptyToolState = (): GuruToolState => ({ charts: {}, tarot: {}, numerology: {}, matches: [] });

export interface GuruToolContext {
  geocoder: Geocoder;
  now: () => Date;
  state: GuruToolState;
  signal?: AbortSignal;
}

export interface GuruTool {
  declaration: ToolDeclaration;
  run(args: Record<string, unknown>, ctx: GuruToolContext): Promise<unknown>;
}

// ---- argument helpers -------------------------------------------------------

function str(args: Record<string, unknown>, key: string, { optional = false } = {}): string {
  const value = args[key];
  if (typeof value === "string" && value.trim()) return value.trim();
  if (optional && (value === undefined || value === null || value === "")) return "";
  throw new GuruInputError(`"${key}" is required.`);
}

function num(args: Record<string, unknown>, key: string): number {
  const value = args[key];
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n === "number" && Number.isFinite(n)) return n;
  throw new GuruInputError(`"${key}" must be a number.`);
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

// ---- chart summary (compact, model-facing) ----------------------------------

export function summarizeChart(chartId: string, label: string, chart: VedicChart, now: Date, placeName?: string) {
  const running = currentDasha(chart, now);
  const period = (p: { lord: string; start: Date; end: Date }) => ({ lord: p.lord, from: isoDate(p.start), to: isoDate(p.end) });

  const currentMahadasha = running ? chart.dashas.find((d) => d.start.getTime() === running.mahadasha.start.getTime()) : undefined;
  const futureMahadashas = chart.dashas.filter((d) => d.start.getTime() > now.getTime()).slice(0, 4);

  return {
    chartId,
    label,
    birth: {
      place: placeName ?? null,
      date: chart.input.date,
      time: chart.input.time,
      timezone: chart.input.timezone,
      utc: chart.utc,
      latitude: chart.input.latitude,
      longitude: chart.input.longitude,
    },
    settings: chart.settings,
    lagna: {
      sign: chart.ascendant.signName,
      degree: formatDms(chart.ascendant.degreeInSign),
      nakshatra: chart.ascendant.nakshatraName,
      pada: chart.ascendant.pada,
      navamsaSign: chart.ascendant.navamsaSignName,
    },
    moon: chart.moon,
    planets: Object.values(chart.planets).map((p) => ({
      graha: p.graha,
      sign: p.signName,
      degree: formatDms(p.degreeInSign),
      nakshatra: p.nakshatraName,
      pada: p.pada,
      house: p.house,
      retrograde: p.retrograde,
      dignity: p.dignity,
      navamsaSign: p.navamsaSignName,
    })),
    houses: chart.houses.map((h) => ({
      house: h.house,
      sign: h.signName,
      lord: h.lord,
      lordSitsInHouse: h.lordInHouse,
      occupants: h.occupants,
    })),
    conjunctions: chart.conjunctions,
    aspects: chart.aspects.map((a) => `${a.from} aspects ${a.to}`),
    kujaDosha: (() => {
      const k = kujaDosha(chart, "south");
      return {
        marsHouseFromLagna: k.fromLagna.house,
        marsHouseFromMoon: k.fromMoon.house,
        present: k.present,
        note: k.note,
      };
    })(),
    dasha: {
      asOf: isoDate(now),
      running: running
        ? { mahadasha: period(running.mahadasha), antardasha: period(running.antardasha), pratyantardasha: period(running.pratyantardasha) }
        : null,
      antardashasInRunningMahadasha: currentMahadasha ? currentMahadasha.antardashas.map(period) : [],
      upcomingMahadashas: futureMahadashas.map(period),
    },
    warnings: chart.warnings,
  };
}

// ---- tools ------------------------------------------------------------------

const SPREAD_NAMES = Object.keys(SPREADS) as SpreadName[];

export const GURU_TOOLS: GuruTool[] = [
  {
    declaration: {
      name: "lookup_birth_place",
      description:
        "Look up a place name to get its latitude, longitude and IANA time zone. Always use this to turn a birth place the user typed into coordinates; never guess coordinates or time zones. If several different places could match, show the user the options and ask which one before using any of them.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "The place as the user wrote it, e.g. 'Madurai' or 'Aurangabad, Maharashtra'." } },
        required: ["query"],
      },
    },
    async run(args, ctx) {
      const candidates = await ctx.geocoder.search(str(args, "query"), ctx.signal);
      return {
        candidates: candidates.map((c) => ({
          name: c.name,
          region: c.region ?? null,
          country: c.country ?? null,
          latitude: c.latitude,
          longitude: c.longitude,
          timezone: c.timezone,
        })),
        note: candidates.length === 0 ? "No match. Ask the user for the nearest larger town or to spell the place differently." : "If more than one candidate is plausible, ask the user to confirm which one.",
      };
    },
  },
  {
    declaration: {
      name: "compute_vedic_chart",
      description:
        "Compute a Vedic (sidereal, Lahiri) birth chart with planetary positions, houses, nakshatras, current dasha and Kuja dosha. Call it only once you have the user's confirmed date, time and place of birth (get latitude, longitude and timezone from lookup_birth_place). Returns a chartId to use with other tools. Every chart fact you state must come from this result.",
      parameters: {
        type: "object",
        properties: {
          label: { type: "string", description: "Whose chart this is, e.g. 'self', 'groom', 'bride', 'partner'." },
          date: { type: "string", description: "Date of birth, YYYY-MM-DD." },
          time: { type: "string", description: "Local time of birth, 24-hour HH:mm." },
          timezone: { type: "string", description: "IANA time zone of the birth place, e.g. Asia/Kolkata." },
          latitude: { type: "number" },
          longitude: { type: "number" },
          placeName: { type: "string", description: "Birth place as confirmed with the user." },
        },
        required: ["date", "time", "timezone", "latitude", "longitude"],
      },
    },
    async run(args, ctx) {
      const input: BirthInput = {
        date: str(args, "date"),
        time: str(args, "time"),
        timezone: str(args, "timezone"),
        latitude: num(args, "latitude"),
        longitude: num(args, "longitude"),
      };
      const label = str(args, "label", { optional: true }) || "self";
      const placeName = str(args, "placeName", { optional: true }) || undefined;

      // Same birth data again: return the existing chart, so ids stay stable.
      for (const [id, entry] of Object.entries(ctx.state.charts)) {
        const i = entry.chart.input;
        if (i.date === input.date && i.time === input.time && i.timezone === input.timezone && i.latitude === input.latitude && i.longitude === input.longitude) {
          if (entry.label !== label && label !== "self") entry.label = label;
          return summarizeChart(id, entry.label, entry.chart, ctx.now(), placeName);
        }
      }

      const chart = buildVedicChart(input);
      const chartId = `chart_${Object.keys(ctx.state.charts).length + 1}`;
      ctx.state.charts[chartId] = { label, chart };
      return summarizeChart(chartId, label, chart, ctx.now(), placeName);
    },
  },
  {
    declaration: {
      name: "get_transits",
      description:
        "Get where the planets are now (or on a given date) relative to a computed birth chart: each planet's sign, retrograde status and house from the lagna and from the Moon, plus Sade Sati, Ashtama Shani and Jupiter's transit position. Use this together with the running dasha for any question about timing or the current period.",
      parameters: {
        type: "object",
        properties: {
          chartId: { type: "string", description: "Which chart; defaults to the most recent one." },
          date: { type: "string", description: "YYYY-MM-DD to look at a past or future date; omit for today." },
        },
      },
    },
    async run(args, ctx) {
      const ids = Object.keys(ctx.state.charts);
      if (ids.length === 0) throw new GuruInputError("No chart has been computed yet. Compute the birth chart first.");
      const chartId = str(args, "chartId", { optional: true }) || ids[ids.length - 1];
      const entry = ctx.state.charts[chartId];
      if (!entry) throw new GuruInputError(`Unknown chartId "${chartId}". Known charts: ${ids.join(", ")}.`);

      const dateArg = str(args, "date", { optional: true });
      let at = ctx.now();
      if (dateArg) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateArg) || Number.isNaN(Date.parse(`${dateArg}T06:30:00Z`))) throw new GuruInputError("date must be a real date in YYYY-MM-DD format.");
        at = new Date(`${dateArg}T06:30:00Z`); // noon IST
        const years = Math.abs(at.getTime() - ctx.now().getTime()) / (365.25 * 86_400_000);
        if (years > 100) throw new GuruInputError("Please choose a date within 100 years of today.");
      }
      const t = transitsFor(entry.chart, at);
      return {
        chartId,
        asOf: isoDate(at),
        positions: Object.values(t.positions).map((p) => ({
          graha: p.graha,
          sign: p.signName,
          degree: formatDms(p.degreeInSign),
          nakshatra: p.nakshatra,
          retrograde: p.retrograde,
          houseFromLagna: p.houseFromLagna,
          houseFromMoon: p.houseFromMoon,
        })),
        saturn: t.saturn,
        jupiter: t.jupiter,
      };
    },
  },
  {
    declaration: {
      name: "get_transit_timeline",
      description:
        "List every future sign change (ingress) of Jupiter, Saturn, Rahu and Ketu over the coming years, with the exact date, the house it lands in from the birth lagna and from the Moon, and the Sade Sati phase for Saturn. Use this for ANY statement about when a slow planet will enter, leave or return to a sign or house, when Sade Sati begins or ends, or when Jupiter will bless a house. Never state such a date from memory. Note that Saturn and Jupiter can slip back into the previous sign while retrograde; report that when it matters.",
      parameters: {
        type: "object",
        properties: {
          chartId: { type: "string", description: "Which chart; defaults to the most recent one." },
          years: { type: "number", description: "How many years ahead, 1 to 8. Default 3." },
        },
      },
    },
    async run(args, ctx) {
      const ids = Object.keys(ctx.state.charts);
      if (ids.length === 0) throw new GuruInputError("No chart has been computed yet. Compute the birth chart first.");
      const chartId = str(args, "chartId", { optional: true }) || ids[ids.length - 1];
      const entry = ctx.state.charts[chartId];
      if (!entry) throw new GuruInputError(`Unknown chartId "${chartId}". Known charts: ${ids.join(", ")}.`);
      const yearsArg = args.years === undefined || args.years === null || args.years === "" ? 3 : num(args, "years");
      const years = Math.min(Math.max(yearsArg, 1), 8);
      const from = ctx.now();
      return {
        chartId,
        from: isoDate(from),
        to: isoDate(new Date(from.getTime() + years * 365.25 * 86_400_000)),
        natalMoonSign: entry.chart.planets.Moon.signName,
        lagnaSign: entry.chart.ascendant.signName,
        events: transitTimeline(entry.chart, from, years),
        note: "Dates are the day the planet is first in the new sign (UTC noon sampling). A 'retrograde' event is a slip back into the previous sign.",
      };
    },
  },
  {
    declaration: {
      name: "match_kundli",
      description:
        "Ashtakoota (36-point) marriage compatibility between two already computed charts, plus Kuja dosha for both. The traditional tables are oriented groom/bride; for a couple where that does not apply, ask which partner to treat as the groom, or call it twice with the roles swapped. Report the score, the doshas and the cautions exactly as returned, including any note that published sources differ.",
      parameters: {
        type: "object",
        properties: {
          groomChartId: { type: "string" },
          brideChartId: { type: "string" },
        },
        required: ["groomChartId", "brideChartId"],
      },
    },
    async run(args, ctx) {
      const find = (key: string) => {
        const id = str(args, key);
        const entry = ctx.state.charts[id];
        if (!entry) throw new GuruInputError(`Unknown chartId "${id}". Compute that person's chart first. Known charts: ${Object.keys(ctx.state.charts).join(", ") || "none"}.`);
        return entry.chart;
      };
      const groom = find("groomChartId");
      const bride = find("brideChartId");
      const result = ashtakootaFromCharts(groom, bride);
      const matchKey = `${str(args, "groomChartId")}|${str(args, "brideChartId")}`;
      if (!ctx.state.matches.includes(matchKey)) ctx.state.matches.push(matchKey);
      const kuja = (c: VedicChart) => {
        const k = kujaDosha(c, "south");
        return { marsHouseFromLagna: k.fromLagna.house, marsHouseFromMoon: k.fromMoon.house, present: k.present };
      };
      return {
        groomMoon: result.boyMoon,
        brideMoon: result.girlMoon,
        total: result.total,
        outOf: result.max,
        band: result.band,
        koota: result.koota.map((k) => ({ koota: k.koota, score: k.score, outOf: k.max, groom: k.boy, bride: k.girl, detail: k.detail, sourcesDiffer: k.disputed })),
        doshas: result.doshas,
        cautions: result.cautions,
        kujaDosha: { groom: kuja(groom), bride: kuja(bride) },
      };
    },
  },
  {
    declaration: {
      name: "compute_numerology",
      description:
        "Compute numerology numbers from a full name and date of birth, in both the Pythagorean system (life path, expression, soul urge, personality) and the Indian/Chaldean system (mulank, bhagyank, name number). Never calculate numerology yourself.",
      parameters: {
        type: "object",
        properties: {
          fullName: { type: "string", description: "Full name in English letters, as the user wants it analysed." },
          birthDate: { type: "string", description: "YYYY-MM-DD" },
        },
        required: ["fullName", "birthDate"],
      },
    },
    async run(args, ctx) {
      const result = computeNumerology({ fullName: str(args, "fullName"), birthDate: str(args, "birthDate") });
      ctx.state.numerology[`${result.name}|${result.birthDate}`] = result;
      return result;
    },
  },
  {
    declaration: {
      name: "draw_tarot",
      description:
        "Draw tarot cards for a question using a fair random draw. You must never choose or imagine cards yourself. Asking again for the same question and spread returns the same cards, so a reading cannot be re-drawn until it looks better. Available spreads: single, three-card (past/present/future), celtic-cross.",
      parameters: {
        type: "object",
        properties: {
          spread: { type: "string", enum: SPREAD_NAMES },
          question: { type: "string", description: "The user's question for this reading." },
        },
        required: ["spread", "question"],
      },
    },
    async run(args, ctx) {
      const spread = str(args, "spread") as SpreadName;
      if (!SPREAD_NAMES.includes(spread)) throw new GuruInputError(`spread must be one of: ${SPREAD_NAMES.join(", ")}.`);
      const question = str(args, "question");
      const key = `${spread}::${question.toLowerCase().replace(/\s+/g, " ")}`;
      const reading = (ctx.state.tarot[key] ??= drawTarot({ spread, question }));
      return {
        spread: reading.spread,
        question: reading.question,
        cards: reading.drawn.map((d) => ({
          position: d.position,
          card: d.card.name,
          arcana: d.card.arcana,
          suit: d.card.suit,
          orientation: d.reversed ? "reversed" : "upright",
        })),
      };
    },
  },
];

export const GURU_TOOL_DECLARATIONS: ToolDeclaration[] = GURU_TOOLS.map((t) => t.declaration);

/** Runs one tool call; failures become error results the model can recover from. */
export async function executeTool(call: ToolCallPart, ctx: GuruToolContext, tools: GuruTool[] = GURU_TOOLS): Promise<ToolResultPart> {
  const tool = tools.find((t) => t.declaration.name === call.name);
  if (!tool) {
    return { type: "tool_result", id: call.id, name: call.name, result: { error: `Unknown tool "${call.name}".` }, isError: true };
  }
  try {
    return { type: "tool_result", id: call.id, name: call.name, result: await tool.run(call.args, ctx) };
  } catch (error) {
    const message = error instanceof GuruInputError ? error.message : "That lookup failed unexpectedly. Tell the user it did not work and try again, or ask them to rephrase.";
    if (!(error instanceof GuruInputError)) console.error(`[guru] tool ${call.name} failed`, error);
    return { type: "tool_result", id: call.id, name: call.name, result: { error: message }, isError: true };
  }
}
