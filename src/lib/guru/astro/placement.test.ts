import { describe, expect, it } from "vitest";
import { dignityOf, placementFromLongitude } from "./placement";

describe("placementFromLongitude", () => {
  it("0 deg is Aries 0, Ashwini pada 1, ruled by Ketu", () => {
    const p = placementFromLongitude(0);
    expect(p).toMatchObject({ signName: "Aries", nakshatraName: "Ashwini", pada: 1, nakshatraLord: "Ketu", navamsaSignName: "Aries" });
  });

  it("nakshatra boundaries fall every 13 deg 20 min and padas every 3 deg 20 min", () => {
    expect(placementFromLongitude(13.3333334).nakshatraName).toBe("Bharani");
    expect(placementFromLongitude(13.33).nakshatraName).toBe("Ashwini");
    expect(placementFromLongitude(10.1).pada).toBe(4);
    expect(placementFromLongitude(3.34).pada).toBe(2);
  });

  it("the last degree is Pisces / Revati pada 4 / navamsa Pisces", () => {
    const p = placementFromLongitude(359.999);
    expect(p).toMatchObject({ signName: "Pisces", nakshatraName: "Revati", pada: 4, navamsaSignName: "Pisces", nakshatraLord: "Mercury" });
  });

  it("normalises out-of-range longitudes", () => {
    expect(placementFromLongitude(-10).signName).toBe("Pisces");
    expect(placementFromLongitude(370).signName).toBe("Aries");
  });

  it("navamsa starts from the sign itself (movable), the 9th (fixed), the 5th (dual)", () => {
    expect(placementFromLongitude(90).navamsaSignName).toBe("Cancer"); // Cancer: movable
    expect(placementFromLongitude(30).navamsaSignName).toBe("Capricorn"); // Taurus: fixed -> 9th from it
    expect(placementFromLongitude(60).navamsaSignName).toBe("Libra"); // Gemini: dual -> 5th from it
  });

  it("every nakshatra lord follows the Vimshottari cycle", () => {
    const lords = Array.from({ length: 27 }, (_, i) => placementFromLongitude(i * (360 / 27) + 1).nakshatraLord);
    expect(lords.slice(0, 9)).toEqual(["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"]);
    expect(lords.slice(9, 18)).toEqual(lords.slice(0, 9));
    expect(lords.slice(18)).toEqual(lords.slice(0, 9));
  });
});

describe("dignityOf", () => {
  it("exaltation, debilitation and own signs", () => {
    expect(dignityOf("Sun", 0)).toBe("exalted");
    expect(dignityOf("Saturn", 0)).toBe("debilitated");
    expect(dignityOf("Mars", 7)).toBe("own");
    expect(dignityOf("Moon", 3)).toBe("own");
    expect(dignityOf("Jupiter", 3)).toBe("exalted");
  });

  it("natural friend / enemy / neutral signs", () => {
    expect(dignityOf("Sun", 3)).toBe("friendly"); // Cancer, lord Moon
    expect(dignityOf("Jupiter", 1)).toBe("enemy"); // Taurus, lord Venus
    expect(dignityOf("Saturn", 4)).toBe("enemy"); // Leo, lord Sun
    expect(dignityOf("Mercury", 8)).toBe("neutral"); // Sagittarius, lord Jupiter
  });

  it("the nodes have no dignity", () => {
    expect(dignityOf("Rahu", 1)).toBeNull();
    expect(dignityOf("Ketu", 7)).toBeNull();
  });
});
