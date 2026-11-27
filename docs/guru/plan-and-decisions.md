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
2. **Chat backend (done in code, see below):** service selection, input collection, tool-calling, persona, guardrails, saved sessions, model-provider abstraction.
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

## Phase 2: what exists

Still self-contained in `src/lib/guru/`, plus one new table (`GuruSession`) and one new route (`POST /api/guru/chat`). Nothing existing was modified. The route returns 404 unless `GURU_ENABLED=true`.

**How a message is handled** (`conversation.ts`): classify the message, decide in plain code what may be answered and what it costs (`gate.ts`), reserve the entitlement, let the model answer using tools, then commit the charge. If the model fails, the reservation is released, so the user is never charged for a failed answer. The model never sees prices and cannot change what is charged.

- **Free allowance, bundles, holds:** one free question (`DEFAULT_PRICING.freeQuestions`, change to 2 if wanted). A free user who bundles several questions gets the most important one answered. A paying user sees "That's N questions, ₹X" and must reply yes before being charged. Questions asked before there is a chart are held (free), offered back after the first look, and charged only when the user says yes.
- **Persona and rules** (`persona.ts`): experienced, warm astrologer; every chart fact must come from a tool; no death/lifespan prediction, no medical/legal/investment advice, no fear-mongering, no paid-remedy selling; treats user text as untrusted (prompt-injection attempts are refused by the gate without calling the model).
- **Tools the model calls** (`tools/index.ts`): place lookup, Vedic chart, current transits, **transit timeline (dated sign changes of Jupiter, Saturn, Rahu, Ketu)**, kundli matching, numerology, tarot draw.
- **Model layer is swappable, with automatic fallback** (`llm/`): Gemini (free), Groq (free), Mistral (free) and Claude (paid) adapters behind one interface. With several keys set, Guru tries them in order and switches automatically when one runs out of quota or is overloaded, then leaves the exhausted one alone until its own retry time. The switch is invisible to the gate, so charging is unaffected, and each reply records which model wrote it (`model` in the reply).

| Variable | Meaning |
| --- | --- |
| `GURU_ENABLED=true` | Turns the chat route on (off by default) |
| `GEMINI_API_KEY`, `GROQ_API_KEY`, `MISTRAL_API_KEY` | Free-tier keys. Every key present joins the chain automatically, in this order |
| `ANTHROPIC_API_KEY` | Paid Claude. Never used unless listed explicitly |
| `GURU_LLM_PROVIDERS` | Optional explicit chain, e.g. `anthropic,gemini` to put paid Claude first with free fallbacks behind it |
| `GURU_<PROVIDER>_MODEL`, `GURU_<PROVIDER>_CLASSIFIER_MODEL` | Override model names, e.g. `GURU_GROQ_MODEL` |
| `GURU_CLAUDE_EFFORT` | Claude reasoning depth: low, medium, high, xhigh, max |

Defaults: Gemini `gemini-3.8-flash` + `gemini-3.1-flash-lite`; Groq `openai/gpt-oss-120b` + `llama-3.1-8b-instant`; Mistral `mistral-large-latest` + `mistral-small-latest`; Claude `claude-opus-5-5` + `claude-haiku-5-5`. Free-tier model names change often: run `npx tsx scripts/guru/check-providers.ts` after adding a key to confirm each model replies, calls tools and returns JSON.

Free-tier caveats: free providers are for development with fictional data only. Mistral's free tier requires opting in to training on your requests, and Gemini's free tier may be used to improve Google's models. Fallback models are not equal in quality, so answers produced during a fallback are weaker evidence about Guru's real quality; evaluation runs (Phase 3) should pin one model.

- **Try it in a terminal:** `npx tsx scripts/guru/chat.ts --free 1 --credit 0` (add `--credit 300` to test paid flows, `--script file.txt` for scripted runs). Use fictional birth details only.
- **Tests:** 277, including the full charge/hold/refund matrix and the Claude adapter against a fake client. No test calls a real model.

**Live testing on the Gemini free tier found:**

1. The free quota is **20 requests per day per model**, and one Guru turn can use several. Fine for smoke tests, not for the astrologer-graded test sets in Phase 3. Phase 3 needs a paid key (Gemini paid tier is cheap; Claude is the production target).
2. The model stated future planetary movements from memory, and got some wrong (Saturn into Aries "late 2027" is actually 3 Jun 2027, with a slip back in Oct 2027; Jupiter into Virgo is 27 Nov 2027, not "late 2028"). Fix shipped: the `get_transit_timeline` tool plus a hard rule that dates of planetary movements must come from it. This is the kind of error astrologer grading in Phase 3 will keep catching; the answer is always to move the fact into code.
3. Turns took 25 to 130 seconds on the free tier. The UI must stream the reply and show progress; production latency depends on the model chosen.
4. Prompt-injection and quota-failure paths behaved correctly live (refused with no charge; failure left the wallet untouched).

**Not done yet / next:** the real wallet (Phase 4 supplies an `Entitlements` backed by `Wallet`; until then `server.ts` uses a process-local stand-in that only exists when `GURU_ENABLED=true`), per-user rate limits, usage and cost tracking per user, a licensed geocoder (Open-Meteo's free tier is non-commercial), moving off the Gemini free tier before real users (free-tier data may be used by Google to improve its models).

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
