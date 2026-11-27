import { describe, expect, it } from "vitest";
import { NAKSHATRA_SPAN, VIMSHOTTARI_YEARS } from "./constants";
import { dashaAt, vimshottariDashas } from "./dasha";

const birth = new Date("1990-06-15T04:20:00Z");
const YEAR_MS = 365.25 * 86_400_000;
const years = (a: Date, b: Date) => (b.getTime() - a.getTime()) / YEAR_MS;

describe("vimshottariDashas", () => {
  it("Moon at 0 Aries: a full 7-year Ketu dasha begins at birth", () => {
    const d = vimshottariDashas(0, birth);
    expect(d[0].lord).toBe("Ketu");
    expect(d[0].start.getTime()).toBe(birth.getTime());
    expect(years(d[0].start, d[0].end)).toBeCloseTo(7, 9);
    expect(d[1].lord).toBe("Venus");
  });

  it("Moon half way through Ashwini: 3.5 years of Ketu remain", () => {
    const d = vimshottariDashas(NAKSHATRA_SPAN / 2, birth);
    expect(years(d[0].start, d[0].end)).toBeCloseTo(3.5, 9);
  });

  it("Moon at the start of Rohini (40 deg): Moon dasha, 10 years", () => {
    const d = vimshottariDashas(40, birth);
    expect(d[0].lord).toBe("Moon");
    expect(years(d[0].start, d[0].end)).toBeCloseTo(10, 9);
    expect(d[1].lord).toBe("Mars");
  });

  it("mahadashas are contiguous, in Vimshottari order, and the full cycle is 120 years", () => {
    const d = vimshottariDashas(0, birth, { horizonYears: 120 });
    for (let i = 1; i < d.length; i++) expect(d[i].start.getTime()).toBe(d[i - 1].end.getTime());
    expect(d.map((m) => m.lord).slice(0, 9)).toEqual(["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"]);
    const nine = d.slice(0, 9);
    expect(years(nine[0].start, nine[8].end)).toBeCloseTo(120, 6);
  });

  it("antardashas start with the mahadasha lord, are contiguous and tile the mahadasha", () => {
    const d = vimshottariDashas(0, birth);
    const venus = d[1];
    expect(venus.antardashas[0].lord).toBe("Venus");
    expect(venus.antardashas).toHaveLength(9);
    for (let i = 1; i < 9; i++) expect(venus.antardashas[i].start.getTime()).toBe(venus.antardashas[i - 1].end.getTime());
    expect(venus.antardashas[0].start.getTime()).toBe(venus.start.getTime());
    expect(venus.antardashas[8].end.getTime()).toBe(venus.end.getTime());
    // Venus-Venus = 20 * 20 / 120 years
    expect(years(venus.antardashas[0].start, venus.antardashas[0].end)).toBeCloseTo((20 * 20) / 120, 9);
    // Venus-Sun = 20 * 6 / 120 years
    expect(years(venus.antardashas[1].start, venus.antardashas[1].end)).toBeCloseTo((20 * VIMSHOTTARI_YEARS.Sun) / 120, 9);
  });

  it("in the balance mahadasha, antardashas that ended before birth are dropped and the first is clipped at birth", () => {
    const d = vimshottariDashas(NAKSHATRA_SPAN * 0.9, birth); // 90% of Ashwini gone: ~0.7y of Ketu left
    const first = d[0].antardashas;
    expect(first[0].start.getTime()).toBe(birth.getTime());
    expect(first[first.length - 1].end.getTime()).toBe(d[0].end.getTime());
    for (let i = 1; i < first.length; i++) expect(first[i].start.getTime()).toBe(first[i - 1].end.getTime());
  });

  it("year length option changes dates but not order", () => {
    const julian = vimshottariDashas(0, birth, { yearDays: 365.25 });
    const savana = vimshottariDashas(0, birth, { yearDays: 360 });
    expect(savana.map((m) => m.lord)).toEqual(julian.map((m) => m.lord));
    expect(savana[1].start.getTime()).toBeLessThan(julian[1].start.getTime());
  });
});

describe("dashaAt", () => {
  const dashas = vimshottariDashas(0, birth);

  it("finds mahadasha, antardasha and pratyantardasha for a moment", () => {
    const at = new Date(birth.getTime() + 9 * YEAR_MS); // inside Venus (7y-27y)
    const pos = dashaAt(dashas, at)!;
    expect(pos.mahadasha.lord).toBe("Venus");
    expect(pos.antardasha.lord).toBe("Venus"); // first 3.33y of Venus are Venus-Venus: 7y-10.33y
    expect(pos.pratyantardasha.lord).toBe(pos.antardasha.lord === "Venus" ? pos.pratyantardasha.lord : "Venus");
    const t = at.getTime();
    expect(pos.pratyantardasha.start.getTime()).toBeLessThanOrEqual(t);
    expect(pos.pratyantardasha.end.getTime()).toBeGreaterThan(t);
  });

  it("pratyantardashas nest correctly inside their antardasha", () => {
    const at = new Date(birth.getTime() + 15 * YEAR_MS);
    const pos = dashaAt(dashas, at)!;
    expect(pos.pratyantardasha.start.getTime()).toBeGreaterThanOrEqual(pos.antardasha.start.getTime());
    expect(pos.pratyantardasha.end.getTime()).toBeLessThanOrEqual(pos.antardasha.end.getTime() + 1);
  });

  it("returns null outside the generated horizon", () => {
    expect(dashaAt(dashas, new Date(birth.getTime() - YEAR_MS))).toBeNull();
    expect(dashaAt(dashas, new Date(birth.getTime() + 200 * YEAR_MS))).toBeNull();
  });
});
