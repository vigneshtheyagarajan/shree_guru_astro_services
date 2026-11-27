// Static Jyotish reference data used by the chart engine. Everything here is
// classical, widely agreed tables (rashis, nakshatras, Vimshottari order,
// natural friendships, exaltation/debilitation). Tables whose exact values
// vary between schools (e.g. matching charts) live in matching-tables.ts.

export const SIGNS = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
] as const;
export type SignName = (typeof SIGNS)[number];

export const GRAHAS = [
  "Sun",
  "Moon",
  "Mars",
  "Mercury",
  "Jupiter",
  "Venus",
  "Saturn",
  "Rahu",
  "Ketu",
] as const;
export type Graha = (typeof GRAHAS)[number];

/** The seven true planets that rule signs (Rahu/Ketu rule none classically). */
export type SignLord = Exclude<Graha, "Rahu" | "Ketu">;

export const SIGN_LORDS: readonly SignLord[] = [
  "Mars", // Aries
  "Venus", // Taurus
  "Mercury", // Gemini
  "Moon", // Cancer
  "Sun", // Leo
  "Mercury", // Virgo
  "Venus", // Libra
  "Mars", // Scorpio
  "Jupiter", // Sagittarius
  "Saturn", // Capricorn
  "Saturn", // Aquarius
  "Jupiter", // Pisces
];

export const NAKSHATRAS = [
  "Ashwini",
  "Bharani",
  "Krittika",
  "Rohini",
  "Mrigashira",
  "Ardra",
  "Punarvasu",
  "Pushya",
  "Ashlesha",
  "Magha",
  "Purva Phalguni",
  "Uttara Phalguni",
  "Hasta",
  "Chitra",
  "Swati",
  "Vishakha",
  "Anuradha",
  "Jyeshtha",
  "Mula",
  "Purva Ashadha",
  "Uttara Ashadha",
  "Shravana",
  "Dhanishta",
  "Shatabhisha",
  "Purva Bhadrapada",
  "Uttara Bhadrapada",
  "Revati",
] as const;
export type NakshatraName = (typeof NAKSHATRAS)[number];

/** Width of one nakshatra / one pada, in degrees. */
export const NAKSHATRA_SPAN = 360 / 27; // 13°20'
export const PADA_SPAN = NAKSHATRA_SPAN / 4; // 3°20'

/**
 * Vimshottari dasha order and lengths (years). The nakshatra lords repeat in
 * this order starting from Ashwini, so lord(nakshatra n) = ORDER[n % 9].
 */
export const VIMSHOTTARI_ORDER = [
  "Ketu",
  "Venus",
  "Sun",
  "Moon",
  "Mars",
  "Rahu",
  "Jupiter",
  "Saturn",
  "Mercury",
] as const satisfies readonly Graha[];

export const VIMSHOTTARI_YEARS: Record<(typeof VIMSHOTTARI_ORDER)[number], number> = {
  Ketu: 7,
  Venus: 20,
  Sun: 6,
  Moon: 10,
  Mars: 7,
  Rahu: 18,
  Jupiter: 16,
  Saturn: 19,
  Mercury: 17,
};
export const VIMSHOTTARI_TOTAL_YEARS = 120;

/** Exaltation / debilitation signs (0 = Aries) for the seven planets. */
export const EXALTATION_SIGN: Record<SignLord, number> = {
  Sun: 0, // Aries
  Moon: 1, // Taurus
  Mars: 9, // Capricorn
  Mercury: 5, // Virgo
  Jupiter: 3, // Cancer
  Venus: 11, // Pisces
  Saturn: 6, // Libra
};
export const DEBILITATION_SIGN: Record<SignLord, number> = {
  Sun: 6,
  Moon: 7,
  Mars: 3,
  Mercury: 11,
  Jupiter: 9,
  Venus: 5,
  Saturn: 0,
};

/** Signs each planet owns. */
export const OWN_SIGNS: Record<SignLord, readonly number[]> = {
  Sun: [4],
  Moon: [3],
  Mars: [0, 7],
  Mercury: [2, 5],
  Jupiter: [8, 11],
  Venus: [1, 6],
  Saturn: [9, 10],
};

/**
 * Natural (naisargika) planetary relationships per Parashara. Used for sign
 * dignity and for the graha-maitri koota in kundli matching.
 */
export const NATURAL_FRIENDS: Record<SignLord, readonly SignLord[]> = {
  Sun: ["Moon", "Mars", "Jupiter"],
  Moon: ["Sun", "Mercury"],
  Mars: ["Sun", "Moon", "Jupiter"],
  Mercury: ["Sun", "Venus"],
  Jupiter: ["Sun", "Moon", "Mars"],
  Venus: ["Mercury", "Saturn"],
  Saturn: ["Mercury", "Venus"],
};
export const NATURAL_ENEMIES: Record<SignLord, readonly SignLord[]> = {
  Sun: ["Venus", "Saturn"],
  Moon: [],
  Mars: ["Mercury"],
  Mercury: ["Moon"],
  Jupiter: ["Mercury", "Venus"],
  Venus: ["Sun", "Moon"],
  Saturn: ["Sun", "Moon", "Mars"],
};

/** Graha drishti: houses (counted from the planet) a graha aspects. */
export const ASPECT_HOUSES: Record<Graha, readonly number[]> = {
  Sun: [7],
  Moon: [7],
  Mercury: [7],
  Venus: [7],
  Mars: [4, 7, 8],
  Jupiter: [5, 7, 9],
  Saturn: [3, 7, 10],
  // Rahu/Ketu aspects are disputed between schools; the engine leaves them
  // out rather than assert one school's view.
  Rahu: [],
  Ketu: [],
};
