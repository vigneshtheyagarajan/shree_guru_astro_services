"""
Generates reference values for validating the Guru astro engine.

Swiss Ephemeris (via pyswisseph) is used here ONLY as an independent oracle
at development time to produce the fixture file the unit tests compare
against. It is not a runtime dependency of the product and none of its code
is shipped -- the fixture holds planetary positions, which are facts.

Usage (from repo root, with a venv that has pyswisseph installed):
    python scripts/guru/generate_oracle.py > src/lib/guru/astro/__fixtures__/oracle.json
"""
import json
import sys
from datetime import datetime, timezone

import swisseph as swe

# Moshier needs no ephemeris data files (accuracy ~1 arcsecond for the planets,
# a few arcseconds for the Moon) -- far tighter than the tolerances we test at.
BASE = swe.FLG_MOSEPH | swe.FLG_SPEED
SIDEREAL = BASE | swe.FLG_SIDEREAL

swe.set_sid_mode(swe.SIDM_LAHIRI)

BODIES = {
    "Sun": swe.SUN,
    "Moon": swe.MOON,
    "Mars": swe.MARS,
    "Mercury": swe.MERCURY,
    "Jupiter": swe.JUPITER,
    "Venus": swe.VENUS,
    "Saturn": swe.SATURN,
    "MeanNode": swe.MEAN_NODE,
    "TrueNode": swe.TRUE_NODE,
}

# (utc ISO, latitude, longitude east+). Spread across decades, seasons,
# hemispheres and times of day. Latitudes stay well clear of the polar
# regions where the ascendant is ill-defined.
CASES = [
    ("1950-01-26T04:15:00Z", 13.0827, 80.2707),   # Chennai
    ("1956-03-21T00:00:00Z", 28.6139, 77.2090),   # Delhi (Lahiri epoch)
    ("1961-07-14T11:40:00Z", 9.9252, 78.1198),    # Madurai
    ("1967-11-02T22:05:00Z", 19.0760, 72.8777),   # Mumbai
    ("1972-05-09T06:30:00Z", 8.0883, 77.5385),    # Kanyakumari
    ("1975-09-30T14:20:00Z", 12.9716, 77.5946),   # Bengaluru
    ("1979-02-17T01:45:00Z", 22.5726, 88.3639),   # Kolkata
    ("1983-12-25T09:10:00Z", 17.3850, 78.4867),   # Hyderabad
    ("1986-06-06T17:55:00Z", 11.0168, 76.9558),   # Coimbatore
    ("1989-12-21T20:40:00Z", 10.7905, 78.7047),   # Tiruchirappalli
    ("1991-04-13T03:25:00Z", 26.9124, 75.7873),   # Jaipur
    ("1994-08-08T12:00:00Z", 51.5074, -0.1278),   # London
    ("1996-10-19T23:30:00Z", 40.7128, -74.0060),  # New York
    ("1998-01-05T07:50:00Z", -33.8688, 151.2093), # Sydney
    ("2000-01-01T12:00:00Z", 13.0827, 80.2707),   # J2000
    ("2001-05-20T15:15:00Z", 1.3521, 103.8198),   # Singapore
    ("2003-03-11T05:05:00Z", 25.2048, 55.2708),   # Dubai
    ("2005-07-27T19:35:00Z", 37.7749, -122.4194), # San Francisco
    ("2008-11-14T10:10:00Z", 23.0225, 72.5714),   # Ahmedabad
    ("2010-02-28T02:20:00Z", 18.5204, 73.8567),   # Pune
    ("2012-09-09T13:45:00Z", 15.2993, 74.1240),   # Goa
    ("2015-12-12T21:00:00Z", 30.7333, 76.7794),   # Chandigarh
    ("2018-06-21T08:30:00Z", 9.9312, 76.2673),    # Kochi
    ("2020-04-04T16:05:00Z", 12.2958, 76.6394),   # Mysuru
    ("2023-10-23T00:50:00Z", 13.0827, 80.2707),   # Chennai
    ("2024-02-29T11:11:00Z", 19.9975, 73.7898),   # Nashik (leap day)
    ("2026-08-25T16:30:00Z", 13.0827, 80.2707),   # Chennai
    ("1938-03-03T06:00:00Z", 13.0827, 80.2707),   # earlier decade
    ("1925-10-10T18:00:00Z", 22.7196, 75.8577),   # Indore
    ("2040-05-15T09:00:00Z", 28.6139, 77.2090),   # future date
]


def jd_ut(iso: str) -> float:
    dt = datetime.strptime(iso, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    hour = dt.hour + dt.minute / 60 + dt.second / 3600
    return swe.julday(dt.year, dt.month, dt.day, hour)


def main() -> None:
    out = []
    for iso, lat, lon in CASES:
        jd = jd_ut(iso)
        bodies = {}
        for name, body in BODIES.items():
            trop, _ = swe.calc_ut(jd, body, BASE)
            sid, _ = swe.calc_ut(jd, body, SIDEREAL)
            bodies[name] = {
                "tropical": trop[0],
                "sidereal": sid[0],
                "speed": sid[3],
            }

        # ayanamsa as returned by the library (see swisseph docs: this is the
        # value used to convert tropical -> sidereal for bodies).
        ayanamsa = swe.get_ayanamsa_ut(jd)

        # Ascendant: tropical and sidereal ('W' = whole sign; ascmc[0] is the
        # ascendant regardless of house system).
        _, ascmc_trop = swe.houses_ex(jd, lat, lon, b"W", swe.FLG_MOSEPH)
        _, ascmc_sid = swe.houses_ex(jd, lat, lon, b"W", swe.FLG_MOSEPH | swe.FLG_SIDEREAL)

        out.append(
            {
                "utc": iso,
                "jd": jd,
                "latitude": lat,
                "longitude": lon,
                "ayanamsa": ayanamsa,
                "ascendantTropical": ascmc_trop[0],
                "ascendantSidereal": ascmc_sid[0],
                "bodies": bodies,
            }
        )

    json.dump(
        {
            "generatedBy": "pyswisseph " + swe.version + " (Moshier ephemeris), Lahiri ayanamsa",
            "cases": out,
        },
        sys.stdout,
        indent=2,
    )


if __name__ == "__main__":
    main()
