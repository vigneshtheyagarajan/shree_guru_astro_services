import { prisma } from "@/lib/prisma";
import { AstrologerBrowse } from "@/components/astrologers/AstrologerBrowse";
import { AstrologerCard, type AstrologerCardData } from "@/components/astrologers/AstrologerCard";
import { getLocale, translate } from "@/lib/i18n/getLocale";
import { auth } from "@/lib/auth";
import { getRecommendedAstrologers } from "@/lib/recommendations";

export default async function AstrologersPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category: initialCategory } = await searchParams;
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);
  const session = await auth();

  const recommendedProfiles =
    session?.user.role === "CLIENT" ? await getRecommendedAstrologers(session.user.id) : [];

  const profiles = await prisma.astrologerProfile.findMany({
    where: { approvalStatus: "APPROVED" },
    include: { user: true, services: { include: { service: true } } },
    orderBy: { ratingAvg: "desc" },
  });

  const astrologers: AstrologerCardData[] = profiles.map((profile) => {
    const prices = profile.services.map((offering) => offering.pricePerSession);
    const categories = Array.from(
      new Set(profile.services.map((offering) => offering.service.category)),
    );

    return {
      id: profile.id,
      name: profile.user.name,
      photoUrl: profile.photoUrl,
      bio: profile.bio,
      languages: profile.languages,
      experienceYears: profile.experienceYears,
      ratingAvg: profile.ratingAvg,
      ratingCount: profile.ratingCount,
      categories,
      startingPrice: prices.length > 0 ? Math.min(...prices) : null,
      isOnline: profile.isOnline,
    };
  });

  const categories = Array.from(
    new Set(astrologers.flatMap((astrologer) => astrologer.categories)),
  ).sort();
  const languages = Array.from(
    new Set(astrologers.flatMap((astrologer) => astrologer.languages)),
  ).sort();

  const astrologersById = new Map(astrologers.map((astrologer) => [astrologer.id, astrologer]));
  const recommended = recommendedProfiles
    .map((profile) => astrologersById.get(profile.id))
    .filter((astrologer): astrologer is AstrologerCardData => !!astrologer);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-16">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">{t("nav.findAstrologer")}</h1>
        <p className="text-sm text-foreground-muted">{t("browse.subtitle")}</p>
      </header>

      {recommended.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-foreground">Recommended for you</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recommended.map((astrologer) => (
              <AstrologerCard key={astrologer.id} astrologer={astrologer} />
            ))}
          </div>
        </div>
      )}

      {astrologers.length === 0 ? (
        <p className="text-sm text-foreground-muted">{t("browse.empty")}</p>
      ) : (
        <AstrologerBrowse
          astrologers={astrologers}
          categories={categories}
          languages={languages}
          initialCategory={
            initialCategory && categories.includes(initialCategory) ? initialCategory : ""
          }
        />
      )}
    </main>
  );
}
