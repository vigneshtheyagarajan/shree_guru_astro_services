import { describe, expect, it } from "vitest";
import { decideGate, heuristicClassify, offerHeldQuestions, MAX_QUESTIONS_PER_MESSAGE, type Classification, type GateSession, type MessageKind } from "./gate";

const pricing = { freeQuestions: 1, pricePerQuestionRupees: 49 };

function run(
  kind: MessageKind,
  questions: string[] = [],
  opts: { free?: number; credit?: number; session?: Partial<GateSession>; primaryIndex?: number } = {},
) {
  const classification: Classification = { kind, questions, primaryIndex: opts.primaryIndex ?? 0, service: "vedic" };
  const session: GateSession = { service: "vedic", answerable: true, pendingQuestions: [], pendingBundle: null, ...opts.session };
  return decideGate({ classification, session, snapshot: { freeRemaining: opts.free ?? 1, creditRupees: opts.credit ?? 0 }, pricing });
}

describe("non-question messages are free", () => {
  it.each(["data", "chitchat", "followup"] as const)("%s passes through and keeps any held state", (kind) => {
    const bundle = { questions: ["a", "b"], costRupees: 98 };
    const r = run(kind, [], { session: { pendingQuestions: ["held"], pendingBundle: bundle } });
    expect(r.decision).toEqual({ type: "pass" });
    expect(r.next).toEqual({ pendingQuestions: ["held"], pendingBundle: bundle });
  });

  it("abuse is refused and nothing is charged", () => {
    expect(run("abuse", []).decision).toEqual({ type: "refuse", reason: "abuse" });
  });
});

describe("a single question", () => {
  it("is answered from the free allowance", () => {
    expect(run("question", ["When will I marry?"]).decision).toEqual({ type: "answer", questions: ["When will I marry?"], reserve: 1 });
  });

  it("is answered from credit once the free allowance is spent", () => {
    expect(run("question", ["q"], { free: 0, credit: 49 }).decision).toMatchObject({ type: "answer", reserve: 1 });
  });

  it("asks for payment when neither free nor credit covers it", () => {
    expect(run("question", ["q"], { free: 0, credit: 10 }).decision).toEqual({ type: "payment_required", questions: 1, costRupees: 49, creditRupees: 10 });
  });
});

describe("questions asked before there is data to answer them", () => {
  const early = { session: { answerable: false } };

  it("are held, not charged, and the turn is free", () => {
    const r = run("question", ["When will I get a job?"], early);
    expect(r.decision).toEqual({ type: "pass" });
    expect(r.next.pendingQuestions).toEqual(["When will I get a job?"]);
  });

  it("keep every question of a bundled opener", () => {
    expect(run("question", ["Marriage?", "Career?"], early).next.pendingQuestions).toEqual(["Marriage?", "Career?"]);
  });

  it("a later 'yes' once the chart exists is what is charged (and here it is the free one)", () => {
    const r = run("confirm", [], { session: { answerable: true, pendingQuestions: ["When will I get a job?"] } });
    expect(r.decision).toEqual({ type: "answer", questions: ["When will I get a job?"], reserve: 1 });
    expect(r.next.pendingQuestions).toEqual([]);
  });

  it("a 'yes' while there is still no data does not release the held question", () => {
    const r = run("confirm", [], { session: { answerable: false, pendingQuestions: ["q"] } });
    expect(r.decision).toEqual({ type: "pass" });
    expect(r.next.pendingQuestions).toEqual(["q"]);
  });

  it("declining drops the held question", () => {
    expect(run("decline", [], { session: { pendingQuestions: ["q"] } }).next.pendingQuestions).toEqual([]);
  });
});

describe("several questions in one message", () => {
  const three = ["Will I marry?", "Will I change jobs?", "Will I move abroad?"];

  it("free user with no credit: only the primary question is answered, the rest are declined", () => {
    const r = run("question", three, { free: 1, credit: 0, primaryIndex: 1 });
    expect(r.decision).toEqual({
      type: "answer_primary_only",
      primary: "Will I change jobs?",
      others: ["Will I marry?", "Will I move abroad?"],
      reserve: 1,
    });
  });

  it("a user whose free allowance covers them all gets them answered", () => {
    expect(run("question", ["a", "b"], { free: 2 }).decision).toEqual({ type: "answer", questions: ["a", "b"], reserve: 2 });
  });

  it("a paying user sees the price and must confirm before being charged", () => {
    const r = run("question", three, { free: 0, credit: 200 });
    expect(r.decision).toEqual({ type: "confirm_bundle", questions: three, costRupees: 147 });
    expect(r.next.pendingBundle).toEqual({ questions: three, costRupees: 147 });
  });

  it("the free question is taken off the price of a paid bundle", () => {
    const r = run("question", three, { free: 1, credit: 98 });
    expect(r.decision).toEqual({ type: "confirm_bundle", questions: three, costRupees: 98 });
  });

  it("not enough credit and no free question: payment required for the whole bundle", () => {
    expect(run("question", ["a", "b"], { free: 0, credit: 60 }).decision).toEqual({ type: "payment_required", questions: 2, costRupees: 98, creditRupees: 60 });
  });

  it("confirming a bundle answers all of it and clears the hold", () => {
    const bundle = { questions: ["a", "b"], costRupees: 98 };
    const r = run("confirm", [], { free: 0, credit: 98, session: { pendingBundle: bundle } });
    expect(r.decision).toEqual({ type: "answer", questions: ["a", "b"], reserve: 2 });
    expect(r.next.pendingBundle).toBeNull();
  });

  it("confirming when the balance no longer covers it asks for payment and keeps the bundle", () => {
    const bundle = { questions: ["a", "b"], costRupees: 98 };
    const r = run("confirm", [], { free: 0, credit: 40, session: { pendingBundle: bundle } });
    expect(r.decision).toMatchObject({ type: "payment_required", questions: 2, costRupees: 98, creditRupees: 40 });
    expect(r.next.pendingBundle).toEqual(bundle);
  });

  it("declining a bundle clears it", () => {
    const r = run("decline", [], { session: { pendingBundle: { questions: ["a", "b"], costRupees: 98 } } });
    expect(r.next.pendingBundle).toBeNull();
  });

  it("asking something new instead of confirming replaces the pending bundle", () => {
    const r = run("question", ["A fresh question?"], { free: 1, session: { pendingBundle: { questions: ["a", "b"], costRupees: 98 } } });
    expect(r.decision).toMatchObject({ type: "answer", questions: ["A fresh question?"] });
    expect(r.next.pendingBundle).toBeNull();
  });

  it("never considers more than the per-message cap", () => {
    const many = Array.from({ length: 9 }, (_, i) => `Q${i}?`);
    const r = run("question", many, { free: 0, credit: 10_000 });
    expect(r.decision).toMatchObject({ type: "confirm_bundle" });
    expect((r.decision as { questions: string[] }).questions).toHaveLength(MAX_QUESTIONS_PER_MESSAGE);
  });
});

describe("edge cases", () => {
  it("a message the classifier calls a question but with no question text passes", () => {
    expect(run("question", []).decision).toEqual({ type: "pass" });
    expect(run("question", ["   "]).decision).toEqual({ type: "pass" });
  });
  it("a stray 'yes' with nothing pending is just a pass", () => {
    expect(run("confirm", []).decision).toEqual({ type: "pass" });
  });
});

describe("heuristicClassify (fallback when the classifier is down)", () => {
  it("treats greetings and details as data", () => {
    expect(heuristicClassify("hello", null).kind).toBe("data");
    expect(heuristicClassify("12 March 1990, 10:30 am, Madurai", null).kind).toBe("data");
    expect(heuristicClassify("How are you", null).kind).toBe("data");
  });
  it("treats a question as one question", () => {
    const c = heuristicClassify("Will I get married this year?", "vedic");
    expect(c).toMatchObject({ kind: "question", questions: ["Will I get married this year?"], service: "vedic" });
    expect(heuristicClassify("when will i buy a house and settle down", null).kind).toBe("question");
  });
  it("splits on several question marks", () => {
    expect(heuristicClassify("When will I marry? Will I change jobs? Where will I live?", null).questions).toHaveLength(3);
  });
});

describe("offerHeldQuestions", () => {
  const held = (questions: string[], free: number, credit: number) =>
    offerHeldQuestions({ service: "vedic", answerable: true, pendingQuestions: questions, pendingBundle: null }, { freeRemaining: free, creditRupees: credit }, pricing);

  it("offers nothing without data or without held questions", () => {
    expect(offerHeldQuestions({ service: "vedic", answerable: false, pendingQuestions: ["q"], pendingBundle: null }, { freeRemaining: 1, creditRupees: 0 }, pricing)).toBeNull();
    expect(held([], 1, 0)).toBeNull();
  });
  it("one held question covered by the free allowance: kept held, on the house", () => {
    expect(held(["q"], 1, 0)).toMatchObject({ free: true, choose: false, next: { pendingQuestions: ["q"], pendingBundle: null } });
  });
  it("several held questions that cost money become a pending bundle, so one 'yes' confirms the price shown", () => {
    const o = held(["a", "b", "c"], 1, 500)!;
    expect(o).toMatchObject({ free: false, affordable: true, costRupees: 98, next: { pendingQuestions: [], pendingBundle: { questions: ["a", "b", "c"], costRupees: 98 } } });
  });
  it("several held questions, only a free question to spend: the user is asked to choose one", () => {
    expect(held(["a", "b"], 1, 0)).toMatchObject({ choose: true, next: { pendingQuestions: [], pendingBundle: null } });
  });
  it("nothing free and no credit: says what it costs, keeps them held", () => {
    expect(held(["a", "b"], 0, 10)).toMatchObject({ choose: false, affordable: false, costRupees: 98, next: { pendingQuestions: ["a", "b"] } });
  });
});
