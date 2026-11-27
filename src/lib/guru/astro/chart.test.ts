import { describe, expect, it } from "vitest";
import { buildVedicChart, currentDasha } from "./chart";
import { GRAHAS } from "./constants";
import { GuruInputError } from "./time";

describe("buildVedicChart: India's independence chart (published, sign level)", () => {
  // 15 Aug 1947, 00:00 IST, New Delhi -- one of the most widely published
  // charts: Taurus lagna, Moon in Cancer (Pushya), Sun/Venus/Saturn in
  // Cancer, Jupiter in Libra, Rahu in Taurus / Ketu in Scorpio.
  const chart = buildVedicChart({ date: "1947-08-15", time: "00:00", timezone: "Asia/Kolkata", latitude: 28.6139, longitude: 77.209 });

  it("converts IST midnight to 18:30 UTC the day before", () => {
    expect(chart.utc).toBe("1947-08-14T18:30:00.000Z");
  });

  it("matches the published lagna and graha signs", () => {
    expect(chart.ascendant.signName).toBe("Taurus");
    expect(chart.planets.Moon).toMatchObject({ signName: "Cancer", nakshatraName: "Pushya" });
    expect(chart.planets.Sun.signName).toBe("Cancer");
    expect(chart.planets.Venus.signName).toBe("Cancer");
    expect(chart.planets.Saturn.signName).toBe("Cancer");
    expect(chart.planets.Mars.signName).toBe("Gemini");
    expect(chart.planets.Jupiter.signName).toBe("Libra");
    expect(chart.planets.Rahu.signName).toBe("Taurus");
    expect(chart.planets.Ketu.signName).toBe("Scorpio");
  });

  it("Moon in Pushya (ruled by Saturn) starts a Saturn mahadasha at birth", () => {
    expect(chart.dashas[0].lord).toBe("Saturn");
    expect(chart.moon).toEqual({ sign: "Cancer", nakshatra: "Pushya", pada: chart.planets.Moon.pada });
  });
});

describe("buildVedicChart structure", () => {
  const chart = buildVedicChart({ name: "Test", date: "1989-12-21", time: "02:10", timezone: "Asia/Kolkata", latitude: 10.7905, longitude: 78.7047 });

  it("has all nine grahas and twelve houses", () => {
    expect(Object.keys(chart.planets).sort()).toEqual([...GRAHAS].sort());
    expect(chart.houses).toHaveLength(12);
  });

  it("house 1 is the ascendant sign and houses run in zodiac order", () => {
    expect(chart.houses[0].sign).toBe(chart.ascendant.sign);
    chart.houses.forEach((h, i) => expect(h.sign).toBe((chart.ascendant.sign + i) % 12));
  });

  it("every graha appears in exactly one house, matching its own house number", () => {
    const seen = chart.houses.flatMap((h) => h.occupants);
    expect([...seen].sort()).toEqual([...GRAHAS].sort());
    for (const h of chart.houses) for (const g of h.occupants) expect(chart.planets[g].house).toBe(h.house);
  });

  it("house lords sit where the chart says they sit", () => {
    for (const h of chart.houses) expect(h.lordInHouse).toBe(chart.planets[h.lord].house);
  });

  it("Rahu and Ketu are 180 degrees apart and always in opposite houses", () => {
    const separation = (((chart.planets.Rahu.longitude - chart.planets.Ketu.longitude) % 360) + 360) % 360;
    expect(Math.abs(separation - 180)).toBeLessThan(1e-9);
    expect(Math.abs(chart.planets.Rahu.house - chart.planets.Ketu.house)).toBe(6);
  });

  it("every aspect is a real 7th/special aspect between two occupied houses", () => {
    for (const a of chart.aspects) {
      expect(a.from).not.toBe(a.to);
      const dist = ((chart.planets[a.to].house - chart.planets[a.from].house + 12) % 12) + 1;
      expect([3, 4, 5, 7, 8, 9, 10]).toContain(dist);
    }
    // Every graha casts a 7th aspect on whoever sits opposite.
    const opposite = chart.planets.Sun.house <= 6 ? chart.planets.Sun.house + 6 : chart.planets.Sun.house - 6;
    for (const g of chart.houses[opposite - 1].occupants) {
      expect(chart.aspects.some((a) => a.from === "Sun" && a.to === g)).toBe(true);
    }
  });

  it("is plain JSON-serialisable (it is handed to the AI as a tool result)", () => {
    const roundTripped = JSON.parse(JSON.stringify(chart));
    expect(roundTripped.planets.Moon.nakshatraName).toBe(chart.planets.Moon.nakshatraName);
    expect(typeof roundTripped.dashas[0].start).toBe("string");
  });

  it("current dasha is found for a date inside the horizon", () => {
    const pos = currentDasha(chart, new Date("2026-08-25T00:00:00Z"));
    expect(pos).not.toBeNull();
    expect(pos!.mahadasha.start.getTime()).toBeLessThanOrEqual(new Date("2026-08-25T00:00:00Z").getTime());
  });

  it("records the conventions used so astrologers can compare like with like", () => {
    expect(chart.settings).toMatchObject({ ayanamsa: "lahiri", houseSystem: "whole-sign", nodeType: "mean", dashaYearDays: 365.25 });
  });

  it("rejects bad input", () => {
    expect(() => buildVedicChart({ date: "2000-13-01", time: "10:00", timezone: "Asia/Kolkata", latitude: 13, longitude: 80 })).toThrow(GuruInputError);
  });

  it("true-node option changes only Rahu/Ketu, by a small amount", () => {
    const mean = buildVedicChart(chart.input, { nodeType: "mean" });
    const tru = buildVedicChart(chart.input, { nodeType: "true" });
    expect(Math.abs(mean.planets.Rahu.longitude - tru.planets.Rahu.longitude)).toBeLessThan(2);
    expect(mean.planets.Sun.longitude).toBe(tru.planets.Sun.longitude);
  });
});
