import { J2000_JD, julianCenturies } from "./math";

/**
 * Lahiri (Chitrapaksha) ayanamsa -- the official standard of the Indian
 * Calendar Reform Committee and the default of virtually all Indian
 * astrology software.
 *
 * Convention (matches Swiss Ephemeris SE_SIDM_LAHIRI, which is what the
 * validation fixtures were generated with): the mean ayanamsa at epoch
 * JD 2435553.5 (1956-03-21) is 23.250182778° minus the nutation in longitude
 * at that epoch, and it then advances with general precession in longitude.
 * "Mean" = without nutation; callers convert true-of-date positions to
 * sidereal as  sidereal = trueLongitude - nutation - meanAyanamsa.
 */
const EPOCH_JD = 2_435_553.5;
const AYANAMSA_AT_EPOCH_DEG = 23.250182778 - 0.004658035;

// General precession in longitude p_A (IAU 2006), arcseconds, T = Julian
// centuries from J2000.
function generalPrecessionArcsec(T: number): number {
  return (
    5028.796195 * T +
    1.1054348 * T ** 2 +
    0.00007964 * T ** 3 -
    0.000023857 * T ** 4 -
    0.0000000383 * T ** 5
  );
}

export function lahiriAyanamsa(jd: number): number {
  const T = julianCenturies(jd);
  const T0 = julianCenturies(EPOCH_JD);
  return (
    AYANAMSA_AT_EPOCH_DEG +
    (generalPrecessionArcsec(T) - generalPrecessionArcsec(T0)) / 3600
  );
}

// Re-exported so tests can assert the J2000 anchor value.
export const J2000 = J2000_JD;
