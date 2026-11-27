import { GuruInputError } from "./astro/time";

// Two systems are computed side by side because Indian users commonly mean
// the Chaldean-based "Mulank / Bhagyank / name number" system, while
// Western-style numerology uses Pythagorean letter values and master
// numbers. All arithmetic is deterministic; the AI only interprets.

const PYTHAGOREAN: Record<string, number> = {};
"AJS BKT CLU DMV ENW FOX GPY HQZ IR".split(" ").forEach((group, i) => {
  for (const letter of group) PYTHAGOREAN[letter] = i + 1;
});

// Chaldean values (no 9: it is held sacred and never assigned to a letter).
const CHALDEAN: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 8, G: 3, H: 5, I: 1,
  J: 1, K: 2, L: 3, M: 4, N: 5, O: 7, P: 8, Q: 1, R: 2,
  S: 3, T: 4, U: 6, V: 6, W: 6, X: 5, Y: 1, Z: 7,
};

/** Planet ruling each single digit in Indian numerology. */
export const NUMBER_PLANET: Record<number, string> = {
  1: "Sun",
  2: "Moon",
  3: "Jupiter",
  4: "Rahu",
  5: "Mercury",
  6: "Venus",
  7: "Ketu",
  8: "Saturn",
  9: "Mars",
};

const MASTER_NUMBERS = new Set([11, 22, 33]);
const VOWELS = new Set(["A", "E", "I", "O", "U"]);

function digitSum(n: number): number {
  return String(n)
    .split("")
    .reduce((sum, d) => sum + Number(d), 0);
}

/** Reduces to a single digit, optionally stopping at 11 / 22 / 33. */
export function reduceNumber(n: number, keepMasters: boolean): number {
  let value = n;
  while (value > 9 && !(keepMasters && MASTER_NUMBERS.has(value))) value = digitSum(value);
  return value;
}

export interface ReducedNumber {
  /** The raw total before the final reduction (e.g. 29 -> 11). */
  total: number;
  /** The reduced number (master numbers kept in the Pythagorean system). */
  number: number;
}

function reduced(total: number, keepMasters: boolean): ReducedNumber {
  return { total, number: reduceNumber(total, keepMasters) };
}

/** Uppercase A-Z only; strips accents ("Zoë" -> "ZOE"). */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z ]/g, "");
}

/**
 * Y counts as a vowel only when neither neighbour in the word is a vowel
 * (Mary, Lynn: vowel; Kayla, Ryan, Yolanda: consonant).
 */
function isVowel(word: string, index: number): boolean {
  const letter = word[index];
  if (VOWELS.has(letter)) return true;
  if (letter !== "Y") return false;
  const before = index > 0 ? word[index - 1] : "";
  const after = index < word.length - 1 ? word[index + 1] : "";
  return !VOWELS.has(before) && !VOWELS.has(after) && index > 0;
}

function sumLetters(
  name: string,
  values: Record<string, number>,
  filter: (word: string, index: number) => boolean = () => true,
): number {
  let total = 0;
  for (const word of name.split(" ")) {
    for (let i = 0; i < word.length; i++) {
      if (filter(word, i)) total += values[word[i]];
    }
  }
  return total;
}

export interface NumerologyInput {
  fullName: string;
  /** YYYY-MM-DD */
  birthDate: string;
}

export interface NumerologyResult {
  name: string;
  birthDate: string;
  pythagorean: {
    lifePath: ReducedNumber;
    expression: ReducedNumber;
    soulUrge: ReducedNumber;
    personality: ReducedNumber;
    birthday: { day: number; number: number };
  };
  indian: {
    /** Mulank: birth day reduced to 1-9. */
    mulank: number;
    mulankPlanet: string;
    /** Bhagyank: every digit of the full date of birth, reduced to 1-9. */
    bhagyank: ReducedNumber;
    bhagyankPlanet: string;
    /** Chaldean name number: the compound total and its reduction. */
    nameNumber: ReducedNumber;
    nameNumberPlanet: string;
  };
  notes: string[];
}

export function computeNumerology(input: NumerologyInput): NumerologyResult {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.birthDate);
  if (!match) throw new GuruInputError("Date of birth must be in YYYY-MM-DD format.");
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new GuruInputError("That date of birth is not a real calendar date.");
  }

  const name = normalizeName(input.fullName).replace(/\s+/g, " ").trim();
  if (name.replace(/ /g, "").length === 0) {
    throw new GuruInputError("Please provide a name written in English letters.");
  }

  const notes: string[] = [];
  if (normalizeName(input.fullName).replace(/ /g, "").length < input.fullName.replace(/\s/g, "").length) {
    notes.push("Characters that are not English letters were ignored when computing name numbers.");
  }

  // Life path: reduce month, day and year separately (keeping master
  // numbers), then add and reduce again.
  const lifePath = reduced(
    reduceNumber(month, true) + reduceNumber(day, true) + reduceNumber(year, true),
    true,
  );

  const pythagoreanTotal = sumLetters(name, PYTHAGOREAN);
  const soulUrgeTotal = sumLetters(name, PYTHAGOREAN, (w, i) => isVowel(w, i));
  const personalityTotal = sumLetters(name, PYTHAGOREAN, (w, i) => !isVowel(w, i));

  const mulank = reduceNumber(day, false);
  const bhagyank = reduced(digitSum(Number(`${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`)), false);
  const chaldean = reduced(sumLetters(name, CHALDEAN), false);

  return {
    name,
    birthDate: input.birthDate,
    pythagorean: {
      lifePath,
      expression: reduced(pythagoreanTotal, true),
      soulUrge: reduced(soulUrgeTotal, true),
      personality: reduced(personalityTotal, true),
      birthday: { day, number: reduceNumber(day, true) },
    },
    indian: {
      mulank,
      mulankPlanet: NUMBER_PLANET[mulank],
      bhagyank,
      bhagyankPlanet: NUMBER_PLANET[bhagyank.number],
      nameNumber: chaldean,
      nameNumberPlanet: NUMBER_PLANET[chaldean.number],
    },
    notes,
  };
}
