// What a user may ask for. The conversation engine only sees this
// interface; Phase 4 supplies an implementation backed by the existing
// wallet (reserve = debit, release = refund), this one is in memory for
// development, tests and evaluation runs.

export interface GuruPricing {
  /** Questions every new user gets free. */
  freeQuestions: number;
  /** Price of each further question, in whole rupees. Placeholder until decided. */
  pricePerQuestionRupees: number;
}

export const DEFAULT_PRICING: GuruPricing = { freeQuestions: 1, pricePerQuestionRupees: 49 };

export interface EntitlementSnapshot {
  freeRemaining: number;
  creditRupees: number;
}

/**
 * A hold on questions placed BEFORE an answer is generated. Commit when the
 * answer was delivered; release if generation failed, so a model error
 * never costs the user anything.
 */
export interface Reservation {
  /** How many of the reserved questions come from the free allowance. */
  free: number;
  /** How many are paid for with credit. */
  paid: number;
  chargedRupees: number;
  commit(): Promise<void>;
  release(): Promise<void>;
}

export interface Entitlements {
  snapshot(): Promise<EntitlementSnapshot>;
  /** Free questions are used first. Returns null when the user cannot cover `questions`. */
  reserve(questions: number): Promise<Reservation | null>;
}

export interface CostPlan {
  free: number;
  paid: number;
  rupees: number;
  affordable: boolean;
}

export function planCost(snapshot: EntitlementSnapshot, pricing: GuruPricing, questions: number): CostPlan {
  const free = Math.min(questions, Math.max(0, snapshot.freeRemaining));
  const paid = questions - free;
  const rupees = paid * pricing.pricePerQuestionRupees;
  return { free, paid, rupees, affordable: rupees <= snapshot.creditRupees };
}

export class InMemoryEntitlements implements Entitlements {
  freeRemaining: number;
  creditRupees: number;
  /** Questions held by reservations that are neither committed nor released. */
  private held = { free: 0, rupees: 0 };

  constructor(
    private readonly pricing: GuruPricing = DEFAULT_PRICING,
    initial: { freeRemaining?: number; creditRupees?: number } = {},
  ) {
    this.freeRemaining = initial.freeRemaining ?? pricing.freeQuestions;
    this.creditRupees = initial.creditRupees ?? 0;
  }

  async snapshot(): Promise<EntitlementSnapshot> {
    return {
      freeRemaining: this.freeRemaining - this.held.free,
      creditRupees: this.creditRupees - this.held.rupees,
    };
  }

  async reserve(questions: number): Promise<Reservation | null> {
    // Check and hold in one synchronous step (no await in between), so two
    // simultaneous requests cannot both claim the same free question.
    const plan = planCost(
      { freeRemaining: this.freeRemaining - this.held.free, creditRupees: this.creditRupees - this.held.rupees },
      this.pricing,
      questions,
    );
    if (!plan.affordable) return null;
    this.held.free += plan.free;
    this.held.rupees += plan.rupees;

    let settled = false;
    const unhold = () => {
      this.held.free -= plan.free;
      this.held.rupees -= plan.rupees;
    };
    return {
      free: plan.free,
      paid: plan.paid,
      chargedRupees: plan.rupees,
      commit: async () => {
        if (settled) return;
        settled = true;
        unhold();
        this.freeRemaining -= plan.free;
        this.creditRupees -= plan.rupees;
      },
      release: async () => {
        if (settled) return;
        settled = true;
        unhold();
      },
    };
  }
}
