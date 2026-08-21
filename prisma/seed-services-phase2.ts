import type { IntakeSchema } from "../src/lib/services/intake-schema";
import type { SeedServiceDef } from "./seed-services";

const PROPERTY_TYPE_OPTIONS = ["Home", "Office", "Shop", "Land/Plot", "Other"];

const birthDetails: IntakeSchema = [
  { key: "dob", label: "Date of Birth", type: "date", required: true },
  { key: "tob", label: "Time of Birth", type: "time", required: true },
  { key: "pob", label: "Place of Birth", type: "text", required: true },
];

export const PHASE_2_SERVICES: SeedServiceDef[] = [
  {
    slug: "kp-astrology",
    name: "KP Astrology",
    description: "Krishnamurti Paddhati reading focused on precise event timing.",
    category: "KP Astrology",
    intakeSchema: [
      ...birthDetails,
      {
        key: "eventQuestion",
        label: "Event Timing Question",
        type: "textarea",
        required: true,
      },
    ],
    supportedModes: ["IN_PERSON", "CHAT", "PHONE_CALL"],
  },
  {
    slug: "palmistry",
    name: "Palmistry",
    description: "Hand-reading insights from a clear photo of your palm.",
    category: "Palmistry",
    intakeSchema: [
      { key: "dob", label: "Date of Birth", type: "date", required: false },
      { key: "palmPhoto", label: "Photo of Your Palm", type: "photo", required: true },
    ],
    supportedModes: ["CHAT"],
  },
  {
    slug: "face-reading",
    name: "Face Reading",
    description: "Physiognomy insights from a clear photo of your face.",
    category: "Face Reading",
    intakeSchema: [
      { key: "facePhoto", label: "Photo of Your Face", type: "photo", required: true },
    ],
    supportedModes: ["CHAT"],
  },
  {
    slug: "gemstone-consultation",
    name: "Gemstone Consultation",
    description: "Personalized gemstone recommendations based on your birth chart.",
    category: "Gemstone",
    intakeSchema: [
      ...birthDetails,
      { key: "concern", label: "Current Concern", type: "textarea", required: true },
    ],
    supportedModes: ["IN_PERSON", "CHAT", "PHONE_CALL"],
  },
  {
    slug: "vastu-consultation",
    name: "Vastu Consultation",
    description: "Vastu Shastra review of your home, office, or plot.",
    category: "Vastu",
    intakeSchema: [
      {
        key: "propertyType",
        label: "Property Type",
        type: "select",
        required: true,
        options: PROPERTY_TYPE_OPTIONS,
      },
      { key: "floorPlanPhoto", label: "Floor Plan or Property Photo", type: "photo", required: true },
      { key: "concern", label: "Concern", type: "textarea", required: true },
    ],
    supportedModes: ["IN_PERSON", "CHAT"],
  },
  {
    slug: "reiki-healing",
    name: "Reiki / Energy Healing",
    description: "Guided energy healing session tailored to what you're going through.",
    category: "Reiki",
    intakeSchema: [
      { key: "concern", label: "What's on your mind?", type: "textarea", required: true },
    ],
    supportedModes: ["IN_PERSON", "CHAT", "PHONE_CALL"],
  },
];
