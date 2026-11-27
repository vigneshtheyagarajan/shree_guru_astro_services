import { describe, expect, it } from "vitest";
import { GuruInputError, birthMomentToUtc, type BirthInput } from "./time";

const base: BirthInput = {
  date: "2000-01-01",
  time: "12:00",
  timezone: "Asia/Kolkata",
  latitude: 13.0827,
  longitude: 80.2707,
};

describe("birthMomentToUtc", () => {
  it("converts IST to UTC (+5:30)", () => {
    const m = birthMomentToUtc(base);
    expect(m.utc.toISOString()).toBe("2000-01-01T06:30:00.000Z");
    expect(m.offsetMinutes).toBe(330);
    expect(m.warnings).toEqual([]);
  });

  it("uses India's historical war-time offset of +6:30 (Sept 1942 - Oct 1945)", () => {
    const m = birthMomentToUtc({ ...base, date: "1944-06-01" });
    expect(m.offsetMinutes).toBe(390);
    expect(m.utc.toISOString()).toBe("1944-06-01T05:30:00.000Z");
  });

  it("flags a pre-standard-time local-mean-time offset", () => {
    const m = birthMomentToUtc({ ...base, date: "1900-01-01" });
    expect(m.warnings.join(" ")).toMatch(/local-mean-time/);
  });

  it("flags a wall-clock time skipped by a DST change", () => {
    const m = birthMomentToUtc({ ...base, date: "2021-03-14", time: "02:30", timezone: "America/New_York" });
    expect(m.warnings.join(" ")).toMatch(/did not exist/);
  });

  it("flags a wall-clock time repeated by a DST change", () => {
    const m = birthMomentToUtc({ ...base, date: "2021-11-07", time: "01:30", timezone: "America/New_York" });
    expect(m.warnings.join(" ")).toMatch(/occurred twice/);
  });

  it("flags extreme latitudes", () => {
    const m = birthMomentToUtc({ ...base, latitude: 70, longitude: 25, timezone: "Europe/Oslo" });
    expect(m.warnings.join(" ")).toMatch(/polar circle/);
  });

  it.each([
    ["bad date format", { date: "01-01-2000" }],
    ["impossible date", { date: "2000-02-30" }],
    ["bad time format", { time: "12pm" }],
    ["out-of-range time", { time: "24:00" }],
    ["unknown zone", { timezone: "Mars/Olympus" }],
    ["latitude out of range", { latitude: 91 }],
    ["longitude out of range", { longitude: 181 }],
    ["non-finite latitude", { latitude: Number.NaN }],
  ])("rejects %s", (_label, patch) => {
    expect(() => birthMomentToUtc({ ...base, ...patch })).toThrow(GuruInputError);
  });
});
