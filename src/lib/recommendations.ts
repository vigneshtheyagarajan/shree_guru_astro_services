import { prisma } from "@/lib/prisma";

const COMPLETED_STATUSES = ["COMPLETED", "PAYMENT_LINK_SENT", "PAID", "RATED"] as const;

/**
 * Content-based recommendations: infers a client's preferred categories and
 * languages from their booking history, then scores other approved
 * astrologers who offer matching categories, weighted by language overlap
 * and rating. Astrologers the client has already booked are excluded to
 * encourage discovery. Returns [] for clients with no booking history yet.
 */
export async function getRecommendedAstrologers(clientId: string, limit = 3) {
  const pastBookings = await prisma.booking.findMany({
    where: { clientId, status: { in: [...COMPLETED_STATUSES] } },
    include: { serviceOffering: { include: { service: true } }, astrologer: true },
  });
  if (pastBookings.length === 0) return [];

  const bookedAstrologerIds = new Set(pastBookings.map((booking) => booking.astrologerId));
  const categoryCounts = new Map<string, number>();
  const languageCounts = new Map<string, number>();
  for (const booking of pastBookings) {
    const category = booking.serviceOffering.service.category;
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    for (const language of booking.astrologer.languages) {
      languageCounts.set(language, (languageCounts.get(language) ?? 0) + 1);
    }
  }

  const candidates = await prisma.astrologerProfile.findMany({
    where: {
      approvalStatus: "APPROVED",
      id: { notIn: Array.from(bookedAstrologerIds) },
    },
    include: { user: true, services: { include: { service: true } } },
  });

  const scored = candidates
    .map((profile) => {
      const categories = new Set(profile.services.map((offering) => offering.service.category));
      let score = 0;
      for (const category of categories) score += (categoryCounts.get(category) ?? 0) * 2;
      for (const language of profile.languages) score += languageCounts.get(language) ?? 0;
      score += profile.ratingAvg / 5;
      return { profile, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.profile);

  return scored;
}
