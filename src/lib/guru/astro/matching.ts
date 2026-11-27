import type { VedicChart } from "./chart";
import {
  NATURAL_ENEMIES,
  NATURAL_FRIENDS,
  SIGN_LORDS,
  SIGNS,
  type SignLord,
} from "./constants";
import { placementFromLongitude } from "./placement";
import {
  BANDS,
  GANAS,
  GANA_OF_NAKSHATRA,
  GANA_TABLES,
  GANA_TABLE_ASTROSIGHT,
  VARNA_NAMES,
  VARNA_RANK_BY_SIGN,
  VASHYA_GROUPS,
  VASHYA_TABLES,
  YONI_ANIMALS,
  YONI_DISPUTED_PAIRS,
  YONI_MATRIX,
  YONI_OF_NAKSHATRA,
  nadiOfNakshatra,
  type GanaConvention,
  type VashyaConvention,
  type VashyaGroup,
} from "./matching-tables";

export interface MatchingConvention {
  vashya: VashyaConvention;
  gana: GanaConvention;
}
export const DEFAULT_MATCHING_CONVENTION: MatchingConvention = {
  vashya: "onlinejyotish",
  gana: "astrotalk",
};

export type KootaName = "Varna" | "Vashya" | "Tara" | "Yoni" | "Graha Maitri" | "Gana" | "Bhakoot" | "Nadi";

export interface KootaScore {
  koota: KootaName;
  max: number;
  score: number;
  /** What was read from the boy's and girl's Moon, in words. */
  boy: string;
  girl: string;
  detail: string;
  /** True when mainstream sources publish different values for this exact cell. */
  disputed: boolean;
}

export interface AshtakootaResult {
  boyMoon: { sign: string; nakshatra: string; pada: number };
  girlMoon: { sign: string; nakshatra: string; pada: number };
  total: number;
  max: 36;
  koota: KootaScore[];
  band: (typeof BANDS)[number]["label"];
  doshas: { nadi: boolean; bhakoot: boolean; gana: boolean };
  /** Things Guru must say plainly rather than gloss over. */
  cautions: string[];
  convention: MatchingConvention;
}

// ---- helpers ---------------------------------------------------------------

function vashyaGroup(sign: number, degreeInSign: number): VashyaGroup {
  switch (sign) {
    case 0: // Aries
    case 1: // Taurus
      return "Chatushpada";
    case 2: // Gemini
    case 5: // Virgo
    case 6: // Libra
    case 10: // Aquarius
      return "Manava";
    case 3: // Cancer
    case 11: // Pisces
      return "Jalachara";
    case 4: // Leo
      return "Vanachara";
    case 7: // Scorpio
      return "Keeta";
    case 8: // Sagittarius: 0-15 Manava, 15-30 Chatushpada
      return degreeInSign < 15 ? "Manava" : "Chatushpada";
    default: // Capricorn: 0-15 Chatushpada, 15-30 Jalachara
      return degreeInSign < 15 ? "Chatushpada" : "Jalachara";
  }
}

type Relation = "friend" | "neutral" | "enemy";
function relation(from: SignLord, to: SignLord): Relation {
  if (NATURAL_FRIENDS[from].includes(to)) return "friend";
  if (NATURAL_ENEMIES[from].includes(to)) return "enemy";
  return "neutral";
}

/** Graha maitri points from the two lords' mutual relationship. */
export function maitriScore(boyLord: SignLord, girlLord: SignLord): number {
  if (boyLord === girlLord) return 5;
  const a = relation(boyLord, girlLord);
  const b = relation(girlLord, boyLord);
  const pair = [a, b].sort().join("+");
  switch (pair) {
    case "friend+friend":
      return 5;
    case "friend+neutral":
      return 4;
    case "neutral+neutral":
      return 3;
    case "enemy+friend":
      return 1;
    case "enemy+neutral":
      return 0.5;
    default: // enemy+enemy
      return 0;
  }
}

/** Counts nakshatras inclusively from one to the other (same star = 1). */
const countStars = (from: number, to: number) => ((to - from + 27) % 27) + 1;
const taraRemainder = (count: number) => (count % 9 === 0 ? 9 : count % 9);
const TARA_NAMES = ["Janma", "Sampat", "Vipat", "Kshema", "Pratyari", "Sadhana", "Naidhana", "Mitra", "Parama Mitra"];
const taraAuspicious = (remainder: number) => ![3, 5, 7].includes(remainder);

export function bandForTotal(total: number): AshtakootaResult["band"] {
  return BANDS.find((b) => total >= b.min)!.label;
}

// ---- main ------------------------------------------------------------------

/**
 * Ashtakoota (36-point) compatibility from the two people's sidereal Moon
 * longitudes. `boyMoon` is the groom's, `girlMoon` the bride's (the tables
 * are oriented that way; the traditional wording is kept).
 */
export function ashtakoota(
  boyMoonLongitude: number,
  girlMoonLongitude: number,
  convention: Partial<MatchingConvention> = {},
): AshtakootaResult {
  const conv: MatchingConvention = { ...DEFAULT_MATCHING_CONVENTION, ...convention };
  const boy = placementFromLongitude(boyMoonLongitude);
  const girl = placementFromLongitude(girlMoonLongitude);
  const koota: KootaScore[] = [];

  // 1. Varna: one point if the boy's varna is equal or superior to the girl's.
  {
    const b = VARNA_RANK_BY_SIGN[boy.sign];
    const g = VARNA_RANK_BY_SIGN[girl.sign];
    koota.push({
      koota: "Varna",
      max: 1,
      score: b >= g ? 1 : 0,
      boy: VARNA_NAMES[b],
      girl: VARNA_NAMES[g],
      detail: b >= g ? "Boy's varna is equal or superior to the girl's." : "Girl's varna is superior to the boy's.",
      disputed: false,
    });
  }

  // 2. Vashya
  {
    const bGroup = vashyaGroup(boy.sign, boy.degreeInSign);
    const gGroup = vashyaGroup(girl.sign, girl.degreeInSign);
    const bi = VASHYA_GROUPS.indexOf(bGroup);
    const gi = VASHYA_GROUPS.indexOf(gGroup);
    const score = VASHYA_TABLES[conv.vashya][gi][bi];
    const values = new Set(Object.values(VASHYA_TABLES).map((t) => t[gi][bi]));
    koota.push({
      koota: "Vashya",
      max: 2,
      score,
      boy: bGroup,
      girl: gGroup,
      detail: `${gGroup} (girl) with ${bGroup} (boy).`,
      disputed: values.size > 1,
    });
  }

  // 3. Tara: count both ways, inauspicious when the remainder (mod 9) is 3, 5 or 7.
  {
    const fromGirl = taraRemainder(countStars(girl.nakshatra, boy.nakshatra));
    const fromBoy = taraRemainder(countStars(boy.nakshatra, girl.nakshatra));
    const score = (taraAuspicious(fromGirl) ? 1.5 : 0) + (taraAuspicious(fromBoy) ? 1.5 : 0);
    koota.push({
      koota: "Tara",
      max: 3,
      score,
      boy: boy.nakshatraName,
      girl: girl.nakshatraName,
      detail: `Counted from the girl's star: ${TARA_NAMES[fromGirl - 1]}; counted from the boy's star: ${TARA_NAMES[fromBoy - 1]}.`,
      disputed: false,
    });
  }

  // 4. Yoni
  {
    const bi = YONI_OF_NAKSHATRA[boy.nakshatra];
    const gi = YONI_OF_NAKSHATRA[girl.nakshatra];
    const pairKey = [YONI_ANIMALS[bi], YONI_ANIMALS[gi]].sort().join("|");
    koota.push({
      koota: "Yoni",
      max: 4,
      score: YONI_MATRIX[gi][bi],
      boy: YONI_ANIMALS[bi],
      girl: YONI_ANIMALS[gi],
      detail: `${YONI_ANIMALS[gi]} (girl) with ${YONI_ANIMALS[bi]} (boy).`,
      disputed: YONI_DISPUTED_PAIRS.has(pairKey),
    });
  }

  // 5. Graha Maitri: friendship of the two Moon-sign lords.
  {
    const bLord = SIGN_LORDS[boy.sign];
    const gLord = SIGN_LORDS[girl.sign];
    koota.push({
      koota: "Graha Maitri",
      max: 5,
      score: maitriScore(bLord, gLord),
      boy: `${bLord} (lord of ${SIGNS[boy.sign]})`,
      girl: `${gLord} (lord of ${SIGNS[girl.sign]})`,
      detail: bLord === gLord ? "Both Moon signs have the same lord." : `${gLord} is a ${relation(gLord, bLord)} to ${bLord}; ${bLord} is a ${relation(bLord, gLord)} to ${gLord}.`,
      disputed: false,
    });
  }

  // 6. Gana
  {
    const bGana = GANA_OF_NAKSHATRA[boy.nakshatra];
    const gGana = GANA_OF_NAKSHATRA[girl.nakshatra];
    const bi = GANAS.indexOf(bGana);
    const gi = GANAS.indexOf(gGana);
    const values = new Set([
      GANA_TABLES.astrotalk[gi][bi],
      GANA_TABLES.astroyogi[gi][bi],
      GANA_TABLE_ASTROSIGHT[gi][bi],
    ]);
    koota.push({
      koota: "Gana",
      max: 6,
      score: GANA_TABLES[conv.gana][gi][bi],
      boy: bGana,
      girl: gGana,
      detail: `${gGana} (girl) with ${bGana} (boy).`,
      disputed: values.size > 1,
    });
  }

  // 7. Bhakoot: sign-to-sign distance; 2/12, 5/9 and 6/8 give 0.
  {
    const d = ((boy.sign - girl.sign + 12) % 12) + 1; // girl's sign to boy's
    const e = ((girl.sign - boy.sign + 12) % 12) + 1; // boy's sign to girl's
    const dosha = [2, 5, 6, 8, 9, 12].includes(d);
    koota.push({
      koota: "Bhakoot",
      max: 7,
      score: dosha ? 0 : 7,
      boy: SIGNS[boy.sign],
      girl: SIGNS[girl.sign],
      detail: `The Moon signs are ${d}/${e} from each other${dosha ? " (an adverse pair)" : ""}.`,
      disputed: false,
    });
  }

  // 8. Nadi: the same nadi scores 0.
  {
    const bNadi = nadiOfNakshatra(boy.nakshatra);
    const gNadi = nadiOfNakshatra(girl.nakshatra);
    koota.push({
      koota: "Nadi",
      max: 8,
      score: bNadi === gNadi ? 0 : 8,
      boy: bNadi,
      girl: gNadi,
      detail: bNadi === gNadi ? "Both have the same nadi." : "The two have different nadis.",
      disputed: false,
    });
  }

  const total = koota.reduce((sum, k) => sum + k.score, 0);
  const score = (name: KootaName) => koota.find((k) => k.koota === name)!.score;
  const doshas = {
    nadi: score("Nadi") === 0,
    bhakoot: score("Bhakoot") === 0,
    gana: score("Gana") === 0,
  };

  const cautions: string[] = [];
  if (doshas.nadi) {
    cautions.push(
      "Nadi dosha: the same nadi. Drik Panchang and Prokerala treat even a high total as inauspicious in this case. Traditional cancellations exist (different pada, friendly lords, and others) but are interpretive and are not applied to the score.",
    );
  }
  if (doshas.bhakoot) {
    cautions.push(
      "Bhakoot dosha: an adverse sign pairing. Cancellations (same or mutually friendly sign lords) are described in the texts but mainstream calculators still score it 0, so it is not applied to the score.",
    );
  }
  const disputed = koota.filter((k) => k.disputed).map((k) => k.koota);
  if (disputed.length) {
    cautions.push(
      `The published tables differ for the ${disputed.join(" and ")} score in this pairing, so that score can vary by source (convention used: ${disputed
        .map((d) => (d === "Vashya" ? `vashya=${conv.vashya}` : d === "Gana" ? `gana=${conv.gana}` : "yoni=aaps.space"))
        .join(", ")}).`,
    );
  }

  return {
    boyMoon: { sign: boy.signName, nakshatra: boy.nakshatraName, pada: boy.pada },
    girlMoon: { sign: girl.signName, nakshatra: girl.nakshatraName, pada: girl.pada },
    total,
    max: 36,
    koota,
    band: bandForTotal(total),
    doshas,
    cautions,
    convention: conv,
  };
}

export function ashtakootaFromCharts(
  boy: VedicChart,
  girl: VedicChart,
  convention: Partial<MatchingConvention> = {},
): AshtakootaResult {
  return ashtakoota(boy.planets.Moon.longitude, girl.planets.Moon.longitude, convention);
}
