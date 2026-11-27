/**
 * Generates docs/guru/validation-pack.md: a set of charts computed by the
 * Guru engine, laid out so an astrologer can compare each one against
 * their own software (Jagannatha Hora, AstroSage, etc.) and mark any
 * difference. Re-run after any engine change:
 *
 *   npx tsx scripts/guru/validation-pack.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { buildVedicChart } from "../../src/lib/guru/astro/chart";
import { formatChartText } from "../../src/lib/guru/astro/format";
import type { BirthInput } from "../../src/lib/guru/astro/time";
import type { NodeType } from "../../src/lib/guru/astro/ephemeris";

interface Case {
  title: string;
  why: string;
  input: BirthInput;
  nodeType?: NodeType;
}

const cases: Case[] = [
  {
    title: "India's independence chart",
    why: "A widely published chart; every astrologer knows its Taurus lagna and Cancer stellium.",
    input: { date: "1947-08-15", time: "00:00", timezone: "Asia/Kolkata", latitude: 28.6139, longitude: 77.209 },
  },
  {
    title: "Chennai, modern birth",
    why: "Typical case: south India, early morning birth.",
    input: { date: "1990-06-15", time: "04:20", timezone: "Asia/Kolkata", latitude: 13.0827, longitude: 80.2707 },
  },
  {
    title: "Madurai, evening birth",
    why: "Evening birth: checks the ascendant late in the day.",
    input: { date: "1975-03-02", time: "18:45", timezone: "Asia/Kolkata", latitude: 9.9252, longitude: 78.1198 },
  },
  {
    title: "Tiruchirappalli, small hours (mean node)",
    why: "Birth just after midnight, so the UTC date differs from the local date.",
    input: { date: "1989-12-21", time: "02:10", timezone: "Asia/Kolkata", latitude: 10.7905, longitude: 78.7047 },
  },
  {
    title: "Tiruchirappalli, same birth with TRUE node",
    why: "Shows how much Rahu/Ketu move under the true-node setting (everything else is identical).",
    input: { date: "1989-12-21", time: "02:10", timezone: "Asia/Kolkata", latitude: 10.7905, longitude: 78.7047 },
    nodeType: "true",
  },
  {
    title: "Coimbatore, midday",
    why: "Midday birth: ascendant near the Sun's sign.",
    input: { date: "2001-08-09", time: "11:30", timezone: "Asia/Kolkata", latitude: 11.0168, longitude: 76.9558 },
  },
  {
    title: "Kanyakumari, near the equator",
    why: "Low latitude (8 degrees north): house cusps behave differently from higher latitudes.",
    input: { date: "1968-01-14", time: "06:05", timezone: "Asia/Kolkata", latitude: 8.0883, longitude: 77.5385 },
  },
  {
    title: "Chennai, war-time clock (1944)",
    why: "India ran on +6:30 from Sept 1942 to Oct 1945. The engine applies this automatically; software that ignores it is an hour out, which typically moves the lagna by around 15 degrees. Please check which your software did.",
    input: { date: "1944-06-01", time: "12:00", timezone: "Asia/Kolkata", latitude: 13.0827, longitude: 80.2707 },
  },
  {
    title: "Delhi, Lahiri epoch date",
    why: "21 March 1956 is the date the Lahiri ayanamsa is anchored to, so the ayanamsa value is a direct check.",
    input: { date: "1956-03-21", time: "05:30", timezone: "Asia/Kolkata", latitude: 28.6139, longitude: 77.209 },
  },
  {
    title: "London, winter",
    why: "Outside India, northern latitude 51.5.",
    input: { date: "1985-11-23", time: "21:15", timezone: "Europe/London", latitude: 51.5074, longitude: -0.1278 },
  },
  {
    title: "New York, summer (daylight saving)",
    why: "Western longitude with daylight saving time in force.",
    input: { date: "1999-07-04", time: "09:00", timezone: "America/New_York", latitude: 40.7128, longitude: -74.006 },
  },
  {
    title: "Sydney, southern hemisphere",
    why: "Southern latitude (-33.9) with daylight saving: checks the ascendant formula below the equator.",
    input: { date: "2010-01-10", time: "22:40", timezone: "Australia/Sydney", latitude: -33.8688, longitude: 151.2093 },
  },
  {
    title: "Chennai, leap day",
    why: "29 February, to confirm date handling.",
    input: { date: "2024-02-29", time: "15:45", timezone: "Asia/Kolkata", latitude: 13.0827, longitude: 80.2707 },
  },
];

const md: string[] = [];
md.push("# Guru chart engine: validation pack");
md.push("");
md.push(
  "Purpose: confirm that the Guru chart engine agrees with the Jyotish software your astrologers already trust, **before** any AI is built on top of it. Everything the AI says about a chart comes from these numbers, so they must be right.",
);
md.push("");
md.push("## How to use");
md.push("");
md.push("1. In your software set: **Lahiri (Chitrapaksha) ayanamsa**, **sidereal zodiac**, **whole-sign houses**, **Mean node** (unless a case says TRUE node).");
md.push("2. For each case below, enter the same date, time, place and time zone, and compare.");
md.push("3. Tolerance: positions should agree to within **about 1 arcminute (1')**. Sign, nakshatra and pada should match exactly (a planet within an arcminute of a boundary is the one acceptable exception, so please note it).");
md.push("4. Under each case write ✔ if everything matches, or list the differences (which body, what your software shows).");
md.push("");
md.push("## Conventions in the engine");
md.push("");
md.push("- Ayanamsa: Lahiri. Houses: whole sign (house 1 = the sign of the lagna).");
md.push("- Rahu/Ketu: mean node by default (true node available).");
md.push("- Vimshottari year = 365.25 days. (Some software uses 360 or 365.2422; this shifts dates by days, never the order of dashas.)");
md.push("- Local time is converted to UTC using the historical time-zone database, including India's 1942-45 war time.");
md.push("");
md.push("**Please also tell us:** which node type (mean/true) and which dasha year your astrologers normally use, so we can match your practice.");
md.push("");

cases.forEach((c, index) => {
  const chart = buildVedicChart(c.input, { nodeType: c.nodeType ?? "mean" });
  md.push(`## Case ${index + 1}: ${c.title}`);
  md.push("");
  md.push(`*Why this case:* ${c.why}`);
  md.push("");
  md.push("```");
  md.push(formatChartText(chart));
  md.push("```");
  md.push("");
  md.push("Your software: ☐ matches   ☐ differences: ____________________________");
  md.push("");
});

const out = join(process.cwd(), "docs/guru/validation-pack.md");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, md.join("\n"));
console.log(`Wrote ${out} (${cases.length} cases)`);
