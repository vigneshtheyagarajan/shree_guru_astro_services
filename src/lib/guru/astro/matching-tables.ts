// Ashtakoota (36-point) score tables.
//
// Provenance: these were cross-checked against several published sources
// (Astroyogi, OnlineJyotish, Astrotalk, AstroSight, aaps.space, Drik
// Panchang, AstroSage) and against a real Prokerala sample report (girl
// Ashwini x boy Magha = 20/36). Where mainstream sources genuinely
// disagree, the alternatives are kept as named conventions below and the
// engine reports when a result lands on a disputed cell, instead of
// pretending there is one true table. See docs/guru/ for the open
// questions for astrologer sign-off.
//
// All score matrices are indexed [girl][boy].

import type { SignLord } from "./constants";

// ---------------------------------------------------------------- Varna (1)

/** Higher = superior. Brahmin 4, Kshatriya 3, Vaishya 2, Shudra 1. */
export const VARNA_RANK_BY_SIGN: readonly number[] = [
  3, // Aries      Kshatriya
  2, // Taurus     Vaishya
  1, // Gemini     Shudra
  4, // Cancer     Brahmin
  3, // Leo        Kshatriya
  2, // Virgo      Vaishya
  1, // Libra      Shudra
  4, // Scorpio    Brahmin
  3, // Sagittarius Kshatriya
  2, // Capricorn  Vaishya
  1, // Aquarius   Shudra
  4, // Pisces     Brahmin
];
export const VARNA_NAMES: Record<number, string> = { 4: "Brahmin", 3: "Kshatriya", 2: "Vaishya", 1: "Shudra" };

// -------------------------------------------------------------- Vashya (2)

export const VASHYA_GROUPS = ["Chatushpada", "Manava", "Jalachara", "Vanachara", "Keeta"] as const;
export type VashyaGroup = (typeof VASHYA_GROUPS)[number];

export type VashyaConvention = "onlinejyotish" | "astrotalk" | "astroyogi";

export const VASHYA_TABLES: Record<VashyaConvention, readonly (readonly number[])[]> = {
  // Default: agrees with the one real Prokerala data point (girl
  // Chatushpada x boy Vanachara = 0).
  onlinejyotish: [
    [2, 1, 1, 0, 1],
    [1, 2, 0.5, 0, 1],
    [1, 0.5, 2, 1, 1],
    [0, 0, 1, 2, 0],
    [1, 0, 1, 0, 2],
  ],
  astrotalk: [
    [2, 1, 1, 0, 1],
    [1, 2, 0.5, 0, 1],
    [1, 0.5, 2, 0, 1],
    [0, 0, 0, 2, 0],
    [1, 1, 1, 0, 2],
  ],
  // Outlier (1.5-point cells); contradicts the Prokerala sample.
  astroyogi: [
    [2, 1, 1, 1.5, 1],
    [1, 2, 1.5, 0, 1],
    [1, 1.5, 2, 1, 1],
    [0, 0, 0, 2, 0],
    [1, 1, 1, 0, 2],
  ],
};

// ---------------------------------------------------------------- Gana (6)

export const GANAS = ["Deva", "Manushya", "Rakshasa"] as const;
export type Gana = (typeof GANAS)[number];

/** Gana of each nakshatra (index 0 = Ashwini). All sources agree. */
export const GANA_OF_NAKSHATRA: readonly Gana[] = [
  "Deva", // Ashwini
  "Manushya", // Bharani
  "Rakshasa", // Krittika
  "Manushya", // Rohini
  "Deva", // Mrigashira
  "Manushya", // Ardra
  "Deva", // Punarvasu
  "Deva", // Pushya
  "Rakshasa", // Ashlesha
  "Rakshasa", // Magha
  "Manushya", // Purva Phalguni
  "Manushya", // Uttara Phalguni
  "Deva", // Hasta
  "Rakshasa", // Chitra
  "Deva", // Swati
  "Rakshasa", // Vishakha
  "Deva", // Anuradha
  "Rakshasa", // Jyeshtha
  "Rakshasa", // Mula
  "Manushya", // Purva Ashadha
  "Manushya", // Uttara Ashadha
  "Deva", // Shravana
  "Rakshasa", // Dhanishta
  "Rakshasa", // Shatabhisha
  "Manushya", // Purva Bhadrapada
  "Manushya", // Uttara Bhadrapada
  "Deva", // Revati
];

export type GanaConvention = "astrotalk" | "astroyogi";

export const GANA_TABLES: Record<GanaConvention, readonly (readonly number[])[]> = {
  // Default: consistent with Prokerala's real output (girl Deva x boy
  // Rakshasa = 1), AstroSage's (girl Rakshasa x boy Manushya = 0) and with
  // the majority on (girl Deva x boy Manushya) = 5.
  astrotalk: [
    [6, 5, 1],
    [5, 6, 0],
    [1, 0, 6],
  ],
  // Used by Astroyogi / OnlineJyotish / PyJHora; gives 6 and 0 where the
  // above gives 5 and 1.
  astroyogi: [
    [6, 6, 0],
    [5, 6, 0],
    [1, 0, 6],
  ],
};
/** A third published variant, used only to flag disputed cells. */
export const GANA_TABLE_ASTROSIGHT: readonly (readonly number[])[] = [
  [6, 5, 0],
  [5, 6, 0],
  [0, 1, 6],
];

// ---------------------------------------------------------------- Yoni (4)

export const YONI_ANIMALS = [
  "Horse",
  "Elephant",
  "Sheep",
  "Serpent",
  "Dog",
  "Cat",
  "Rat",
  "Cow",
  "Buffalo",
  "Tiger",
  "Deer",
  "Monkey",
  "Mongoose",
  "Lion",
] as const;
export type YoniAnimal = (typeof YONI_ANIMALS)[number];

/** Index into YONI_ANIMALS for each nakshatra (0 = Ashwini). All sources agree. */
export const YONI_OF_NAKSHATRA: readonly number[] = [
  0, // Ashwini      Horse
  1, // Bharani      Elephant
  2, // Krittika     Sheep
  3, // Rohini       Serpent
  3, // Mrigashira   Serpent
  4, // Ardra        Dog
  5, // Punarvasu    Cat
  2, // Pushya       Sheep
  5, // Ashlesha     Cat
  6, // Magha        Rat
  6, // P. Phalguni  Rat
  7, // U. Phalguni  Cow
  8, // Hasta        Buffalo
  9, // Chitra       Tiger
  8, // Swati        Buffalo
  9, // Vishakha     Tiger
  10, // Anuradha    Deer
  10, // Jyeshtha    Deer
  4, // Mula         Dog
  11, // P. Ashadha  Monkey
  12, // U. Ashadha  Mongoose
  11, // Shravana    Monkey
  13, // Dhanishta   Lion
  0, // Shatabhisha  Horse
  13, // P. Bhadrapada Lion
  7, // U. Bhadrapada Cow
  1, // Revati       Elephant
];

/**
 * Symmetric 14x14 matrix, order = YONI_ANIMALS. Same animal 4; sworn
 * enemies 0 (Horse-Buffalo, Elephant-Lion, Sheep-Monkey, Serpent-Mongoose,
 * Dog-Deer, Cat-Rat, Cow-Tiger). Only two full published matrices exist
 * and they differ in one cell (Horse-Deer: 3 here, 1 in PyJHora).
 */
export const YONI_MATRIX: readonly (readonly number[])[] = [
  [4, 2, 2, 3, 2, 2, 2, 1, 0, 1, 3, 3, 2, 1],
  [2, 4, 3, 3, 2, 2, 2, 2, 3, 1, 2, 3, 2, 0],
  [2, 3, 4, 2, 1, 2, 1, 3, 3, 1, 2, 0, 3, 1],
  [3, 3, 2, 4, 2, 1, 1, 1, 1, 2, 2, 2, 0, 2],
  [2, 2, 1, 2, 4, 2, 1, 2, 2, 1, 0, 2, 1, 1],
  [2, 2, 2, 1, 2, 4, 0, 2, 2, 1, 3, 3, 2, 1],
  [2, 2, 1, 1, 1, 0, 4, 2, 2, 2, 2, 2, 1, 2],
  [1, 2, 3, 1, 2, 2, 2, 4, 3, 0, 3, 2, 2, 1],
  [0, 3, 3, 1, 2, 2, 2, 3, 4, 1, 2, 2, 2, 1],
  [1, 1, 1, 2, 1, 1, 2, 0, 1, 4, 1, 1, 2, 1],
  [3, 2, 2, 2, 0, 3, 2, 3, 2, 1, 4, 2, 2, 1],
  [3, 3, 0, 2, 2, 3, 2, 2, 2, 1, 2, 4, 3, 2],
  [2, 2, 3, 0, 1, 2, 1, 2, 2, 2, 2, 3, 4, 2],
  [1, 0, 1, 2, 1, 1, 2, 1, 1, 1, 1, 2, 2, 4],
];
/** Animal pairs (by name, order-independent) where published matrices differ. */
export const YONI_DISPUTED_PAIRS: ReadonlySet<string> = new Set(["Deer|Horse"]);

// ------------------------------------------------------------------ Nadi (8)

export const NADIS = ["Adi", "Madhya", "Antya"] as const;
export type Nadi = (typeof NADIS)[number];

/** Nadi of nakshatra index i: 0,1,2,2,1,0 repeating (ends 0,1,2). All sources agree. */
export function nadiOfNakshatra(nakshatra: number): Nadi {
  return NADIS[[0, 1, 2, 2, 1, 0][nakshatra % 6]];
}

// ------------------------------------------------------------- Graha Maitri

/** Used only to name the planets when describing a result. */
export type MaitriLord = SignLord;

// ------------------------------------------------------------------- Bands

export interface Band {
  min: number;
  label: "not recommended" | "acceptable" | "good" | "excellent";
}
/**
 * Majority published banding. 18 is the universal minimum. Drik Panchang /
 * Prokerala additionally make the verdict depend on Bhakoot and Nadi (see
 * the cautions the engine attaches); AstroSage and others use 18/24/32.
 */
export const BANDS: readonly Band[] = [
  { min: 33, label: "excellent" },
  { min: 25, label: "good" },
  { min: 18, label: "acceptable" },
  { min: 0, label: "not recommended" },
];
