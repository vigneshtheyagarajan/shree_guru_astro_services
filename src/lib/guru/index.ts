// "Guru": the AI astrologer. This module holds the deterministic engines
// (charts, dashas, matching, numerology, tarot). The AI layer calls these as
// tools and only ever interprets their output -- it never computes a
// planetary position, a score or a card draw itself.
//
// Self-contained on purpose: nothing here imports from the rest of the app,
// so the existing marketplace features are unaffected.

export { buildVedicChart, currentDasha } from "./astro/chart";
export type { VedicChart, PlanetPosition, HouseInfo, Aspect, ChartOptions } from "./astro/chart";
export { GuruInputError, birthMomentToUtc } from "./astro/time";
export type { BirthInput } from "./astro/time";
export type { NodeType } from "./astro/ephemeris";
export { vimshottariDashas, dashaAt } from "./astro/dasha";
export type { Mahadasha, DashaPeriod, DashaPosition } from "./astro/dasha";
export { kujaDosha } from "./astro/kuja";
export type { KujaDosha, KujaSchool } from "./astro/kuja";
export { ashtakoota, ashtakootaFromCharts, DEFAULT_MATCHING_CONVENTION } from "./astro/matching";
export type { AshtakootaResult, KootaScore, MatchingConvention } from "./astro/matching";
export { formatChartText } from "./astro/format";
export { computeNumerology } from "./numerology";
export type { NumerologyInput, NumerologyResult } from "./numerology";
export { drawTarot, TAROT_DECK, SPREADS } from "./tarot";
export type { TarotReading, SpreadName, DrawnCard } from "./tarot";
