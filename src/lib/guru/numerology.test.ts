import { describe, expect, it } from "vitest";
import { GuruInputError } from "./astro/time";
import { computeNumerology, normalizeName, reduceNumber } from "./numerology";

describe("reduceNumber", () => {
  it("reduces to a single digit", () => {
    expect(reduceNumber(13, true)).toBe(4);
    expect(reduceNumber(9, true)).toBe(9);
    expect(reduceNumber(10, false)).toBe(1);
  });
  it("keeps master numbers 11, 22, 33 only when asked", () => {
    expect(reduceNumber(29, true)).toBe(11);
    expect(reduceNumber(29, false)).toBe(2);
    expect(reduceNumber(22, true)).toBe(22);
    expect(reduceNumber(22, false)).toBe(4);
    expect(reduceNumber(33, true)).toBe(33);
    expect(reduceNumber(44, true)).toBe(8); // 44 is not a master number here
  });
});

describe("normalizeName", () => {
  it("strips accents, punctuation and case", () => {
    expect(normalizeName("Zoë O'Brien-Smith")).toBe("ZOE OBRIENSMITH");
  });
});

describe("computeNumerology", () => {
  const r = computeNumerology({ fullName: "John", birthDate: "1990-06-15" });

  it("life path: month, day, year reduced separately (6 + 6 + 1 = 13 -> 4)", () => {
    expect(r.pythagorean.lifePath).toEqual({ total: 13, number: 4 });
  });

  it("expression / soul urge / personality for John (Pythagorean J1 O6 H8 N5)", () => {
    expect(r.pythagorean.expression).toEqual({ total: 20, number: 2 });
    expect(r.pythagorean.soulUrge).toEqual({ total: 6, number: 6 }); // O
    expect(r.pythagorean.personality).toEqual({ total: 14, number: 5 }); // J H N
  });

  it("Indian system: mulank from the day, bhagyank from the whole date, Chaldean name number", () => {
    expect(r.indian.mulank).toBe(6); // 15 -> 6
    expect(r.indian.mulankPlanet).toBe("Venus");
    expect(r.indian.bhagyank).toEqual({ total: 31, number: 4 }); // 1+5+0+6+1+9+9+0
    expect(r.indian.bhagyankPlanet).toBe("Rahu");
    expect(r.indian.nameNumber).toEqual({ total: 18, number: 9 }); // J1 O7 H5 N5
    expect(r.indian.nameNumberPlanet).toBe("Mars");
  });

  it("keeps master numbers while reducing month, day and year (1992-11-29)", () => {
    // month 11 (master), day 29 -> 11 (master), year 1992 -> 21 -> 3; total 11+11+3 = 25 -> 7
    expect(computeNumerology({ fullName: "A", birthDate: "1992-11-29" }).pythagorean.lifePath).toEqual({ total: 25, number: 7 });
  });

  it("Y is a vowel only when no neighbouring vowel: Mary vs Kayla", () => {
    // Mary: A, Y vowels (1 + 7 = 8); Kayla: only A is a vowel (1)
    expect(computeNumerology({ fullName: "Mary", birthDate: "2000-01-01" }).pythagorean.soulUrge.total).toBe(8);
    expect(computeNumerology({ fullName: "Kayla", birthDate: "2000-01-01" }).pythagorean.soulUrge.total).toBe(2); // K-A-Y-L-A: Y sits next to a vowel so it is a consonant; vowels A + A = 2
  });

  it("notes when non-English characters were ignored", () => {
    const withTamil = computeNumerology({ fullName: "Ravi குமார்", birthDate: "2000-01-01" });
    expect(withTamil.name).toBe("RAVI");
    expect(withTamil.notes.length).toBe(1);
  });

  it("rejects an invalid name or date", () => {
    expect(() => computeNumerology({ fullName: "குமார்", birthDate: "2000-01-01" })).toThrow(GuruInputError);
    expect(() => computeNumerology({ fullName: "Ravi", birthDate: "2001-02-29" })).toThrow(GuruInputError);
    expect(() => computeNumerology({ fullName: "Ravi", birthDate: "01/01/2000" })).toThrow(GuruInputError);
  });
});
