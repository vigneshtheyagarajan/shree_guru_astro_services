import { describe, expect, it } from "vitest";
import { buildVedicChart } from "./chart";
import { sadeSatiPhase, transitsFor, transitTimeline } from "./transit";

describe("sadeSatiPhase", () => {
  it("12th from the Moon is rising, 1st peak, 2nd setting, otherwise none", () => {
    expect(sadeSatiPhase(12)).toBe("rising");
    expect(sadeSatiPhase(1)).toBe("peak");
    expect(sadeSatiPhase(2)).toBe("setting");
    for (const h of [3, 4, 5, 6, 7, 8, 9, 10, 11]) expect(sadeSatiPhase(h)).toBeNull();
  });
});

describe("transitsFor", () => {
  // India's independence chart: Moon in Cancer.
  const chart = buildVedicChart({ date: "1947-08-15", time: "00:00", timezone: "Asia/Kolkata", latitude: 28.6139, longitude: 77.209 });

  // Widely known panchangam facts: Saturn (Sani Peyarchi) was in Kumbha /
  // Aquarius from 17 Jan 2023 to 29 Mar 2025, then Meena / Pisces. Jupiter
  // (Guru Peyarchi) entered Rishabha / Taurus on 1 May 2024 and Mithuna /
  // Gemini on 14 May 2025.
  it("puts Saturn in Aquarius in mid-2024 and Pisces in mid-2025", () => {
    expect(transitsFor(chart, new Date("2024-06-01T06:00:00Z")).positions.Saturn.signName).toBe("Aquarius");
    expect(transitsFor(chart, new Date("2025-06-01T06:00:00Z")).positions.Saturn.signName).toBe("Pisces");
  });

  it("puts Jupiter in Taurus in late 2024 and Gemini in mid-2025", () => {
    expect(transitsFor(chart, new Date("2024-10-01T06:00:00Z")).positions.Jupiter.signName).toBe("Taurus");
    expect(transitsFor(chart, new Date("2025-06-01T06:00:00Z")).positions.Jupiter.signName).toBe("Gemini");
  });

  it("Saturn was retrograde in Oct 2024", () => {
    expect(transitsFor(chart, new Date("2024-10-01T06:00:00Z")).positions.Saturn.retrograde).toBe(true);
  });

  it("counts houses from the natal Moon and lagna: Saturn in Aquarius is the 8th from a Cancer Moon (Ashtama Shani)", () => {
    const t = transitsFor(chart, new Date("2024-06-01T06:00:00Z"));
    expect(chart.planets.Moon.signName).toBe("Cancer");
    expect(t.saturn.houseFromMoon).toBe(8);
    expect(t.saturn.ashtamaShani).toBe(true);
    expect(t.saturn.sadeSati).toEqual({ active: false, phase: null });
    // Taurus lagna: Capricorn is the 9th house, so Aquarius is the 10th
    expect(t.positions.Saturn.houseFromLagna).toBe(10);
  });

  it("Jupiter in Taurus is the 11th from a Cancer Moon: favourable", () => {
    const t = transitsFor(chart, new Date("2024-10-01T06:00:00Z"));
    expect(t.jupiter.houseFromMoon).toBe(11);
    expect(t.jupiter.favourableFromMoon).toBe(true);
  });

  it("reports all nine grahas with valid houses, Rahu and Ketu six houses apart", () => {
    const t = transitsFor(chart, new Date("2026-01-01T06:00:00Z"));
    expect(Object.keys(t.positions)).toHaveLength(9);
    for (const p of Object.values(t.positions)) {
      expect(p.houseFromLagna).toBeGreaterThanOrEqual(1);
      expect(p.houseFromLagna).toBeLessThanOrEqual(12);
      expect(p.houseFromMoon).toBeGreaterThanOrEqual(1);
      expect(p.houseFromMoon).toBeLessThanOrEqual(12);
    }
    expect(Math.abs(t.positions.Rahu.houseFromMoon - t.positions.Ketu.houseFromMoon)).toBe(6);
  });

  it("uses the chart's node setting", () => {
    const trueChart = buildVedicChart(chart.input, { nodeType: "true" });
    const at = new Date("2026-01-01T06:00:00Z");
    expect(transitsFor(trueChart, at).positions.Rahu.degreeInSign).not.toBe(transitsFor(chart, at).positions.Rahu.degreeInSign);
  });
});

describe("transitTimeline", () => {
  // Fictional natal chart; only the natal Moon/lagna matter for the house labels.
  const chart = buildVedicChart({ date: "1990-03-12", time: "10:30", timezone: "Asia/Kolkata", latitude: 9.9252, longitude: 78.1198 });
  const events = transitTimeline(chart, new Date("2025-01-01T00:00:00Z"), 3);
  const on = (graha: string, toSign: string) => events.find((e) => e.graha === graha && e.toSign === toSign && e.direction === "forward");
  const near = (iso: string | undefined, expected: string, days: number) =>
    expect(Math.abs(Date.parse(iso!) - Date.parse(expected)) / 86_400_000).toBeLessThanOrEqual(days);

  // Published Lahiri ingress dates (Drik Panchang style): Saturn into Pisces 29 Mar 2025, Jupiter into Gemini 14 May 2025, Rahu into Aquarius 18 May 2025.
  it("finds Saturn entering Pisces on 29 March 2025 (+/- 1 day)", () => near(on("Saturn", "Pisces")?.date, "2025-03-29", 1));
  it("finds Jupiter entering Gemini on 14 May 2025 (+/- 2 days)", () => near(on("Jupiter", "Gemini")?.date, "2025-05-14", 2));
  it("finds Rahu entering Aquarius around 18 May 2025 (mean node: +/- 4 days)", () => near(events.find((e) => e.graha === "Rahu" && e.toSign === "Aquarius")?.date, "2025-05-18", 4));

  it("is sorted by date and Ketu is always opposite Rahu", () => {
    expect(events.map((e) => e.date)).toEqual([...events.map((e) => e.date)].sort());
    const rahu = events.filter((e) => e.graha === "Rahu");
    const ketu = events.filter((e) => e.graha === "Ketu");
    expect(ketu).toHaveLength(rahu.length);
    expect(ketu[0].date).toBe(rahu[0].date);
  });

  it("labels houses from the natal Moon and lagna, and adds Sade Sati phases for Saturn", () => {
    const e = on("Saturn", "Pisces")!;
    const moonSign = chart.planets.Moon.sign;
    expect(e.houseFromMoon).toBe(((11 - moonSign + 12) % 12) + 1); // Pisces = sign index 11
    expect(e.sadeSatiPhase).toBe(sadeSatiPhase(e.houseFromMoon));
    expect(events.find((x) => x.graha === "Jupiter")).not.toHaveProperty("sadeSatiPhase");
  });

  it("marks a retrograde slip back into the previous sign as such", () => {
    const longer = transitTimeline(chart, new Date("2025-01-01T00:00:00Z"), 4);
    const retro = longer.filter((e) => e.direction === "retrograde" && (e.graha === "Jupiter" || e.graha === "Saturn"));
    expect(retro.length).toBeGreaterThan(0);
    for (const e of retro) expect(e.fromSign).not.toBe(e.toSign);
  });

  it("is fast enough to run inside a chat turn (8 years)", () => {
    const t = Date.now();
    transitTimeline(chart, new Date("2026-11-27T00:00:00Z"), 8);
    expect(Date.now() - t).toBeLessThan(3000);
  });
});
