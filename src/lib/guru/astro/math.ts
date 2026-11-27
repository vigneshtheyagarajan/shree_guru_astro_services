export const DEG = Math.PI / 180;

/** Normalise an angle in degrees into [0, 360). */
export function norm360(angle: number): number {
  const r = angle % 360;
  return r < 0 ? r + 360 : r;
}

/** Smallest signed difference a - b in degrees, in (-180, 180]. */
export function angleDiff(a: number, b: number): number {
  const d = norm360(a - b);
  return d > 180 ? d - 360 : d;
}

export const MS_PER_DAY = 86_400_000;
const UNIX_EPOCH_JD = 2_440_587.5;
export const J2000_JD = 2_451_545.0;

export function julianDay(date: Date): number {
  return date.getTime() / MS_PER_DAY + UNIX_EPOCH_JD;
}

/** Julian centuries since J2000.0. */
export function julianCenturies(jd: number): number {
  return (jd - J2000_JD) / 36_525;
}
