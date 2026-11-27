import { prisma } from "@/lib/prisma";
import type { GuruDeps } from "./conversation";
import { DEFAULT_PRICING, InMemoryEntitlements, type Entitlements } from "./entitlements";
import { createModelsFromEnv, type GuruModels } from "./llm/factory";
import { PrismaSessionStore, type GuruSessionTable } from "./persist";
import { OpenMeteoGeocoder } from "./tools/geocode";

// Wiring of Guru to the real app. Everything Guru does is behind
// GURU_ENABLED so it cannot affect the existing site until switched on.

export const guruEnabled = () => process.env.GURU_ENABLED === "true";

let models: GuruModels | undefined;
const getModels = () => (models ??= createModelsFromEnv());

// The Prisma delegate's Json typing is stricter than the store's; the shapes are identical.
const sessionTable = () => prisma.guruSession as unknown as GuruSessionTable;

// TEMPORARY (until Phase 4): process-local free/credit balances per user. Phase 4
// replaces this with an Entitlements implementation backed by the existing
// wallet (reserve = debit, release = refund). It is only reachable when
// GURU_ENABLED=true, i.e. in development.
const devBalances = new Map<string, InMemoryEntitlements>();
export function entitlementsFor(userId: string): Entitlements {
  let e = devBalances.get(userId);
  if (!e) {
    e = new InMemoryEntitlements(DEFAULT_PRICING, { creditRupees: Number(process.env.GURU_DEV_CREDIT_RUPEES ?? 0) });
    devBalances.set(userId, e);
  }
  return e;
}

export function createGuruDeps(userId: string): GuruDeps {
  const m = getModels();
  return {
    provider: m.provider,
    classifier: m.classifier,
    store: new PrismaSessionStore(sessionTable()),
    entitlements: entitlementsFor(userId),
    geocoder: new OpenMeteoGeocoder(),
    pricing: DEFAULT_PRICING,
  };
}
