import { randomInt } from "node:crypto";

// The deck and the draw only. Card meanings are interpreted by Guru (and
// later by an astrologer-reviewed meaning library); what must never be left
// to a language model is the draw itself -- a model asked to "pick a card"
// is not random. Draws use the operating system's cryptographic RNG.

export type Suit = "Wands" | "Cups" | "Swords" | "Pentacles";

export interface TarotCard {
  /** Stable id, e.g. "major-00-the-fool" or "wands-ace". */
  id: string;
  name: string;
  arcana: "major" | "minor";
  suit: Suit | null;
  /** 0-21 for the major arcana, 1-14 (Ace..King) for the minor. */
  number: number;
}

const MAJOR = [
  "The Fool",
  "The Magician",
  "The High Priestess",
  "The Empress",
  "The Emperor",
  "The Hierophant",
  "The Lovers",
  "The Chariot",
  "Strength",
  "The Hermit",
  "Wheel of Fortune",
  "Justice",
  "The Hanged Man",
  "Death",
  "Temperance",
  "The Devil",
  "The Tower",
  "The Star",
  "The Moon",
  "The Sun",
  "Judgement",
  "The World",
];

const SUITS: readonly Suit[] = ["Wands", "Cups", "Swords", "Pentacles"];
const RANKS = ["Ace", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Page", "Knight", "Queen", "King"];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export const TAROT_DECK: readonly TarotCard[] = [
  ...MAJOR.map(
    (name, i): TarotCard => ({
      id: `major-${String(i).padStart(2, "0")}-${slug(name)}`,
      name,
      arcana: "major",
      suit: null,
      number: i,
    }),
  ),
  ...SUITS.flatMap((suit) =>
    RANKS.map(
      (rank, i): TarotCard => ({
        id: `${slug(suit)}-${slug(rank)}`,
        name: `${rank} of ${suit}`,
        arcana: "minor",
        suit,
        number: i + 1,
      }),
    ),
  ),
];

export type SpreadName = "single" | "three-card" | "celtic-cross";

export const SPREADS: Record<SpreadName, readonly string[]> = {
  single: ["The answer"],
  "three-card": ["Past", "Present", "Future"],
  "celtic-cross": [
    "The present",
    "The challenge",
    "The foundation",
    "The recent past",
    "The crown (best outcome)",
    "The near future",
    "Yourself",
    "External influences",
    "Hopes and fears",
    "The outcome",
  ],
};

export interface DrawnCard {
  position: string;
  card: TarotCard;
  reversed: boolean;
}

export interface TarotReading {
  spread: SpreadName;
  question: string;
  drawn: DrawnCard[];
  /** When true, cards could come up reversed (about half of the time). */
  reversalsEnabled: boolean;
}

export interface DrawOptions {
  spread: SpreadName;
  question?: string;
  /** Default true. */
  allowReversed?: boolean;
  /**
   * Uniform integer in [0, max). Defaults to the OS cryptographic RNG;
   * injectable so tests can be deterministic.
   */
  randomInt?: (max: number) => number;
}

export function drawTarot(options: DrawOptions): TarotReading {
  const rng = options.randomInt ?? ((max: number) => randomInt(max));
  const positions = SPREADS[options.spread];
  const allowReversed = options.allowReversed ?? true;

  // Fisher-Yates over a copy of the deck; only the needed prefix is fixed.
  const deck = [...TAROT_DECK];
  for (let i = deck.length - 1; i > deck.length - 1 - positions.length; i--) {
    const j = rng(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const drawnCards = deck.slice(deck.length - positions.length).reverse();

  return {
    spread: options.spread,
    question: options.question ?? "",
    reversalsEnabled: allowReversed,
    drawn: drawnCards.map((card, i) => ({
      position: positions[i],
      card,
      reversed: allowReversed ? rng(2) === 1 : false,
    })),
  };
}
