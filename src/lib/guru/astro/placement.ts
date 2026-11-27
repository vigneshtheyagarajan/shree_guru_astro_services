import {
  DEBILITATION_SIGN,
  EXALTATION_SIGN,
  NAKSHATRAS,
  NAKSHATRA_SPAN,
  NATURAL_ENEMIES,
  NATURAL_FRIENDS,
  OWN_SIGNS,
  PADA_SPAN,
  SIGNS,
  SIGN_LORDS,
  VIMSHOTTARI_ORDER,
  type Graha,
  type NakshatraName,
  type SignLord,
  type SignName,
} from "./constants";
import { norm360 } from "./math";

export interface Placement {
  /** Sidereal longitude, degrees in [0, 360). */
  longitude: number;
  /** 0 = Aries ... 11 = Pisces. */
  sign: number;
  signName: SignName;
  degreeInSign: number;
  /** 0 = Ashwini ... 26 = Revati. */
  nakshatra: number;
  nakshatraName: NakshatraName;
  /** 1-4 */
  pada: 1 | 2 | 3 | 4;
  nakshatraLord: Graha;
  /** Sign in the navamsa (D9) chart. */
  navamsaSign: number;
  navamsaSignName: SignName;
}

export function placementFromLongitude(rawLongitude: number): Placement {
  const longitude = norm360(rawLongitude);
  const sign = Math.floor(longitude / 30);
  const nakshatra = Math.min(26, Math.floor(longitude / NAKSHATRA_SPAN));
  const withinNakshatra = longitude - nakshatra * NAKSHATRA_SPAN;
  const pada = (Math.min(3, Math.floor(withinNakshatra / PADA_SPAN)) + 1) as 1 | 2 | 3 | 4;
  // Navamsa: each sign splits into nine 3°20' parts and the sequence of
  // signs runs continuously from Aries (this reproduces the movable /
  // fixed / dual starting rule).
  const navamsaSign = Math.floor((longitude * 9) / 30) % 12;

  return {
    longitude,
    sign,
    signName: SIGNS[sign],
    degreeInSign: longitude - sign * 30,
    nakshatra,
    nakshatraName: NAKSHATRAS[nakshatra],
    pada,
    nakshatraLord: VIMSHOTTARI_ORDER[nakshatra % 9],
    navamsaSign,
    navamsaSignName: SIGNS[navamsaSign],
  };
}

export type Dignity = "exalted" | "debilitated" | "own" | "friendly" | "neutral" | "enemy";

/**
 * Sign dignity of a planet by natural relationship (the Sun..Saturn only;
 * the nodes have no agreed dignity table).
 */
export function dignityOf(graha: Graha, sign: number): Dignity | null {
  if (graha === "Rahu" || graha === "Ketu") return null;
  const planet = graha as SignLord;
  if (EXALTATION_SIGN[planet] === sign) return "exalted";
  if (DEBILITATION_SIGN[planet] === sign) return "debilitated";
  if (OWN_SIGNS[planet].includes(sign)) return "own";
  const lord = SIGN_LORDS[sign];
  if (NATURAL_FRIENDS[planet].includes(lord)) return "friendly";
  if (NATURAL_ENEMIES[planet].includes(lord)) return "enemy";
  return "neutral";
}
