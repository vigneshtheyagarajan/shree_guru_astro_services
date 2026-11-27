import type { VedicChart } from "./chart";
import { GRAHAS, SIGNS, type Graha, type SignName } from "./constants";
import { retrogradeFlags, siderealGrahaLongitudes, siderealSlowLongitudes } from "./ephemeris";
import { placementFromLongitude } from "./placement";

// Gochara: where the grahas are NOW relative to the natal chart. Together
// with the running dasha this is what timing questions ("when will...?")
// are answered from. Only facts are computed here; what they mean is left
// to the interpreter.

export interface TransitPosition {
  graha: Graha;
  sign: number;
  signName: SignName;
  degreeInSign: number;
  nakshatra: string;
  pada: number;
  retrograde: boolean;
  /** House counted from the natal lagna (whole sign), 1-12. */
  houseFromLagna: number;
  /** House counted from the natal Moon sign, 1-12. */
  houseFromMoon: number;
}

export type SadeSatiPhase = "rising" | "peak" | "setting";

export interface TransitSnapshot {
  at: string;
  positions: Record<Graha, TransitPosition>;
  saturn: {
    houseFromMoon: number;
    /** Sade Sati: Saturn in the 12th, 1st or 2nd sign from the natal Moon. */
    sadeSati: { active: boolean; phase: SadeSatiPhase | null };
    /** Saturn in the 8th from the Moon. */
    ashtamaShani: boolean;
    /** Saturn in the 4th from the Moon (Ardhashtama / Kantaka Shani). */
    kantakaShani: boolean;
  };
  jupiter: {
    houseFromMoon: number;
    /** Classically favourable Jupiter transits: 2nd, 5th, 7th, 9th, 11th from the Moon. */
    favourableFromMoon: boolean;
  };
}

/** Sade Sati phase from Saturn's house counted from the natal Moon sign. */
export function sadeSatiPhase(saturnHouseFromMoon: number): SadeSatiPhase | null {
  if (saturnHouseFromMoon === 12) return "rising";
  if (saturnHouseFromMoon === 1) return "peak";
  if (saturnHouseFromMoon === 2) return "setting";
  return null;
}

const houseFrom = (fromSign: number, sign: number) => ((sign - fromSign + 12) % 12) + 1;

export function transitsFor(chart: VedicChart, at: Date = new Date()): TransitSnapshot {
  const nodeType = chart.settings.nodeType;
  const { longitudes } = siderealGrahaLongitudes(at, nodeType);
  const retro = retrogradeFlags(at, nodeType);
  const moonSign = chart.planets.Moon.sign;
  const lagnaSign = chart.ascendant.sign;

  const positions = {} as Record<Graha, TransitPosition>;
  for (const graha of GRAHAS) {
    const p = placementFromLongitude(longitudes[graha]);
    positions[graha] = {
      graha,
      sign: p.sign,
      signName: SIGNS[p.sign],
      degreeInSign: p.degreeInSign,
      nakshatra: p.nakshatraName,
      pada: p.pada,
      retrograde: retro[graha],
      houseFromLagna: houseFrom(lagnaSign, p.sign),
      houseFromMoon: houseFrom(moonSign, p.sign),
    };
  }

  const saturnHouse = positions.Saturn.houseFromMoon;
  const phase = sadeSatiPhase(saturnHouse);
  const jupiterHouse = positions.Jupiter.houseFromMoon;

  return {
    at: at.toISOString(),
    positions,
    saturn: {
      houseFromMoon: saturnHouse,
      sadeSati: { active: phase !== null, phase },
      ashtamaShani: saturnHouse === 8,
      kantakaShani: saturnHouse === 4,
    },
    jupiter: {
      houseFromMoon: jupiterHouse,
      favourableFromMoon: [2, 5, 7, 9, 11].includes(jupiterHouse),
    },
  };
}

// ---- timeline of slow-planet sign changes ---------------------------------------

export type SlowGraha = "Jupiter" | "Saturn" | "Rahu" | "Ketu";
const SLOW_GRAHAS: readonly SlowGraha[] = ["Jupiter", "Saturn", "Rahu", "Ketu"];

export interface TransitEvent {
  /** Day the graha is first seen in the new sign (YYYY-MM-DD, sampled at noon UTC). */
  date: string;
  graha: SlowGraha;
  fromSign: SignName;
  toSign: SignName;
  /** "retrograde" when a planet slips back into the previous sign. */
  direction: "forward" | "retrograde";
  houseFromLagna: number;
  houseFromMoon: number;
  /** Saturn only: the Sade Sati phase from this date (null = none). */
  sadeSatiPhase?: SadeSatiPhase | null;
}

/**
 * Every sign change of Jupiter, Saturn, Rahu and Ketu over the next `years`,
 * with the house each lands in from the natal lagna and Moon. This is what
 * "when will Saturn leave my Moon sign / when does Jupiter reach my 7th"
 * is answered from, so the interpreter never has to remember ingress dates.
 */
export function transitTimeline(chart: VedicChart, from: Date = new Date(), years = 3): TransitEvent[] {
  const nodeType = chart.settings.nodeType;
  const moonSign = chart.planets.Moon.sign;
  const lagnaSign = chart.ascendant.sign;
  const days = Math.round(Math.min(Math.max(years, 0.25), 8) * 365.25);
  const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), 12));

  const signOf = (lon: number) => Math.floor((((lon % 360) + 360) % 360) / 30);
  const first = siderealSlowLongitudes(start, nodeType);
  const previousSign = Object.fromEntries(SLOW_GRAHAS.map((g) => [g, signOf(first[g])])) as Record<SlowGraha, number>;

  const events: TransitEvent[] = [];
  for (let d = 1; d <= days; d++) {
    const at = new Date(start.getTime() + d * 86_400_000);
    const now = siderealSlowLongitudes(at, nodeType);
    for (const graha of SLOW_GRAHAS) {
      const sign = signOf(now[graha]);
      if (sign === previousSign[graha]) continue;
      const forward = (sign - previousSign[graha] + 12) % 12 === 1;
      events.push({
        date: at.toISOString().slice(0, 10),
        graha,
        fromSign: SIGNS[previousSign[graha]],
        toSign: SIGNS[sign],
        direction: forward ? "forward" : "retrograde",
        houseFromLagna: houseFrom(lagnaSign, sign),
        houseFromMoon: houseFrom(moonSign, sign),
        ...(graha === "Saturn" ? { sadeSatiPhase: sadeSatiPhase(houseFrom(moonSign, sign)) } : {}),
      });
      previousSign[graha] = sign;
    }
  }
  return events;
}
