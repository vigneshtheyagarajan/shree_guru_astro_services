import * as Astronomy from "astronomy-engine";
import { lahiriAyanamsa } from "./ayanamsa";
import type { Graha } from "./constants";
import { DEG, angleDiff, julianCenturies, julianDay, norm360 } from "./math";

// Planetary positions come from astronomy-engine (MIT licensed, VSOP87 /
// ELP-based; accuracy well under an arcminute, validated against Swiss
// Ephemeris in ephemeris.test.ts). Positions are geocentric, apparent
// (light-time and aberration corrected), true ecliptic of date.

export type NodeType = "mean" | "true";

const PLANET_BODIES: Record<
  Exclude<Graha, "Rahu" | "Ketu">,
  Astronomy.Body
> = {
  Sun: Astronomy.Body.Sun,
  Moon: Astronomy.Body.Moon,
  Mars: Astronomy.Body.Mars,
  Mercury: Astronomy.Body.Mercury,
  Jupiter: Astronomy.Body.Jupiter,
  Venus: Astronomy.Body.Venus,
  Saturn: Astronomy.Body.Saturn,
};

function trueEclipticLongitude(body: Astronomy.Body, time: Astronomy.AstroTime): number {
  const vector = Astronomy.GeoVector(body, time, true);
  return norm360(Astronomy.Ecliptic(vector).elon);
}

/** Nutation in longitude (degrees) at the given time. */
export function nutationInLongitude(time: Astronomy.AstroTime): number {
  return Astronomy.e_tilt(time).dpsi / 3600; // dpsi is in arcseconds
}

/** Mean lunar ascending node (Rahu), mean equinox of date, degrees. */
function meanNodeMeanEquinox(T: number): number {
  return norm360(
    125.0445479 -
      1934.1362891 * T +
      0.0020754 * T ** 2 +
      T ** 3 / 467_441 -
      T ** 4 / 60_616_000,
  );
}

/**
 * Osculating ("true") lunar node, true ecliptic of date: the ascending node
 * of the instantaneous plane of the Moon's orbit, from its position and
 * velocity vectors.
 */
function trueNodeTrueEquinox(time: Astronomy.AstroTime): number {
  const state = Astronomy.GeoMoonState(time);
  const rotation = Astronomy.Rotation_EQJ_ECT(time);
  const r = Astronomy.RotateVector(rotation, new Astronomy.Vector(state.x, state.y, state.z, time));
  const v = Astronomy.RotateVector(
    rotation,
    new Astronomy.Vector(state.vx, state.vy, state.vz, time),
  );
  // Orbit normal h = r x v; ascending node direction = z-hat x h.
  const hx = r.y * v.z - r.z * v.y;
  const hy = r.z * v.x - r.x * v.z;
  return norm360(Math.atan2(hx, -hy) / DEG);
}

/**
 * Sidereal (Lahiri) longitudes of the nine grahas.
 *
 * Swiss Ephemeris convention (which every mainstream Jyotish package
 * follows): sidereal = true-of-date longitude - nutation - mean ayanamsa,
 * i.e. nutation cancels and the result is the mean-equinox longitude minus
 * the mean ayanamsa.
 */
export function siderealGrahaLongitudes(
  date: Date,
  nodeType: NodeType = "mean",
): { longitudes: Record<Graha, number>; ayanamsa: number } {
  const time = Astronomy.MakeTime(date);
  const jd = julianDay(date);
  const ayanamsa = lahiriAyanamsa(jd);
  const nutation = nutationInLongitude(time);
  const toSidereal = (trueLongitude: number) =>
    norm360(trueLongitude - nutation - ayanamsa);

  const longitudes = {} as Record<Graha, number>;
  for (const [graha, body] of Object.entries(PLANET_BODIES) as [
    keyof typeof PLANET_BODIES,
    Astronomy.Body,
  ][]) {
    longitudes[graha] = toSidereal(trueEclipticLongitude(body, time));
  }

  const rahu =
    nodeType === "mean"
      ? norm360(meanNodeMeanEquinox(julianCenturies(jd)) - ayanamsa)
      : toSidereal(trueNodeTrueEquinox(time));
  longitudes.Rahu = rahu;
  longitudes.Ketu = norm360(rahu + 180);

  return { longitudes, ayanamsa };
}

/**
 * Sidereal longitudes of only the slow grahas (Jupiter, Saturn, Rahu, Ketu).
 * Same conversion as siderealGrahaLongitudes, but cheap enough to step day
 * by day for years (used to find sign ingresses).
 */
export function siderealSlowLongitudes(
  date: Date,
  nodeType: NodeType = "mean",
): Record<"Jupiter" | "Saturn" | "Rahu" | "Ketu", number> {
  const time = Astronomy.MakeTime(date);
  const jd = julianDay(date);
  const ayanamsa = lahiriAyanamsa(jd);
  const nutation = nutationInLongitude(time);
  const toSidereal = (trueLongitude: number) => norm360(trueLongitude - nutation - ayanamsa);
  const rahu =
    nodeType === "mean" ? norm360(meanNodeMeanEquinox(julianCenturies(jd)) - ayanamsa) : toSidereal(trueNodeTrueEquinox(time));
  return {
    Jupiter: toSidereal(trueEclipticLongitude(PLANET_BODIES.Jupiter, time)),
    Saturn: toSidereal(trueEclipticLongitude(PLANET_BODIES.Saturn, time)),
    Rahu: rahu,
    Ketu: norm360(rahu + 180),
  };
}

/**
 * Whether each graha is retrograde, from the sign of its apparent motion
 * over +/- 12 hours. The Sun and Moon never are; the mean nodes always are.
 */
export function retrogradeFlags(date: Date, nodeType: NodeType = "mean"): Record<Graha, boolean> {
  const half = 12 * 3_600_000;
  const before = Astronomy.MakeTime(new Date(date.getTime() - half));
  const after = Astronomy.MakeTime(new Date(date.getTime() + half));

  const motion = (body: Astronomy.Body) =>
    angleDiff(trueEclipticLongitude(body, after), trueEclipticLongitude(body, before)) < 0;

  const rahuRetro =
    nodeType === "mean"
      ? true
      : angleDiff(trueNodeTrueEquinox(after), trueNodeTrueEquinox(before)) < 0;

  return {
    Sun: false,
    Moon: false,
    Mars: motion(PLANET_BODIES.Mars),
    Mercury: motion(PLANET_BODIES.Mercury),
    Jupiter: motion(PLANET_BODIES.Jupiter),
    Venus: motion(PLANET_BODIES.Venus),
    Saturn: motion(PLANET_BODIES.Saturn),
    Rahu: rahuRetro,
    Ketu: rahuRetro,
  };
}

/**
 * Tropical, true-of-date ascendant (degrees) for an observer at the given
 * geographic latitude / east longitude. Sidereal conversion is applied by
 * the caller using the same rule as the planets.
 */
export function ascendantTrueOfDate(date: Date, latitude: number, longitudeEast: number): number {
  const time = Astronomy.MakeTime(date);
  const tilt = Astronomy.e_tilt(time);
  const ramc = norm360(Astronomy.SiderealTime(time) * 15 + longitudeEast); // local sidereal time
  const epsilon = tilt.tobl * DEG;
  const phi = latitude * DEG;
  const theta = ramc * DEG;
  const ascendant = Math.atan2(
    Math.cos(theta),
    -(Math.sin(theta) * Math.cos(epsilon) + Math.tan(phi) * Math.sin(epsilon)),
  );
  return norm360(ascendant / DEG);
}

/** Sidereal ascendant, same convention as the planets. */
export function siderealAscendant(
  date: Date,
  latitude: number,
  longitudeEast: number,
): number {
  const time = Astronomy.MakeTime(date);
  const ayanamsa = lahiriAyanamsa(julianDay(date));
  return norm360(
    ascendantTrueOfDate(date, latitude, longitudeEast) - nutationInLongitude(time) - ayanamsa,
  );
}
