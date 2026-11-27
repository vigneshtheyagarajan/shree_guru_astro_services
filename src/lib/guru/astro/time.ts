import { DateTime, IANAZone } from "luxon";

/** Thrown for any input a chart cannot be computed from (bad date, zone...). */
export class GuruInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GuruInputError";
  }
}

export interface BirthInput {
  /** Free text, only echoed back. */
  name?: string;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  /** Local wall-clock time, HH:mm or HH:mm:ss (24h). */
  time: string;
  /** IANA time-zone id of the birthplace, e.g. "Asia/Kolkata". */
  timezone: string;
  /** Degrees, north positive. */
  latitude: number;
  /** Degrees, east positive. */
  longitude: number;
}

export interface BirthMoment {
  utc: Date;
  /** UTC offset that applied at the birthplace at that moment, minutes. */
  offsetMinutes: number;
  /**
   * Things the user should confirm because they can silently move the
   * chart: an invalid/ambiguous local time, a historical local-mean-time
   * offset, a very high latitude.
   */
  warnings: string[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

/**
 * Converts a birthplace-local date/time to UTC using the IANA time-zone
 * database, which carries historical offsets (India's 1942-45 war time,
 * pre-1906 local mean time, etc.). A wrong offset shifts the ascendant by
 * roughly 1 degree per 4 minutes, so this step matters as much as the
 * ephemeris.
 */
export function birthMomentToUtc(input: BirthInput): BirthMoment {
  if (!DATE_RE.test(input.date)) {
    throw new GuruInputError("Date of birth must be in YYYY-MM-DD format.");
  }
  if (!TIME_RE.test(input.time)) {
    throw new GuruInputError("Time of birth must be in 24-hour HH:mm format.");
  }
  if (!IANAZone.isValidZone(input.timezone)) {
    throw new GuruInputError(`Unknown time zone "${input.timezone}".`);
  }
  if (!Number.isFinite(input.latitude) || Math.abs(input.latitude) > 90) {
    throw new GuruInputError("Latitude must be between -90 and 90.");
  }
  if (!Number.isFinite(input.longitude) || Math.abs(input.longitude) > 180) {
    throw new GuruInputError("Longitude must be between -180 and 180.");
  }

  const [h, m, s] = input.time.split(":").map(Number);
  const local = DateTime.fromISO(`${input.date}T${input.time.length === 5 ? `${input.time}:00` : input.time}`, {
    zone: input.timezone,
  });
  if (!local.isValid) {
    throw new GuruInputError(`That date and time is not valid (${local.invalidExplanation ?? "unknown reason"}).`);
  }

  const warnings: string[] = [];

  // A wall-clock time skipped by a DST change is silently moved forward.
  if (local.hour !== h || local.minute !== m || local.second !== (s ?? 0)) {
    warnings.push(
      "That local time did not exist in this time zone (clock change). It was moved forward; please confirm the birth time.",
    );
  }

  // A wall-clock time repeated by a DST change maps to two instants.
  const wallAsUtcMs = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
  const offsets = new Set([
    local.minus({ days: 1 }).offset,
    local.offset,
    local.plus({ days: 1 }).offset,
  ]);
  const matching = [...offsets].filter((offset) => {
    const candidate = DateTime.fromMillis(wallAsUtcMs - offset * 60_000, { zone: input.timezone });
    return (
      candidate.year === local.year &&
      candidate.month === local.month &&
      candidate.day === local.day &&
      candidate.hour === local.hour &&
      candidate.minute === local.minute
    );
  });
  if (matching.length > 1) {
    warnings.push(
      "That local time occurred twice (clock change). The earlier occurrence was used; please confirm the birth time.",
    );
  }

  // Offsets that are not whole quarter-hours are pre-standard-time local mean
  // time; fine, but worth flagging as the birth record may be approximate.
  if (local.offset % 15 !== 0) {
    warnings.push("This date predates standard time zones; a local-mean-time offset was applied.");
  }

  if (Math.abs(input.latitude) > 66) {
    warnings.push("Above the polar circle the ascendant is unreliable.");
  }

  return { utc: local.toUTC().toJSDate(), offsetMinutes: local.offset, warnings };
}
