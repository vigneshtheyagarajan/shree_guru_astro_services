import { prisma } from "@/lib/prisma";

const SETTINGS_ID = "default";

export async function getPlatformSettings() {
  return prisma.platformSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID },
  });
}

export async function setDefaultCommissionPercent(percent: number) {
  return prisma.platformSettings.upsert({
    where: { id: SETTINGS_ID },
    update: { defaultCommissionPercent: percent },
    create: { id: SETTINGS_ID, defaultCommissionPercent: percent },
  });
}

/** Effective commission for one astrologer: their override, or the platform default. */
export async function getEffectiveCommissionPercent(
  astrologerCommissionPercent: number | null,
) {
  if (astrologerCommissionPercent != null) return astrologerCommissionPercent;
  const settings = await getPlatformSettings();
  return settings.defaultCommissionPercent;
}
