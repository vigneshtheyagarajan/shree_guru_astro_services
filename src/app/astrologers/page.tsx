import { prisma } from "@/lib/prisma";
import { AstrologerBrowse } from "@/components/astrologers/AstrologerBrowse";
import type { AstrologerCardData } from "@/components/astrologers/AstrologerCard";
import { getLocale, translate } from "@/lib/i18n/getLocale";

export default async function AstrologersPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category: initialCategory } = await searchParams;
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);

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
    };
  });

  const categories = Array.from(
    new Set(astrologers.flatMap((astrologer) => astrologer.categories)),
  ).sort();
  const languages = Array.from(
    new Set(astrologers.flatMap((astrologer) => astrologer.languages)),
  ).sort();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-16">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">{t("nav.findAstrologer")}</h1>
        <p className="text-sm text-foreground-muted">{t("browse.subtitle")}</p>
      </header>

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
