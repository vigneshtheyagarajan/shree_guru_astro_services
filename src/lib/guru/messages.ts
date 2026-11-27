import type { HeldOffer } from "./gate";

// Replies that are written by code, not by the model. Anything that states a
// price, a charge or a refusal comes from here, so it is always accurate and
// cannot be talked around.

export const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const numbered = (items: string[]) => items.map((q, i) => `${i + 1}. ${q}`).join("\n");

export const GREETING =
  "Namaste, I'm Guru. I can look at your Vedic chart (kundli), match two kundlis for marriage, read tarot, or work out your numerology. Which would you like to begin with? Your first question is on the house.";

export const TECHNICAL_ERROR =
  "I'm sorry, something went wrong on my side and I couldn't finish that. You haven't been charged. Please send it again in a moment.";

export function refuseMessage(reason: "abuse" | "too_long"): string {
  if (reason === "too_long") {
    return "That message is a bit long for me to read properly. Could you shorten it to the key details or one question at a time?";
  }
  return "I'm here to read charts, cards and numbers, and I can't change how this works or answer outside it. If you have a question about your chart, your match, your cards or your numbers, I'm happy to help.";
}

export function confirmBundleMessage(questions: string[], costRupees: number): string {
  return [
    `That's ${questions.length} separate questions, and each deserves its own careful look at your chart:`,
    numbered(questions),
    `Answering all ${questions.length} comes to ${rupees(costRupees)} from your wallet. Shall I go ahead? Reply yes to confirm, or tell me which one you'd like first.`,
  ].join("\n\n");
}

export function paymentRequiredMessage(p: { questions: number; costRupees: number; creditRupees: number }): string {
  const shortfall = Math.max(0, p.costRupees - p.creditRupees);
  return `To answer ${p.questions === 1 ? "that" : `those ${p.questions} questions`} I'd need ${rupees(p.costRupees)}, and your wallet has ${rupees(p.creditRupees)}. Add ${rupees(shortfall)} to your wallet and ask again, and I'll look into ${p.questions === 1 ? "it" : "them"} straight away. Nothing has been charged.`;
}

export function primaryOnlyNote(primary: string, others: string[], pricePerQuestion: number): string {
  const one = others.length === 1;
  return `You asked a few things at once, so I answered the one that matters most (${primary}). ${one ? "The other needs its" : "The others each need their"} own look:\n${numbered(others)}\nFurther questions are ${rupees(pricePerQuestion)} each; ask ${one ? "it" : "them"} one at a time whenever you're ready.`;
}

export function heldOfferMessage(offer: HeldOffer, creditRupees: number): string {
  const many = offer.questions.length > 1;
  const list = many ? `\n${numbered(offer.questions)}` : `"${offer.questions[0]}"`;
  const head = `Earlier you asked${many ? ":" : ""} ${list}`.replace(": \n", ":\n");
  if (offer.choose) return `${head}\nYour free question lets me answer one of them now. Which would you like me to take up first? The rest are ${rupees(offer.perQuestionRupees)} each.`;
  if (offer.free) return `${head}\nWith your chart ready I can look into ${many ? "those" : "that"} now, and it's on the house. Shall I?`;
  if (offer.affordable) return `${head}\nI can look into ${many ? "those" : "that"} now for ${rupees(offer.costRupees)} from your wallet. Shall I?`;
  return `${head}\nThat would be ${rupees(offer.costRupees)}, and your wallet has ${rupees(creditRupees)}. Add to your wallet whenever you like and I'll answer straight away.`;
}
