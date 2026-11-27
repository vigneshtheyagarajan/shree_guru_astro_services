import { describe, expect, it } from "vitest";
import { NAKSHATRAS, type SignLord } from "./constants";
import { DEFAULT_MATCHING_CONVENTION, ashtakoota, bandForTotal, maitriScore } from "./matching";
import {
  GANA_OF_NAKSHATRA,
  GANA_TABLES,
  YONI_ANIMALS,
  YONI_MATRIX,
  YONI_OF_NAKSHATRA,
  nadiOfNakshatra,
} from "./matching-tables";

const score = (r: ReturnType<typeof ashtakoota>, name: string) => r.koota.find((k) => k.koota === name)!.score;

// A longitude inside a given nakshatra, for readable fixtures.
const NAK = 360 / 27;
const inNakshatra = (index: number, fraction = 0.3) => (index + fraction) * NAK;

describe("ashtakoota: real published result (Prokerala sample report)", () => {
  // The sample: girl Ashwini, boy Magha, total 20/36 with the per-koota
  // breakdown Varna 1, Vashya 0, Tara 3, Yoni 2, Maitri 5, Gana 1,
  // Bhakoot 0, Nadi 8. Reproducing every koota from a real report is the
  // strongest evidence the tables and orientation are right.
  const result = ashtakoota(inNakshatra(NAKSHATRAS.indexOf("Magha")), inNakshatra(NAKSHATRAS.indexOf("Ashwini")));

  it("reproduces each koota score", () => {
    expect(result.koota.map((k) => [k.koota, k.score])).toEqual([
      ["Varna", 1],
      ["Vashya", 0],
      ["Tara", 3],
      ["Yoni", 2],
      ["Graha Maitri", 5],
      ["Gana", 1],
      ["Bhakoot", 0],
      ["Nadi", 8],
    ]);
  });

  it("totals 20 and lands in the 'acceptable' band", () => {
    expect(result.total).toBe(20);
    expect(result.max).toBe(36);
    expect(result.band).toBe("acceptable");
  });

  it("flags the Bhakoot dosha and says plainly that cancellations are not applied to the score", () => {
    expect(result.doshas).toEqual({ nadi: false, bhakoot: true, gana: false });
    expect(result.cautions.join(" ")).toMatch(/Bhakoot dosha/);
    expect(result.cautions.join(" ")).toMatch(/not applied to the score/);
  });

  it("flags the cells where published tables differ (vashya and gana here)", () => {
    expect(result.koota.filter((k) => k.disputed).map((k) => k.koota).sort()).toEqual(["Gana", "Vashya"]);
    expect(result.cautions.join(" ")).toMatch(/vary by source/);
  });

  it("the convention is a visible choice: Astroyogi's gana table would score this pair 0, not 1", () => {
    const alt = ashtakoota(inNakshatra(9), inNakshatra(0), { gana: "astroyogi" });
    expect(score(alt, "Gana")).toBe(0);
    expect(alt.total).toBe(19);
    expect(alt.convention.gana).toBe("astroyogi");
    expect(result.convention).toEqual(DEFAULT_MATCHING_CONVENTION);
  });
});

describe("ashtakoota: AstroSage worked example (girl Krittika in Aries, boy Rohini in Taurus)", () => {
  const r = ashtakoota(45, 28); // Rohini 40-53.3 (Taurus), Krittika 26.7-40 (pada 1 is in Aries)
  it("matches the published gana, yoni, bhakoot, nadi and tara", () => {
    expect(r.girlMoon).toMatchObject({ sign: "Aries", nakshatra: "Krittika" });
    expect(r.boyMoon).toMatchObject({ sign: "Taurus", nakshatra: "Rohini" });
    expect(score(r, "Gana")).toBe(0); // girl Rakshasa x boy Manushya
    expect(score(r, "Yoni")).toBe(2); // Serpent x Sheep
    expect(score(r, "Bhakoot")).toBe(0); // 2/12
    expect(score(r, "Nadi")).toBe(0); // both Antya
    expect(score(r, "Tara")).toBe(3);
    expect(r.doshas).toMatchObject({ nadi: true, bhakoot: true });
  });
  it("warns about the nadi dosha regardless of the total", () => {
    expect(r.cautions.join(" ")).toMatch(/Nadi dosha/);
  });
});

describe("individual koota rules", () => {
  const sign = (n: number, deg = 5) => n * 30 + deg;

  it("varna: 1 when the boy's varna is equal or higher, 0 when the girl's is higher", () => {
    expect(score(ashtakoota(sign(1), sign(0)), "Varna")).toBe(0); // boy Taurus (Vaishya) < girl Aries (Kshatriya)
    expect(score(ashtakoota(sign(0), sign(1)), "Varna")).toBe(1);
    expect(score(ashtakoota(sign(0), sign(4)), "Varna")).toBe(1); // both Kshatriya
    expect(score(ashtakoota(sign(3), sign(2)), "Varna")).toBe(1); // Brahmin over Shudra
  });

  it("vashya: Sagittarius and Capricorn split at 15 degrees", () => {
    const group = (lon: number) => ashtakoota(lon, lon).koota.find((k) => k.koota === "Vashya")!.boy;
    expect(group(sign(8, 14.9))).toBe("Manava");
    expect(group(sign(8, 15.1))).toBe("Chatushpada");
    expect(group(sign(9, 14.9))).toBe("Chatushpada");
    expect(group(sign(9, 15.1))).toBe("Jalachara");
    expect(group(sign(4))).toBe("Vanachara");
    expect(group(sign(7))).toBe("Keeta");
    expect(group(sign(10))).toBe("Manava");
  });

  it("tara: remainders 3, 5, 7 are the unfavourable ones, counted both ways", () => {
    // girl Ashwini, boy Krittika: girl->boy count 3 (Vipat, bad); boy->girl count 26 -> 8 (good)
    expect(score(ashtakoota(inNakshatra(2), inNakshatra(0)), "Tara")).toBe(1.5);
    // girl Ashwini, boy Bharani: counts 2 and 27 (-> 9): both good
    expect(score(ashtakoota(inNakshatra(1), inNakshatra(0)), "Tara")).toBe(3);
    // girl Ashwini, boy Ardra (index 5): girl->boy 6 (good); boy->girl 23 -> 5 (bad)
    expect(score(ashtakoota(inNakshatra(5), inNakshatra(0)), "Tara")).toBe(1.5);
    // girl Ashwini, boy Mrigashira (index 4): girl->boy 5 (bad); boy->girl 24 -> 6 (good)
    expect(score(ashtakoota(inNakshatra(4), inNakshatra(0)), "Tara")).toBe(1.5);
  });

  it("bhakoot: 2/12, 5/9 and 6/8 score 0; every other pairing scores 7", () => {
    const bhakoot = (boySign: number, girlSign: number) => score(ashtakoota(sign(boySign), sign(girlSign)), "Bhakoot");
    expect(bhakoot(0, 0)).toBe(7); // same sign
    expect(bhakoot(1, 0)).toBe(0); // 2/12
    expect(bhakoot(11, 0)).toBe(0); // 12/2
    expect(bhakoot(2, 0)).toBe(7); // 3/11
    expect(bhakoot(3, 0)).toBe(7); // 4/10
    expect(bhakoot(4, 0)).toBe(0); // 5/9
    expect(bhakoot(5, 0)).toBe(0); // 6/8
    expect(bhakoot(6, 0)).toBe(7); // 7/7
    expect(bhakoot(7, 0)).toBe(0); // 8/6
    expect(bhakoot(8, 0)).toBe(0); // 9/5
    expect(bhakoot(9, 0)).toBe(7); // 10/4
  });

  it("bhakoot is symmetric between the two people", () => {
    for (let a = 0; a < 12; a++)
      for (let b = 0; b < 12; b++)
        expect(score(ashtakoota(a * 30 + 5, b * 30 + 5), "Bhakoot")).toBe(score(ashtakoota(b * 30 + 5, a * 30 + 5), "Bhakoot"));
  });

  it("nadi: same nadi 0, different 8", () => {
    expect(score(ashtakoota(inNakshatra(0), inNakshatra(5)), "Nadi")).toBe(0); // Ashwini and Ardra: both Adi
    expect(score(ashtakoota(inNakshatra(0), inNakshatra(1)), "Nadi")).toBe(8);
  });
});

describe("graha maitri", () => {
  // OnlineJyotish's published 7x7 matrix (rows/columns: Sun, Moon, Mars,
  // Mercury, Jupiter, Venus, Saturn). It is reproduced exactly by the rule
  // 'friend+friend 5, friend+neutral 4, neutral+neutral 3, friend+enemy 1,
  // neutral+enemy 0.5, enemy+enemy 0' over the natural-friendship table.
  const order: SignLord[] = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];
  const published = [
    [5, 5, 5, 4, 5, 0, 0],
    [5, 5, 4, 1, 4, 0.5, 0.5],
    [5, 4, 5, 0.5, 5, 3, 0.5],
    [4, 1, 0.5, 5, 0.5, 5, 4],
    [5, 4, 5, 0.5, 5, 0.5, 3],
    [0, 0.5, 3, 5, 0.5, 5, 5],
    [0, 0.5, 0.5, 4, 3, 5, 5],
  ];
  it("reproduces every cell of the published matrix", () => {
    order.forEach((a, i) => order.forEach((b, j) => expect(maitriScore(a, b), `${a}-${b}`).toBe(published[i][j])));
  });
});

describe("table integrity", () => {
  it("gana: nine nakshatras per gana, as classically stated", () => {
    for (const gana of ["Deva", "Manushya", "Rakshasa"]) expect(GANA_OF_NAKSHATRA.filter((g) => g === gana)).toHaveLength(9);
    expect(GANA_OF_NAKSHATRA[NAKSHATRAS.indexOf("Ashwini")]).toBe("Deva");
    expect(GANA_OF_NAKSHATRA[NAKSHATRAS.indexOf("Magha")]).toBe("Rakshasa");
    expect(GANA_OF_NAKSHATRA[NAKSHATRAS.indexOf("Rohini")]).toBe("Manushya");
  });

  it("gana tables: same gana is always 6", () => {
    for (const table of Object.values(GANA_TABLES)) for (let i = 0; i < 3; i++) expect(table[i][i]).toBe(6);
  });

  it("nadi: nine nakshatras per nadi and the published membership", () => {
    const by = (nadi: string) => NAKSHATRAS.filter((_, i) => nadiOfNakshatra(i) === nadi);
    expect(by("Adi")).toEqual(["Ashwini", "Ardra", "Punarvasu", "Uttara Phalguni", "Hasta", "Jyeshtha", "Mula", "Shatabhisha", "Purva Bhadrapada"]);
    expect(by("Madhya")).toEqual(["Bharani", "Mrigashira", "Pushya", "Purva Phalguni", "Chitra", "Anuradha", "Purva Ashadha", "Dhanishta", "Uttara Bhadrapada"]);
    expect(by("Antya")).toEqual(["Krittika", "Rohini", "Ashlesha", "Magha", "Swati", "Vishakha", "Uttara Ashadha", "Shravana", "Revati"]);
  });

  it("yoni matrix: symmetric, same animal 4, exactly the seven sworn-enemy pairs are 0", () => {
    const n = YONI_ANIMALS.length;
    const zeros: string[] = [];
    for (let i = 0; i < n; i++) {
      expect(YONI_MATRIX[i][i]).toBe(4);
      for (let j = 0; j < n; j++) {
        expect(YONI_MATRIX[i][j]).toBe(YONI_MATRIX[j][i]);
        if (j > i && YONI_MATRIX[i][j] === 0) zeros.push([YONI_ANIMALS[i], YONI_ANIMALS[j]].sort().join("-"));
      }
    }
    expect(zeros.sort()).toEqual(["Buffalo-Horse", "Cat-Rat", "Cow-Tiger", "Deer-Dog", "Elephant-Lion", "Monkey-Sheep", "Mongoose-Serpent"].sort());
  });

  it("yoni: every nakshatra has an animal; each animal has two nakshatras except the mongoose (one)", () => {
    expect(YONI_OF_NAKSHATRA).toHaveLength(27);
    YONI_ANIMALS.forEach((animal, idx) => {
      const count = YONI_OF_NAKSHATRA.filter((a) => a === idx).length;
      expect(count, animal).toBe(animal === "Mongoose" ? 1 : 2);
    });
  });
});

describe("bands", () => {
  it("below 18 not recommended, 18-24 acceptable, 25-32 good, 33-36 excellent", () => {
    expect(bandForTotal(17.5)).toBe("not recommended");
    expect(bandForTotal(18)).toBe("acceptable");
    expect(bandForTotal(24.5)).toBe("acceptable");
    expect(bandForTotal(25)).toBe("good");
    expect(bandForTotal(32.5)).toBe("good");
    expect(bandForTotal(33)).toBe("excellent");
    expect(bandForTotal(36)).toBe("excellent");
  });
});

describe("invariants over every pair of Moon longitudes (1 degree grid, 129,600 pairs)", () => {
  it("totals are the sum of the koota, each koota is within its maximum, and nothing exceeds 36", () => {
    let highest = 0;
    let lowest = 36;
    for (let boy = 0; boy < 360; boy++) {
      for (let girl = 0; girl < 360; girl++) {
        const r = ashtakoota(boy + 0.5, girl + 0.5);
        let sum = 0;
        for (const k of r.koota) {
          if (k.score < 0 || k.score > k.max || (k.score * 2) % 1 !== 0) throw new Error(`${k.koota} out of range: ${k.score}`);
          sum += k.score;
        }
        if (sum !== r.total || r.total > 36) throw new Error(`total mismatch at ${boy},${girl}`);
        highest = Math.max(highest, r.total);
        lowest = Math.min(lowest, r.total);
      }
    }
    // 36/36 is not reachable with these tables (a full 4/4 yoni needs the same
    // animal, and no same-animal pair also clears nadi, gana, tara and bhakoot),
    // but the 'excellent' band (33+) must be.
    expect(highest).toBeGreaterThanOrEqual(34);
    expect(highest).toBeLessThanOrEqual(36);
    expect(lowest).toBeLessThan(10);
  });
});
