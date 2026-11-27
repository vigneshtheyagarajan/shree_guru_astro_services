import { describe, expect, it } from "vitest";
import { buildVedicChart } from "./chart";
import { kujaDosha } from "./kuja";

describe("kujaDosha", () => {
  // Independence chart: lagna Taurus, Mars in Gemini (house 2), Moon in
  // Cancer (Mars is the 12th from the Moon), Venus in Cancer.
  const chart = buildVedicChart({ date: "1947-08-15", time: "00:00", timezone: "Asia/Kolkata", latitude: 28.6139, longitude: 77.209 });

  it("counts Mars's house from the lagna, Moon and Venus", () => {
    const k = kujaDosha(chart, "south");
    expect(k.fromLagna.house).toBe(2);
    expect(k.fromMoon.house).toBe(12);
    expect(k.fromVenus.house).toBe(12);
  });

  it("South practice counts the 2nd house, North practice does not", () => {
    expect(kujaDosha(chart, "south").fromLagna.present).toBe(true);
    expect(kujaDosha(chart, "north").fromLagna.present).toBe(false);
    // Moon-based 12th house is a dosha in both schools.
    expect(kujaDosha(chart, "north").fromMoon.present).toBe(true);
  });

  it("overall flag follows lagna-or-Moon", () => {
    expect(kujaDosha(chart, "north").present).toBe(true);
  });

  it("exposes the house set used so the choice is never hidden", () => {
    expect(kujaDosha(chart, "south").houses).toEqual([1, 2, 4, 7, 8, 12]);
    expect(kujaDosha(chart, "north").houses).toEqual([1, 4, 7, 8, 12]);
  });
});
