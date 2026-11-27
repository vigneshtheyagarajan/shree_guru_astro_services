import { describe, expect, it } from "vitest";
import { SPREADS, TAROT_DECK, drawTarot } from "./tarot";

describe("tarot deck", () => {
  it("has 78 unique cards: 22 major and 56 minor (14 per suit)", () => {
    expect(TAROT_DECK).toHaveLength(78);
    expect(new Set(TAROT_DECK.map((c) => c.id)).size).toBe(78);
    expect(TAROT_DECK.filter((c) => c.arcana === "major")).toHaveLength(22);
    for (const suit of ["Wands", "Cups", "Swords", "Pentacles"]) {
      expect(TAROT_DECK.filter((c) => c.suit === suit)).toHaveLength(14);
    }
  });

  it("names minor cards Ace..King of the suit", () => {
    const names = TAROT_DECK.map((c) => c.name);
    expect(names).toContain("Ace of Cups");
    expect(names).toContain("King of Pentacles");
    expect(names).toContain("The Fool");
    expect(names).toContain("The World");
  });
});

describe("drawTarot", () => {
  it.each(Object.entries(SPREADS))("%s spread draws one distinct card per position", (spread, positions) => {
    const reading = drawTarot({ spread: spread as keyof typeof SPREADS, question: "Will it work out?" });
    expect(reading.drawn).toHaveLength(positions.length);
    expect(reading.drawn.map((d) => d.position)).toEqual([...positions]);
    expect(new Set(reading.drawn.map((d) => d.card.id)).size).toBe(positions.length);
    expect(reading.question).toBe("Will it work out?");
  });

  it("never reverses cards when reversals are off", () => {
    for (let i = 0; i < 50; i++) {
      expect(drawTarot({ spread: "celtic-cross", allowReversed: false }).drawn.every((d) => !d.reversed)).toBe(true);
    }
  });

  it("is deterministic with an injected RNG", () => {
    const make = () => {
      let n = 0;
      return (max: number) => (n++ * 7 + 3) % max;
    };
    const a = drawTarot({ spread: "three-card", randomInt: make() });
    const b = drawTarot({ spread: "three-card", randomInt: make() });
    expect(a).toEqual(b);
  });

  it("the real crypto RNG is fair: every card is drawn about equally often, reversals about half the time", () => {
    const counts = new Map<string, number>();
    let reversed = 0;
    const N = 39_000;
    for (let i = 0; i < N; i++) {
      const d = drawTarot({ spread: "single" }).drawn[0];
      counts.set(d.card.id, (counts.get(d.card.id) ?? 0) + 1);
      if (d.reversed) reversed++;
    }
    expect(counts.size).toBe(78);
    // Expected 500 per card (sd ~ 22). A 5-sigma window is generous enough
    // never to flake yet still catches a biased shuffle.
    for (const count of counts.values()) {
      expect(count).toBeGreaterThan(390);
      expect(count).toBeLessThan(610);
    }
    expect(Math.abs(reversed / N - 0.5)).toBeLessThan(0.02);
  });
});
