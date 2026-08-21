import type { IntakeSchema } from "../src/lib/services/intake-schema";

const CONCERN_OPTIONS = ["Marriage", "Career", "Health", "Finance", "Education", "General"];
const TAROT_CATEGORY_OPTIONS = ["Love", "Career", "Finance", "Health", "General"];

const birthDetails: IntakeSchema = [
  { key: "dob", label: "Date of Birth", type: "date", required: true },
  { key: "tob", label: "Time of Birth", type: "time", required: true },
  { key: "pob", label: "Place of Birth", type: "text", required: true },
];

export const PHASE_1_SERVICES: {
  slug: string;
  name: string;
  description: string;
  category: string;
  intakeSchema: IntakeSchema;
  supportedModes: Array<"IN_PERSON" | "CHAT" | "PHONE_CALL">;
}[] = [
  {
    slug: "vedic-astrology",
    name: "Vedic Astrology",
    description:
      "Traditional Kundli/Janam Kundli reading based on your exact birth details.",
    category: "Vedic Astrology",
    intakeSchema: birthDetails,
    supportedModes: ["IN_PERSON", "CHAT", "PHONE_CALL"],
  },
  {
    slug: "jaamakol",
    name: "Jaamakol (Tamil Astrology)",
    description: "Tamil astrology (Jathakam) reading focused on your specific concern.",
    category: "Tamil Astrology",
    intakeSchema: [
      ...birthDetails,
      {
        key: "concern",
        label: "Concern",
        type: "select",
        required: true,
        options: CONCERN_OPTIONS,
      },
      { key: "question", label: "Your Question", type: "textarea", required: false },
    ],
    supportedModes: ["IN_PERSON", "CHAT", "PHONE_CALL"],
  },
  {
    slug: "tarot-reading",
    name: "Tarot Reading",
    description: "Card-based guidance for a specific question or life area.",
    category: "Tarot",
    intakeSchema: [
      {
        key: "category",
        label: "Category",
        type: "select",
        required: true,
        options: TAROT_CATEGORY_OPTIONS,
      },
      { key: "question", label: "Your Question", type: "textarea", required: true },
    ],
    supportedModes: ["CHAT", "PHONE_CALL"],
  },
  {
    slug: "numerology",
    name: "Numerology",
    description: "Insights derived from your full name and date of birth.",
    category: "Numerology",
    intakeSchema: [
      { key: "fullName", label: "Full Name", type: "text", required: true },
      { key: "dob", label: "Date of Birth", type: "date", required: true },
    ],
    supportedModes: ["CHAT", "PHONE_CALL"],
  },
  {
    slug: "kundli-milan",
    name: "Kundli Milan (Horoscope Matching)",
    description: "Compatibility matching between two partners' birth charts.",
    category: "Matching",
    intakeSchema: [
      { key: "partnerAName", label: "Partner A - Name", type: "text", required: false },
      { key: "partnerADob", label: "Partner A - Date of Birth", type: "date", required: true },
      { key: "partnerATob", label: "Partner A - Time of Birth", type: "time", required: true },
      { key: "partnerAPob", label: "Partner A - Place of Birth", type: "text", required: true },
      { key: "partnerBName", label: "Partner B - Name", type: "text", required: false },
      { key: "partnerBDob", label: "Partner B - Date of Birth", type: "date", required: true },
      { key: "partnerBTob", label: "Partner B - Time of Birth", type: "time", required: true },
      { key: "partnerBPob", label: "Partner B - Place of Birth", type: "text", required: true },
    ],
    supportedModes: ["IN_PERSON", "CHAT", "PHONE_CALL"],
  },
  {
    slug: "western-astrology",
    name: "Western Astrology",
    description: "Sun-sign based Western astrology reading.",
    category: "Western Astrology",
    intakeSchema: [
      { key: "dob", label: "Date of Birth", type: "date", required: true },
      { key: "tob", label: "Time of Birth", type: "time", required: false },
      { key: "pob", label: "Place of Birth", type: "text", required: true },
    ],
    supportedModes: ["CHAT", "PHONE_CALL"],
  },
];
