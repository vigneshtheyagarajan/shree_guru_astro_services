import {
  NAKSHATRA_SPAN,
  VIMSHOTTARI_ORDER,
  VIMSHOTTARI_TOTAL_YEARS,
  VIMSHOTTARI_YEARS,
} from "./constants";
import { norm360 } from "./math";

type DashaLord = (typeof VIMSHOTTARI_ORDER)[number];

export interface DashaPeriod {
  lord: DashaLord;
  start: Date;
  end: Date;
}

export interface Mahadasha extends DashaPeriod {
  antardashas: DashaPeriod[];
}

export interface DashaOptions {
  /**
   * Length of a dasha "year" in days. Software differs here: 365.25
   * (Julian, default), 365.2422 (tropical) and 360 (savana) are all in use.
   * The choice shifts dates by days over a lifetime, never the order.
   */
  yearDays?: number;
  /** How far past birth to generate periods, in years. */
  horizonYears?: number;
}

const DAY_MS = 86_400_000;

function subPeriods(
  lord: DashaLord,
  totalYears: number,
  nominalStart: number,
  yearMs: number,
  clipFrom: number,
): DashaPeriod[] {
  const startIndex = VIMSHOTTARI_ORDER.indexOf(lord);
  const periods: DashaPeriod[] = [];
  let cursor = nominalStart;
  for (let i = 0; i < 9; i++) {
    const subLord = VIMSHOTTARI_ORDER[(startIndex + i) % 9];
    const lengthMs = (totalYears * VIMSHOTTARI_YEARS[subLord] * yearMs) / VIMSHOTTARI_TOTAL_YEARS;
    const start = cursor;
    const end = cursor + lengthMs;
    cursor = end;
    if (end <= clipFrom) continue; // wholly before birth
    periods.push({ lord: subLord, start: new Date(Math.max(start, clipFrom)), end: new Date(end) });
  }
  return periods;
}

/**
 * Vimshottari mahadashas and antardashas from the Moon's sidereal longitude.
 * The first mahadasha is the one the Moon's nakshatra lord rules, with only
 * its unexpired balance running from birth.
 */
export function vimshottariDashas(
  moonLongitude: number,
  birth: Date,
  options: DashaOptions = {},
): Mahadasha[] {
  const yearMs = (options.yearDays ?? 365.25) * DAY_MS;
  const horizonMs = (options.horizonYears ?? VIMSHOTTARI_TOTAL_YEARS) * yearMs;
  const birthMs = birth.getTime();

  const longitude = norm360(moonLongitude);
  const nakshatra = Math.min(26, Math.floor(longitude / NAKSHATRA_SPAN));
  const fractionElapsed = (longitude - nakshatra * NAKSHATRA_SPAN) / NAKSHATRA_SPAN;
  const firstIndex = nakshatra % 9;
  const firstLord = VIMSHOTTARI_ORDER[firstIndex];

  // Where the first mahadasha would have begun, had it run its full length.
  let cursor = birthMs - fractionElapsed * VIMSHOTTARI_YEARS[firstLord] * yearMs;

  const dashas: Mahadasha[] = [];
  for (let i = 0; cursor < birthMs + horizonMs; i++) {
    const lord = VIMSHOTTARI_ORDER[(firstIndex + i) % 9];
    const years = VIMSHOTTARI_YEARS[lord];
    const nominalStart = cursor;
    const end = cursor + years * yearMs;
    dashas.push({
      lord,
      start: new Date(Math.max(nominalStart, birthMs)),
      end: new Date(end),
      antardashas: subPeriods(lord, years, nominalStart, yearMs, birthMs),
    });
    cursor = end;
  }
  return dashas;
}

export interface DashaPosition {
  mahadasha: DashaPeriod;
  antardasha: DashaPeriod;
  pratyantardasha: DashaPeriod;
}

/** The running mahadasha / antardasha / pratyantardasha at a given moment. */
export function dashaAt(
  dashas: Mahadasha[],
  at: Date,
  options: DashaOptions = {},
): DashaPosition | null {
  const t = at.getTime();
  const mahadasha = dashas.find((d) => t >= d.start.getTime() && t < d.end.getTime());
  if (!mahadasha) return null;
  const antardasha = mahadasha.antardashas.find((a) => t >= a.start.getTime() && t < a.end.getTime());
  if (!antardasha) return null;

  // Pratyantardasha: antardasha subdivided the same proportional way,
  // starting with the antardasha lord. Computed on demand.
  const yearMs = (options.yearDays ?? 365.25) * DAY_MS;
  // If the antardasha was clipped at birth its true start is earlier; recover it.
  const fullLengthYears =
    (VIMSHOTTARI_YEARS[mahadasha.lord] * VIMSHOTTARI_YEARS[antardasha.lord]) / VIMSHOTTARI_TOTAL_YEARS;
  const nominalStart = antardasha.end.getTime() - fullLengthYears * yearMs;
  const pratyantardashas = subPeriods(
    antardasha.lord,
    fullLengthYears,
    nominalStart,
    yearMs,
    antardasha.start.getTime(),
  );
  const pratyantardasha = pratyantardashas.find((p) => t >= p.start.getTime() && t < p.end.getTime());
  if (!pratyantardasha) return null;

  return { mahadasha, antardasha, pratyantardasha };
}

