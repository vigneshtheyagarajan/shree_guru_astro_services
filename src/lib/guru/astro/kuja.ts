import type { VedicChart } from "./chart";

// Kuja (Mangal / Manglik) dosha: Mars placed in certain houses counted from
// the lagna, the Moon or Venus. Schools differ on whether the 2nd house
// counts (South Indian practice includes it, much of North India does not),
// so the house set is an explicit, named choice rather than a hidden default.
// Cancellation rules (Mars in own/exalted sign, mutual dosha between the two
// people, aspects by Jupiter...) are interpretive and are left to the
// astrologer-reviewed rule library, not decided here.

export type KujaSchool = "south" | "north";

const DOSHA_HOUSES: Record<KujaSchool, readonly number[]> = {
  south: [1, 2, 4, 7, 8, 12],
  north: [1, 4, 7, 8, 12],
};

export interface KujaReference {
  /** House of Mars counted from this reference point, 1-12. */
  house: number;
  present: boolean;
}

export interface KujaDosha {
  school: KujaSchool;
  houses: readonly number[];
  fromLagna: KujaReference;
  fromMoon: KujaReference;
  fromVenus: KujaReference;
  /** The common test: dosha from the lagna or from the Moon. */
  present: boolean;
  marsDignity: VedicChart["planets"]["Mars"]["dignity"];
  /** Reminder that cancellations exist and are not applied here. */
  note: string;
}

export function kujaDosha(chart: VedicChart, school: KujaSchool = "south"): KujaDosha {
  const houses = DOSHA_HOUSES[school];
  const marsSign = chart.planets.Mars.sign;
  const reference = (fromSign: number): KujaReference => {
    const house = ((marsSign - fromSign + 12) % 12) + 1;
    return { house, present: houses.includes(house) };
  };
  const fromLagna = reference(chart.ascendant.sign);
  const fromMoon = reference(chart.planets.Moon.sign);
  const fromVenus = reference(chart.planets.Venus.sign);

  return {
    school,
    houses,
    fromLagna,
    fromMoon,
    fromVenus,
    present: fromLagna.present || fromMoon.present,
    marsDignity: chart.planets.Mars.dignity,
    note: "Cancellation conditions are not applied here; they are interpretive and handled by the reviewed rule library.",
  };
}
