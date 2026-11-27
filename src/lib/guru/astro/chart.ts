import { ASPECT_HOUSES, GRAHAS, SIGNS, SIGN_LORDS, type Graha, type SignName } from "./constants";
import { dashaAt, vimshottariDashas, type DashaOptions, type DashaPosition, type Mahadasha } from "./dasha";
import {
  retrogradeFlags,
  siderealAscendant,
  siderealGrahaLongitudes,
  type NodeType,
} from "./ephemeris";
import { julianDay } from "./math";
import { dignityOf, placementFromLongitude, type Dignity, type Placement } from "./placement";
import { birthMomentToUtc, type BirthInput } from "./time";

export interface PlanetPosition extends Placement {
  graha: Graha;
  /** Whole-sign house counted from the ascendant, 1-12. */
  house: number;
  retrograde: boolean;
  dignity: Dignity | null;
}

export interface HouseInfo {
  house: number;
  sign: number;
  signName: SignName;
  lord: Graha;
  /** House number where the lord sits. */
  lordInHouse: number;
  occupants: Graha[];
}

export interface Aspect {
  from: Graha;
  to: Graha;
  /** Aspect strength is full for graha drishti; kept as a label for clarity. */
  kind: "graha-drishti";
}

export interface ChartSettings {
  ayanamsa: "lahiri";
  houseSystem: "whole-sign";
  nodeType: NodeType;
  dashaYearDays: number;
  ephemeris: "astronomy-engine (validated against Swiss Ephemeris)";
}

export interface VedicChart {
  input: BirthInput;
  /** Birth instant in UTC (ISO). */
  utc: string;
  utcOffsetMinutes: number;
  julianDayUt: number;
  /** Mean Lahiri ayanamsa at birth, degrees. */
  ayanamsa: number;
  ascendant: Placement;
  planets: Record<Graha, PlanetPosition>;
  houses: HouseInfo[];
  /** Moon sign / nakshatra drive most predictive and matching systems. */
  moon: { sign: SignName; nakshatra: string; pada: number };
  aspects: Aspect[];
  /** Graha groups sharing a sign. */
  conjunctions: Graha[][];
  dashas: Mahadasha[];
  /** Things the user should double-check (time zone quirks etc.). */
  warnings: string[];
  settings: ChartSettings;
}

export interface ChartOptions extends DashaOptions {
  nodeType?: NodeType;
}

/**
 * Builds a complete sidereal (Lahiri) birth chart. All numbers in the
 * result are computed here -- the AI layer only ever reads this object.
 */
export function buildVedicChart(input: BirthInput, options: ChartOptions = {}): VedicChart {
  const nodeType = options.nodeType ?? "mean";
  const yearDays = options.yearDays ?? 365.25;
  const moment = birthMomentToUtc(input);

  const { longitudes, ayanamsa } = siderealGrahaLongitudes(moment.utc, nodeType);
  const retro = retrogradeFlags(moment.utc, nodeType);
  const ascendant = placementFromLongitude(
    siderealAscendant(moment.utc, input.latitude, input.longitude),
  );

  const planets = {} as Record<Graha, PlanetPosition>;
  for (const graha of GRAHAS) {
    const placement = placementFromLongitude(longitudes[graha]);
    planets[graha] = {
      ...placement,
      graha,
      house: ((placement.sign - ascendant.sign + 12) % 12) + 1,
      retrograde: retro[graha],
      dignity: dignityOf(graha, placement.sign),
    };
  }

  const houses: HouseInfo[] = Array.from({ length: 12 }, (_, i) => {
    const sign = (ascendant.sign + i) % 12;
    const lord = SIGN_LORDS[sign];
    return {
      house: i + 1,
      sign,
      signName: SIGNS[sign],
      lord,
      lordInHouse: planets[lord].house,
      occupants: GRAHAS.filter((g) => planets[g].house === i + 1),
    };
  });

  const aspects: Aspect[] = [];
  for (const from of GRAHAS) {
    for (const n of ASPECT_HOUSES[from]) {
      const targetHouse = ((planets[from].house + n - 2) % 12) + 1;
      for (const to of houses[targetHouse - 1].occupants) {
        if (to !== from) aspects.push({ from, to, kind: "graha-drishti" });
      }
    }
  }

  const conjunctions = houses.map((h) => h.occupants).filter((group) => group.length > 1);

  return {
    input,
    utc: moment.utc.toISOString(),
    utcOffsetMinutes: moment.offsetMinutes,
    julianDayUt: julianDay(moment.utc),
    ayanamsa,
    ascendant,
    planets,
    houses,
    moon: {
      sign: planets.Moon.signName,
      nakshatra: planets.Moon.nakshatraName,
      pada: planets.Moon.pada,
    },
    aspects,
    conjunctions,
    dashas: vimshottariDashas(planets.Moon.longitude, moment.utc, { yearDays, horizonYears: options.horizonYears }),
    warnings: moment.warnings,
    settings: {
      ayanamsa: "lahiri",
      houseSystem: "whole-sign",
      nodeType,
      dashaYearDays: yearDays,
      ephemeris: "astronomy-engine (validated against Swiss Ephemeris)",
    },
  };
}

/** The dasha running at `at` for an already-built chart. */
export function currentDasha(chart: VedicChart, at: Date = new Date()): DashaPosition | null {
  return dashaAt(chart.dashas, at, { yearDays: chart.settings.dashaYearDays });
}
