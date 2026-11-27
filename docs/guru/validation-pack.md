# Guru chart engine: validation pack

Purpose: confirm that the Guru chart engine agrees with the Jyotish software your astrologers already trust, **before** any AI is built on top of it. Everything the AI says about a chart comes from these numbers, so they must be right.

## How to use

1. In your software set: **Lahiri (Chitrapaksha) ayanamsa**, **sidereal zodiac**, **whole-sign houses**, **Mean node** (unless a case says TRUE node).
2. For each case below, enter the same date, time, place and time zone, and compare.
3. Tolerance: positions should agree to within **about 1 arcminute (1')**. Sign, nakshatra and pada should match exactly (a planet within an arcminute of a boundary is the one acceptable exception, so please note it).
4. Under each case write ✔ if everything matches, or list the differences (which body, what your software shows).

## Conventions in the engine

- Ayanamsa: Lahiri. Houses: whole sign (house 1 = the sign of the lagna).
- Rahu/Ketu: mean node by default (true node available).
- Vimshottari year = 365.25 days. (Some software uses 360 or 365.2422; this shifts dates by days, never the order of dashas.)
- Local time is converted to UTC using the historical time-zone database, including India's 1942-45 war time.

**Please also tell us:** which node type (mean/true) and which dasha year your astrologers normally use, so we can match your practice.

## Case 1: India's independence chart

*Why this case:* A widely published chart; every astrologer knows its Taurus lagna and Cancer stellium.

```
Birth:  1947-08-15 00:00 (Asia/Kolkata, UTC+05:30)  =  1947-08-14T18:30:00.000Z UTC
Place:  lat 28.6139, lon 77.209
Setup:  lahiri ayanamsa (23°07'31"), whole-sign houses, mean node, dasha year 365.25 days

Body      Sign         Position     Nakshatra (pada)        Navamsa      House  Notes
Lagna     Taurus       7°43'56"     Krittika (4)            Pisces       1      
Sun       Cancer       27°59'19"    Ashlesha (4)            Pisces       3      friendly
Moon      Cancer       3°59'01"     Pushya (1)              Leo          3      own
Mars      Gemini       7°27'22"     Ardra (1)               Sagittarius  2      enemy
Mercury   Cancer       13°40'24"    Pushya (4)              Scorpio      3      enemy
Jupiter   Libra        25°52'36"    Vishakha (2)            Taurus       6      enemy
Venus     Cancer       22°33'39"    Ashlesha (2)            Capricorn    3      enemy
Saturn    Cancer       20°28'23"    Ashlesha (2)            Capricorn    3      enemy
Rahu      Taurus       5°04'11"     Krittika (3)            Aquarius     1      
Ketu      Scorpio      5°04'11"     Anuradha (1)            Leo          7      

Vimshottari mahadashas (start dates):
  Saturn   1947-08-14 -> 1965-09-09
  Mercury  1965-09-09 -> 1982-09-10
  Ketu     1982-09-10 -> 1989-09-09
  Venus    1989-09-09 -> 2009-09-09
  Sun      2009-09-09 -> 2015-09-10
  Moon     2015-09-10 -> 2025-09-09
  Mars     2025-09-09 -> 2032-09-09
  Rahu     2032-09-09 -> 2050-09-10
  Jupiter  2050-09-10 -> 2066-09-10
  Saturn   2066-09-10 -> 2085-09-09
```

Your software: ☐ matches   ☐ differences: ____________________________

## Case 2: Chennai, modern birth

*Why this case:* Typical case: south India, early morning birth.

```
Birth:  1990-06-15 04:20 (Asia/Kolkata, UTC+05:30)  =  1990-06-14T22:50:00.000Z UTC
Place:  lat 13.0827, lon 80.2707
Setup:  lahiri ayanamsa (23°43'25"), whole-sign houses, mean node, dasha year 365.25 days

Body      Sign         Position     Nakshatra (pada)        Navamsa      House  Notes
Lagna     Taurus       9°06'50"     Krittika (4)            Pisces       1      
Sun       Taurus       29°52'41"    Mrigashira (2)          Virgo        1      enemy
Moon      Aquarius     14°21'11"    Shatabhisha (3)         Aquarius     10     
Mars      Pisces       16°55'09"    Revati (1)              Sagittarius  11     friendly
Mercury   Taurus       11°01'44"    Rohini (1)              Aries        1      friendly
Jupiter   Gemini       22°02'36"    Punarvasu (1)           Aries        2      enemy
Venus     Aries        24°24'18"    Bharani (4)             Scorpio      12     
Saturn    Capricorn    0°20'12"     Uttara Ashadha (2)      Capricorn    9      retrograde, own
Rahu      Capricorn    15°59'59"    Shravana (2)            Taurus       9      
Ketu      Cancer       15°59'59"    Pushya (4)              Scorpio      3      

Vimshottari mahadashas (start dates):
  Rahu     1990-06-14 -> 1998-01-28
  Jupiter  1998-01-28 -> 2014-01-28
  Saturn   2014-01-28 -> 2033-01-28
  Mercury  2033-01-28 -> 2050-01-28
  Ketu     2050-01-28 -> 2057-01-28
  Venus    2057-01-28 -> 2077-01-28
  Sun      2077-01-28 -> 2083-01-28
  Moon     2083-01-28 -> 2093-01-28
  Mars     2093-01-28 -> 2100-01-28
  Rahu     2100-01-28 -> 2118-01-29
```

Your software: ☐ matches   ☐ differences: ____________________________

## Case 3: Madurai, evening birth

*Why this case:* Evening birth: checks the ascendant late in the day.

```
Birth:  1975-03-02 18:45 (Asia/Kolkata, UTC+05:30)  =  1975-03-02T13:15:00.000Z UTC
Place:  lat 9.9252, lon 78.1198
Setup:  lahiri ayanamsa (23°30'37"), whole-sign houses, mean node, dasha year 365.25 days

Body      Sign         Position     Nakshatra (pada)        Navamsa      House  Notes
Lagna     Leo          22°55'14"    Purva Phalguni (3)      Libra        1      
Sun       Aquarius     17°49'00"    Shatabhisha (4)         Pisces       7      enemy
Moon      Libra        19°44'06"    Swati (4)               Pisces       3      
Mars      Capricorn    5°58'31"     Uttara Ashadha (3)      Aquarius     6      exalted
Mercury   Capricorn    20°53'28"    Shravana (4)            Cancer       6      
Jupiter   Pisces       2°35'49"     Purva Bhadrapada (4)    Cancer       8      own
Venus     Pisces       15°16'52"    Uttara Bhadrapada (4)   Scorpio      8      exalted
Saturn    Gemini       18°33'19"    Ardra (4)               Pisces       11     retrograde, friendly
Rahu      Scorpio      11°52'31"    Anuradha (3)            Libra        4      
Ketu      Taurus       11°52'31"    Rohini (1)              Aries        10     

Vimshottari mahadashas (start dates):
  Rahu     1975-03-02 -> 1975-07-11
  Jupiter  1975-07-11 -> 1991-07-11
  Saturn   1991-07-11 -> 2010-07-10
  Mercury  2010-07-10 -> 2027-07-11
  Ketu     2027-07-11 -> 2034-07-10
  Venus    2034-07-10 -> 2054-07-10
  Sun      2054-07-10 -> 2060-07-10
  Moon     2060-07-10 -> 2070-07-10
  Mars     2070-07-10 -> 2077-07-10
  Rahu     2077-07-10 -> 2095-07-11
```

Your software: ☐ matches   ☐ differences: ____________________________

## Case 4: Tiruchirappalli, small hours (mean node)

*Why this case:* Birth just after midnight, so the UTC date differs from the local date.

```
Birth:  1989-12-21 02:10 (Asia/Kolkata, UTC+05:30)  =  1989-12-20T20:40:00.000Z UTC
Place:  lat 10.7905, lon 78.7047
Setup:  lahiri ayanamsa (23°43'01"), whole-sign houses, mean node, dasha year 365.25 days

Body      Sign         Position     Nakshatra (pada)        Navamsa      House  Notes
Lagna     Libra        4°18'39"     Chitra (4)              Scorpio      1      
Sun       Sagittarius  5°13'55"     Mula (2)                Taurus       3      friendly
Moon      Virgo        14°42'49"    Hasta (2)               Taurus       12     friendly
Mars      Scorpio      8°07'41"     Anuradha (2)            Virgo        2      own
Mercury   Sagittarius  24°56'05"    Purva Ashadha (4)       Scorpio      3      
Jupiter   Gemini       13°00'10"    Ardra (2)               Capricorn    9      retrograde, enemy
Venus     Capricorn    11°18'35"    Shravana (1)            Aries        4      friendly
Saturn    Sagittarius  20°34'22"    Purva Ashadha (3)       Libra        3      
Rahu      Capricorn    25°19'52"    Dhanishta (1)           Leo          4      
Ketu      Cancer       25°19'52"    Ashlesha (3)            Aquarius     10     

Vimshottari mahadashas (start dates):
  Moon     1989-12-20 -> 1996-06-08
  Mars     1996-06-08 -> 2003-06-08
  Rahu     2003-06-08 -> 2021-06-08
  Jupiter  2021-06-08 -> 2037-06-08
  Saturn   2037-06-08 -> 2056-06-08
  Mercury  2056-06-08 -> 2073-06-08
  Ketu     2073-06-08 -> 2080-06-08
  Venus    2080-06-08 -> 2100-06-09
  Sun      2100-06-09 -> 2106-06-09
  Moon     2106-06-09 -> 2116-06-09
```

Your software: ☐ matches   ☐ differences: ____________________________

## Case 5: Tiruchirappalli, same birth with TRUE node

*Why this case:* Shows how much Rahu/Ketu move under the true-node setting (everything else is identical).

```
Birth:  1989-12-21 02:10 (Asia/Kolkata, UTC+05:30)  =  1989-12-20T20:40:00.000Z UTC
Place:  lat 10.7905, lon 78.7047
Setup:  lahiri ayanamsa (23°43'01"), whole-sign houses, true node, dasha year 365.25 days

Body      Sign         Position     Nakshatra (pada)        Navamsa      House  Notes
Lagna     Libra        4°18'39"     Chitra (4)              Scorpio      1      
Sun       Sagittarius  5°13'55"     Mula (2)                Taurus       3      friendly
Moon      Virgo        14°42'49"    Hasta (2)               Taurus       12     friendly
Mars      Scorpio      8°07'41"     Anuradha (2)            Virgo        2      own
Mercury   Sagittarius  24°56'05"    Purva Ashadha (4)       Scorpio      3      
Jupiter   Gemini       13°00'10"    Ardra (2)               Capricorn    9      retrograde, enemy
Venus     Capricorn    11°18'35"    Shravana (1)            Aries        4      friendly
Saturn    Sagittarius  20°34'22"    Purva Ashadha (3)       Libra        3      
Rahu      Capricorn    24°05'21"    Dhanishta (1)           Leo          4      
Ketu      Cancer       24°05'21"    Ashlesha (3)            Aquarius     10     

Vimshottari mahadashas (start dates):
  Moon     1989-12-20 -> 1996-06-08
  Mars     1996-06-08 -> 2003-06-08
  Rahu     2003-06-08 -> 2021-06-08
  Jupiter  2021-06-08 -> 2037-06-08
  Saturn   2037-06-08 -> 2056-06-08
  Mercury  2056-06-08 -> 2073-06-08
  Ketu     2073-06-08 -> 2080-06-08
  Venus    2080-06-08 -> 2100-06-09
  Sun      2100-06-09 -> 2106-06-09
  Moon     2106-06-09 -> 2116-06-09
```

Your software: ☐ matches   ☐ differences: ____________________________

## Case 6: Coimbatore, midday

*Why this case:* Midday birth: ascendant near the Sun's sign.

```
Birth:  2001-08-09 11:30 (Asia/Kolkata, UTC+05:30)  =  2001-08-09T06:00:00.000Z UTC
Place:  lat 11.0168, lon 76.9558
Setup:  lahiri ayanamsa (23°52'46"), whole-sign houses, mean node, dasha year 365.25 days

Body      Sign         Position     Nakshatra (pada)        Navamsa      House  Notes
Lagna     Libra        10°34'04"    Swati (2)               Capricorn    1      
Sun       Cancer       22°50'50"    Ashlesha (2)            Capricorn    10     friendly
Moon      Pisces       17°36'10"    Revati (1)              Sagittarius  6      
Mars      Scorpio      23°59'36"    Jyeshtha (3)            Aquarius     2      own
Mercury   Cancer       26°27'00"    Ashlesha (3)            Aquarius     10     enemy
Jupiter   Gemini       11°53'52"    Ardra (2)               Capricorn    9      enemy
Venus     Gemini       15°03'27"    Ardra (3)               Aquarius     9      friendly
Saturn    Taurus       19°02'36"    Rohini (3)              Gemini       8      friendly
Rahu      Gemini       10°08'51"    Ardra (2)               Capricorn    9      
Ketu      Sagittarius  10°08'51"    Mula (4)                Cancer       3      

Vimshottari mahadashas (start dates):
  Mercury  2001-08-09 -> 2017-05-30
  Ketu     2017-05-30 -> 2024-05-30
  Venus    2024-05-30 -> 2044-05-30
  Sun      2044-05-30 -> 2050-05-30
  Moon     2050-05-30 -> 2060-05-30
  Mars     2060-05-30 -> 2067-05-31
  Rahu     2067-05-31 -> 2085-05-30
  Jupiter  2085-05-30 -> 2101-05-31
  Saturn   2101-05-31 -> 2120-05-31
  Mercury  2120-05-31 -> 2137-05-31
```

Your software: ☐ matches   ☐ differences: ____________________________

## Case 7: Kanyakumari, near the equator

*Why this case:* Low latitude (8 degrees north): house cusps behave differently from higher latitudes.

```
Birth:  1968-01-14 06:05 (Asia/Kolkata, UTC+05:30)  =  1968-01-14T00:35:00.000Z UTC
Place:  lat 8.0883, lon 77.5385
Setup:  lahiri ayanamsa (23°24'38"), whole-sign houses, mean node, dasha year 365.25 days

Body      Sign         Position     Nakshatra (pada)        Navamsa      House  Notes
Lagna     Sagittarius  20°48'37"    Purva Ashadha (3)       Libra        1      
Sun       Sagittarius  29°29'39"    Uttara Ashadha (1)      Sagittarius  1      friendly
Moon      Gemini       10°05'02"    Ardra (2)               Capricorn    7      friendly
Mars      Aquarius     10°11'24"    Shatabhisha (2)         Capricorn    3      
Mercury   Capricorn    9°28'03"     Uttara Ashadha (4)      Pisces       2      
Jupiter   Leo          11°36'36"    Magha (4)               Cancer       9      retrograde, friendly
Venus     Scorpio      21°08'17"    Jyeshtha (2)            Capricorn    12     
Saturn    Pisces       13°21'55"    Uttara Bhadrapada (4)   Scorpio      4      
Rahu      Pisces       29°53'41"    Revati (4)              Pisces       4      
Ketu      Virgo        29°53'41"    Chitra (2)              Virgo        10     

Vimshottari mahadashas (start dates):
  Rahu     1968-01-14 -> 1981-06-03
  Jupiter  1981-06-03 -> 1997-06-03
  Saturn   1997-06-03 -> 2016-06-03
  Mercury  2016-06-03 -> 2033-06-03
  Ketu     2033-06-03 -> 2040-06-03
  Venus    2040-06-03 -> 2060-06-03
  Sun      2060-06-03 -> 2066-06-03
  Moon     2066-06-03 -> 2076-06-03
  Mars     2076-06-03 -> 2083-06-04
  Rahu     2083-06-04 -> 2101-06-04
```

Your software: ☐ matches   ☐ differences: ____________________________

## Case 8: Chennai, war-time clock (1944)

*Why this case:* India ran on +6:30 from Sept 1942 to Oct 1945. The engine applies this automatically; software that ignores it is an hour out, which typically moves the lagna by around 15 degrees. Please check which your software did.

```
Birth:  1944-06-01 12:00 (Asia/Kolkata, UTC+06:30)  =  1944-06-01T05:30:00.000Z UTC
Place:  lat 13.0827, lon 80.2707
Setup:  lahiri ayanamsa (23°04'51"), whole-sign houses, mean node, dasha year 365.25 days

Body      Sign         Position     Nakshatra (pada)        Navamsa      House  Notes
Lagna     Leo          0°11'59"     Magha (1)               Aries        1      
Sun       Taurus       17°30'35"    Rohini (3)              Gemini       10     enemy
Moon      Virgo        11°51'55"    Hasta (1)               Aries        2      friendly
Mars      Cancer       12°30'16"    Pushya (3)              Libra        12     debilitated
Mercury   Aries        23°10'47"    Bharani (3)             Libra        9      
Jupiter   Cancer       27°24'31"    Ashlesha (4)            Pisces       12     exalted
Venus     Taurus       10°26'38"    Rohini (1)              Aries        10     own
Saturn    Gemini       4°27'42"     Mrigashira (4)          Scorpio      11     friendly
Rahu      Cancer       7°02'46"     Pushya (2)              Virgo        12     
Ketu      Capricorn    7°02'46"     Uttara Ashadha (4)      Pisces       6      

Vimshottari mahadashas (start dates):
  Moon     1944-06-01 -> 1953-01-06
  Mars     1953-01-06 -> 1960-01-07
  Rahu     1960-01-07 -> 1978-01-06
  Jupiter  1978-01-06 -> 1994-01-06
  Saturn   1994-01-06 -> 2013-01-06
  Mercury  2013-01-06 -> 2030-01-06
  Ketu     2030-01-06 -> 2037-01-06
  Venus    2037-01-06 -> 2057-01-06
  Sun      2057-01-06 -> 2063-01-07
  Moon     2063-01-07 -> 2073-01-06
```

Your software: ☐ matches   ☐ differences: ____________________________

## Case 9: Delhi, Lahiri epoch date

*Why this case:* 21 March 1956 is the date the Lahiri ayanamsa is anchored to, so the ayanamsa value is a direct check.

```
Birth:  1956-03-21 05:30 (Asia/Kolkata, UTC+05:30)  =  1956-03-21T00:00:00.000Z UTC
Place:  lat 28.6139, lon 77.209
Setup:  lahiri ayanamsa (23°14'44"), whole-sign houses, mean node, dasha year 365.25 days

Body      Sign         Position     Nakshatra (pada)        Navamsa      House  Notes
Lagna     Aquarius     16°33'35"    Shatabhisha (3)         Aquarius     1      
Sun       Pisces       7°06'28"     Uttara Bhadrapada (2)   Virgo        2      friendly
Moon      Gemini       23°58'34"    Punarvasu (2)           Taurus       5      friendly
Mars      Sagittarius  20°35'38"    Purva Ashadha (3)       Libra        11     friendly
Mercury   Aquarius     22°20'15"    Purva Bhadrapada (1)    Aries        1      
Jupiter   Cancer       29°24'14"    Ashlesha (4)            Pisces       6      retrograde, exalted
Venus     Aries        21°28'00"    Bharani (3)             Libra        3      
Saturn    Scorpio      9°29'51"     Anuradha (2)            Virgo        10     retrograde, enemy
Rahu      Scorpio      18°36'34"    Jyeshtha (1)            Sagittarius  10     
Ketu      Taurus       18°36'34"    Rohini (3)              Gemini       4      

Vimshottari mahadashas (start dates):
  Jupiter  1956-03-21 -> 1967-06-13
  Saturn   1967-06-13 -> 1986-06-13
  Mercury  1986-06-13 -> 2003-06-13
  Ketu     2003-06-13 -> 2010-06-13
  Venus    2010-06-13 -> 2030-06-13
  Sun      2030-06-13 -> 2036-06-12
  Moon     2036-06-12 -> 2046-06-13
  Mars     2046-06-13 -> 2053-06-12
  Rahu     2053-06-12 -> 2071-06-13
  Jupiter  2071-06-13 -> 2087-06-13
```

Your software: ☐ matches   ☐ differences: ____________________________

## Case 10: London, winter

*Why this case:* Outside India, northern latitude 51.5.

```
Birth:  1985-11-23 21:15 (Europe/London, UTC+00:00)  =  1985-11-23T21:15:00.000Z UTC
Place:  lat 51.5074, lon -0.1278
Setup:  lahiri ayanamsa (23°39'36"), whole-sign houses, mean node, dasha year 365.25 days

Body      Sign         Position     Nakshatra (pada)        Navamsa      House  Notes
Lagna     Cancer       18°14'04"    Ashlesha (1)            Sagittarius  1      
Sun       Scorpio      7°52'33"     Anuradha (2)            Virgo        5      friendly
Moon      Pisces       28°31'44"    Revati (4)              Pisces       9      
Mars      Virgo        23°22'35"    Chitra (1)              Leo          3      enemy
Mercury   Scorpio      19°02'42"    Jyeshtha (1)            Sagittarius  5      retrograde
Jupiter   Capricorn    17°33'35"    Shravana (3)            Gemini       7      debilitated
Venus     Libra        24°12'49"    Vishakha (2)            Taurus       4      own
Saturn    Scorpio      7°09'09"     Anuradha (2)            Virgo        5      enemy
Rahu      Aries        14°10'55"    Bharani (1)             Leo          10     
Ketu      Libra        14°10'55"    Swati (3)               Aquarius     4      

Vimshottari mahadashas (start dates):
  Mercury  1985-11-23 -> 1987-10-10
  Ketu     1987-10-10 -> 1994-10-09
  Venus    1994-10-09 -> 2014-10-09
  Sun      2014-10-09 -> 2020-10-09
  Moon     2020-10-09 -> 2030-10-09
  Mars     2030-10-09 -> 2037-10-09
  Rahu     2037-10-09 -> 2055-10-10
  Jupiter  2055-10-10 -> 2071-10-10
  Saturn   2071-10-10 -> 2090-10-09
  Mercury  2090-10-09 -> 2107-10-11
```

Your software: ☐ matches   ☐ differences: ____________________________

## Case 11: New York, summer (daylight saving)

*Why this case:* Western longitude with daylight saving time in force.

```
Birth:  1999-07-04 09:00 (America/New_York, UTC-04:00)  =  1999-07-04T13:00:00.000Z UTC
Place:  lat 40.7128, lon -74.006
Setup:  lahiri ayanamsa (23°51'00"), whole-sign houses, mean node, dasha year 365.25 days

Body      Sign         Position     Nakshatra (pada)        Navamsa      House  Notes
Lagna     Cancer       29°09'06"    Ashlesha (4)            Pisces       1      
Sun       Gemini       18°16'35"    Ardra (4)               Pisces       12     
Moon      Aquarius     23°43'46"    Purva Bhadrapada (2)    Taurus       8      
Mars      Libra        5°56'59"     Chitra (4)              Scorpio      4      
Mercury   Cancer       12°55'45"    Pushya (3)              Libra        1      enemy
Jupiter   Aries        7°05'36"     Ashwini (3)             Gemini       10     friendly
Venus     Leo          1°06'50"     Magha (1)               Aries        2      enemy
Saturn    Aries        20°41'26"    Bharani (3)             Libra        10     debilitated
Rahu      Cancer       20°46'37"    Ashlesha (2)            Capricorn    1      
Ketu      Capricorn    20°46'37"    Shravana (4)            Cancer       7      

Vimshottari mahadashas (start dates):
  Jupiter  1999-07-04 -> 2011-01-11
  Saturn   2011-01-11 -> 2030-01-11
  Mercury  2030-01-11 -> 2047-01-11
  Ketu     2047-01-11 -> 2054-01-11
  Venus    2054-01-11 -> 2074-01-11
  Sun      2074-01-11 -> 2080-01-12
  Moon     2080-01-12 -> 2090-01-11
  Mars     2090-01-11 -> 2097-01-11
  Rahu     2097-01-11 -> 2115-01-12
  Jupiter  2115-01-12 -> 2131-01-12
```

Your software: ☐ matches   ☐ differences: ____________________________

## Case 12: Sydney, southern hemisphere

*Why this case:* Southern latitude (-33.9) with daylight saving: checks the ascendant formula below the equator.

```
Birth:  2010-01-10 22:40 (Australia/Sydney, UTC+11:00)  =  2010-01-10T11:40:00.000Z UTC
Place:  lat -33.8688, lon 151.2093
Setup:  lahiri ayanamsa (23°59'50"), whole-sign houses, mean node, dasha year 365.25 days

Body      Sign         Position     Nakshatra (pada)        Navamsa      House  Notes
Lagna     Leo          14°55'59"    Purva Phalguni (1)      Leo          1      
Sun       Sagittarius  26°06'58"    Purva Ashadha (4)       Scorpio      5      friendly
Moon      Scorpio      2°36'11"     Vishakha (4)            Cancer       4      debilitated
Mars      Cancer       22°45'10"    Ashlesha (2)            Capricorn    12     retrograde, debilitated
Mercury   Sagittarius  13°39'28"    Purva Ashadha (1)       Leo          5      retrograde
Jupiter   Aquarius     4°20'03"     Dhanishta (4)           Scorpio      7      
Venus     Sagittarius  25°47'01"    Purva Ashadha (4)       Scorpio      5      
Saturn    Virgo        10°38'24"    Hasta (1)               Aries        2      friendly
Rahu      Sagittarius  27°07'53"    Uttara Ashadha (1)      Sagittarius  5      
Ketu      Gemini       27°07'53"    Punarvasu (3)           Gemini       11     

Vimshottari mahadashas (start dates):
  Jupiter  2010-01-10 -> 2010-11-26
  Saturn   2010-11-26 -> 2029-11-26
  Mercury  2029-11-26 -> 2046-11-26
  Ketu     2046-11-26 -> 2053-11-26
  Venus    2053-11-26 -> 2073-11-26
  Sun      2073-11-26 -> 2079-11-26
  Moon     2079-11-26 -> 2089-11-26
  Mars     2089-11-26 -> 2096-11-26
  Rahu     2096-11-26 -> 2114-11-27
  Jupiter  2114-11-27 -> 2130-11-27
```

Your software: ☐ matches   ☐ differences: ____________________________

## Case 13: Chennai, leap day

*Why this case:* 29 February, to confirm date handling.

```
Birth:  2024-02-29 15:45 (Asia/Kolkata, UTC+05:30)  =  2024-02-29T10:15:00.000Z UTC
Place:  lat 13.0827, lon 80.2707
Setup:  lahiri ayanamsa (24°11'40"), whole-sign houses, mean node, dasha year 365.25 days

Body      Sign         Position     Nakshatra (pada)        Navamsa      House  Notes
Lagna     Cancer       10°47'51"    Pushya (3)              Libra        1      
Sun       Aquarius     16°07'16"    Shatabhisha (3)         Aquarius     8      enemy
Moon      Libra        9°21'38"     Swati (1)               Sagittarius  4      
Mars      Capricorn    18°16'49"    Shravana (3)            Gemini       7      exalted
Mercury   Aquarius     17°03'03"    Shatabhisha (4)         Pisces       8      
Jupiter   Aries        17°01'20"    Bharani (2)             Virgo        10     friendly
Venus     Capricorn    21°35'26"    Shravana (4)            Cancer       7      friendly
Saturn    Aquarius     15°38'55"    Shatabhisha (3)         Aquarius     8      own
Rahu      Pisces       23°32'13"    Revati (3)              Aquarius     9      
Ketu      Virgo        23°32'13"    Chitra (1)              Leo          3      

Vimshottari mahadashas (start dates):
  Rahu     2024-02-29 -> 2038-07-11
  Jupiter  2038-07-11 -> 2054-07-11
  Saturn   2054-07-11 -> 2073-07-11
  Mercury  2073-07-11 -> 2090-07-11
  Ketu     2090-07-11 -> 2097-07-11
  Venus    2097-07-11 -> 2117-07-12
  Sun      2117-07-12 -> 2123-07-12
  Moon     2123-07-12 -> 2133-07-12
  Mars     2133-07-12 -> 2140-07-12
  Rahu     2140-07-12 -> 2158-07-12
```

Your software: ☐ matches   ☐ differences: ____________________________
