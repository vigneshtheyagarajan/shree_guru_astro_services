import { describe, expect, it } from "vitest";
import { DEFAULT_PRICING, InMemoryEntitlements, planCost } from "./entitlements";

const pricing = { freeQuestions: 1, pricePerQuestionRupees: 50 };

describe("planCost", () => {
  it("uses free questions first, then charges the rest", () => {
    expect(planCost({ freeRemaining: 1, creditRupees: 0 }, pricing, 1)).toEqual({ free: 1, paid: 0, rupees: 0, affordable: true });
    expect(planCost({ freeRemaining: 1, creditRupees: 100 }, pricing, 3)).toEqual({ free: 1, paid: 2, rupees: 100, affordable: true });
    expect(planCost({ freeRemaining: 0, creditRupees: 49 }, pricing, 1)).toEqual({ free: 0, paid: 1, rupees: 50, affordable: false });
  });
});

describe("InMemoryEntitlements", () => {
  it("starts with the pricing's free allowance and no credit", async () => {
    expect(await new InMemoryEntitlements(DEFAULT_PRICING).snapshot()).toEqual({ freeRemaining: DEFAULT_PRICING.freeQuestions, creditRupees: 0 });
  });

  it("commit spends the free question first, then credit", async () => {
    const e = new InMemoryEntitlements(pricing, { freeRemaining: 1, creditRupees: 120 });
    const r = (await e.reserve(3))!;
    expect(r).toMatchObject({ free: 1, paid: 2, chargedRupees: 100 });
    await r.commit();
    expect(await e.snapshot()).toEqual({ freeRemaining: 0, creditRupees: 20 });
  });

  it("release gives everything back (a failed answer costs the user nothing)", async () => {
    const e = new InMemoryEntitlements(pricing, { freeRemaining: 1, creditRupees: 100 });
    const r = (await e.reserve(2))!;
    expect(await e.snapshot()).toEqual({ freeRemaining: 0, creditRupees: 50 }); // held
    await r.release();
    expect(await e.snapshot()).toEqual({ freeRemaining: 1, creditRupees: 100 });
  });

  it("a reservation can only be settled once", async () => {
    const e = new InMemoryEntitlements(pricing, { freeRemaining: 0, creditRupees: 100 });
    const r = (await e.reserve(1))!;
    await r.commit();
    await r.commit();
    await r.release();
    expect(await e.snapshot()).toEqual({ freeRemaining: 0, creditRupees: 50 });
  });

  it("returns null when the user cannot cover the questions", async () => {
    const e = new InMemoryEntitlements(pricing, { freeRemaining: 0, creditRupees: 49 });
    expect(await e.reserve(1)).toBeNull();
  });

  it("two simultaneous requests cannot both get the same free question", async () => {
    const e = new InMemoryEntitlements(pricing, { freeRemaining: 1, creditRupees: 0 });
    const [a, b] = await Promise.all([e.reserve(1), e.reserve(1)]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
  });
});
