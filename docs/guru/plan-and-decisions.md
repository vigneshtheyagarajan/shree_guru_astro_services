# Guru (AI astrologer): plan, decisions and open questions

## Product direction

A self-service AI astrologer named **Guru**, added as a **new, separate feature** alongside the existing marketplace (the marketplace is not modified). Longer term it becomes the primary offering.

## Decisions made

| Topic | Decision |
|---|---|
| Name | **Guru** |
| Launch language | English only. Tamil, Hindi and others later, each with its own astrologer-graded test set. |
| Services at launch | Vedic (kundli) reading, Tarot, Numerology, Kundli matching |
| Pricing | Free chart overview + **1 free question** (configurable up to 2), then pay per question from the existing wallet |
| Bundled questions | One question = one topic and one time frame. A cheap classifier splits a message into distinct questions; **code, not the AI, decides** what is answered or charged. Free users get the most important one answered. Paid users see "That's N questions, ₹X" and confirm before being charged. |
| Model | Free providers for development and early testing, behind a swappable interface, with an easy switch to paid Claude (Anthropic Console) for production. The astrologer-graded test set decides whether a free model is good enough. |
| Accuracy principle | All numbers (positions, dashas, scores, card draws) are computed by deterministic code. The AI interprets; it never computes. |
| AI disclosure | Warm, conversational voice, but clearly labelled as an AI astrologer. |

## Phases

0. Accounts and decisions (AI provider keys, legal review of claims and birth-data handling).
1. **Deterministic engines + validation (this folder, done, see below).**
2. Chat backend: service selection, input collection, tool-calling, persona, guardrails, saved sessions, model-provider abstraction.
3. Evaluation harness and admin grading screen. **Launch gate:** astrologer scores above an agreed threshold with zero critical errors, across multiple graded rounds.
4. Home-page entry, user chat UI, free allowance, wallet payments, usage and cost tracking, abuse limits.
5. Soft launch with weekly astrologer spot-checks of live answers.
6. Later: Tamil / Hindi / other languages; South Indian 10-porutham matching; astrologer-authored rule library; more services.

## Phase 1: what exists

All in `src/lib/guru/` (self-contained, imports nothing from the rest of the app).

- Vedic chart: Lahiri sidereal positions, ascendant, whole-sign houses, nakshatra and pada, navamsa, dignity, aspects, conjunctions, Vimshottari dashas to pratyantardasha, Kuja dosha.
- Ashtakoota (36-point) matching, with disputed table cells flagged.
- Numerology (Pythagorean and Indian/Chaldean), tarot deck and cryptographically fair draws.
- 105 automated tests (`npm test`).
- Validation: planetary positions checked against Swiss Ephemeris on 30 charts (worst planet error about 12 arcseconds, ascendant 0.15 arcsecond); India's independence chart reproduced; matching reproduces a real Prokerala sample report exactly (all eight kootas, 20/36).
- `docs/guru/validation-pack.md`: 13 charts for astrologers to compare with their own software.
- `scripts/guru/print-chart.ts`: prints any chart in the same layout.

## Open questions for the astrologers (please answer; they change defaults, not structure)

1. **Rahu/Ketu:** mean node or true node? (Engine default: mean. Both implemented; they differ by up to about 1.7 degrees.)
2. **Dasha year:** 365.25, 365.2422 or 360 days? (Engine default: 365.25. This shifts dates by days, never the order.)
3. **Kuja dosha house set:** include the 2nd house (South Indian practice) or not? (Engine default: South, 1/2/4/7/8/12.)
4. **Gana table.** Published sources disagree on three cells. The engine uses the table that matches both real published outputs we found (Prokerala sample and AstroSage example). Please confirm or choose another.
   - girl Deva × boy Manushya: 5 or 6?
   - girl Deva × boy Rakshasa: 1 or 0?
   - girl Rakshasa × boy Deva: 1 or 0?
5. **Vashya table.** Sources disagree on several cells (the Astroyogi table is the outlier). The engine uses the OnlineJyotish table, which agrees with the Prokerala sample. Please confirm or choose another.
6. **Yoni:** only the Horse–Deer cell differs between the two full published matrices (3 or 1). Which do you use?
7. **Matching verdict bands.** Engine uses below 18 not recommended / 18–24 acceptable / 25–32 good / 33–36 excellent, and reports Nadi and Bhakoot doshas separately without altering the score. Drik Panchang and Prokerala instead make the verdict depend on those doshas. Which approach do you prefer?
8. **South Indian matching:** Tamil users commonly expect the 10-porutham system, not only the 36-point Ashtakoota. Confirm it should be added in a later phase.

## Notes

- Swiss Ephemeris was used only as a development-time oracle to generate test fixtures; it is not a runtime dependency and no code from it ships. (`scripts/guru/generate_oracle.py`)
- Birth place to latitude/longitude/time-zone lookup (geocoding) is not part of Phase 1; the engine takes coordinates and an IANA time zone. It is needed in Phase 2/4 and its provider needs choosing.
