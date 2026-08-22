import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { Badge, Button, Card, CardContent, StarRating } from "@/components/ui";
import { AstrologerCard, type AstrologerCardData } from "@/components/astrologers/AstrologerCard";
import { getLocale, translate } from "@/lib/i18n/getLocale";

const CATEGORY_ICONS: Record<string, string> = {
  "Vedic Astrology": "🕉️",
  "Tamil Astrology": "🪔",
  Tarot: "🔮",
  Numerology: "🔢",
  Matching: "💞",
  "Western Astrology": "✨",
};

export default async function HomePage() {
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);

  const HOW_IT_WORKS = [
    { step: "1", title: t("home.step1Title"), body: t("home.step1Body") },
    { step: "2", title: t("home.step2Title"), body: t("home.step2Body") },
    { step: "3", title: t("home.step3Title"), body: t("home.step3Body") },
    { step: "4", title: t("home.step4Title"), body: t("home.step4Body") },
  ];

  const [services, approvedProfiles, reviews] = await Promise.all([
    prisma.service.findMany({ where: { isActive: true, phase: 1 }, orderBy: { name: "asc" } }),
    prisma.astrologerProfile.findMany({
      where: { approvalStatus: "APPROVED" },
      include: { user: true, services: { include: { service: true } } },
      orderBy: { ratingAvg: "desc" },
      take: 3,
    }),
    prisma.review.findMany({
      where: { hidden: false },
      include: { booking: { include: { client: true, astrologer: { include: { user: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
  ]);

  const featuredAstrologers: AstrologerCardData[] = approvedProfiles.map((profile) => {
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

  return (
    <main className="flex flex-1 flex-col">
      <section className="bg-starfield relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,122,26,0.16),_transparent_60%)]" />
        <div className="relative mx-auto flex w-full max-w-5xl flex-col items-start gap-6 px-6 py-20 sm:py-28">
          <Image
            src="/logo-mark.png"
            alt=""
            aria-hidden
            width={600}
            height={600}
            priority
            className="h-24 w-24 sm:h-28 sm:w-28"
          />
          {approvedProfiles.length > 0 && (
            <Badge variant="primary">
              {approvedProfiles.length} verified astrologer
              {approvedProfiles.length === 1 ? "" : "s"} ready to help
            </Badge>
          )}
          {locale === "en" ? (
            <h1 className="max-w-2xl text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
              Find clarity with <span className="text-gradient-gold">trusted astrologers</span>
            </h1>
          ) : (
            <h1 className="max-w-2xl text-4xl font-semibold leading-tight text-gradient-gold sm:text-5xl">
              {t("home.heroTitle")}
            </h1>
          )}
          <p className="max-w-xl text-base text-foreground-muted sm:text-lg">
            {t("home.heroSubtitle")}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/astrologers">
              <Button size="lg">{t("nav.findAstrologer")}</Button>
            </Link>
            <Link href="/apply-astrologer">
              <Button size="lg" variant="secondary">
                {t("home.ctaApplyAstrologer")}
              </Button>
            </Link>
          </div>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-foreground-muted">
            <li>✓ {t("home.trustVerified")}</li>
            <li>✓ {t("home.trustPayAfter")}</li>
            <li>✓ {t("home.trustModes")}</li>
          </ul>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-6 py-16">
        <h2 className="text-2xl font-semibold text-foreground">{t("home.servicesTitle")}</h2>
        <p className="mt-1 text-sm text-foreground-muted">{t("home.servicesSubtitle")}</p>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <Link
              key={service.id}
              href={`/astrologers?category=${encodeURIComponent(service.category)}`}
            >
              <Card className="h-full transition-colors hover:border-primary">
                <CardContent className="flex flex-col gap-2 pt-5">
                  <span className="text-2xl" aria-hidden>
                    {CATEGORY_ICONS[service.category] ?? "✨"}
                  </span>
                  <h3 className="font-medium text-foreground">{service.name}</h3>
                  <p className="text-sm text-foreground-muted">{service.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {featuredAstrologers.length > 0 && (
        <section className="border-t border-border bg-background-surface/40">
          <div className="mx-auto w-full max-w-5xl px-6 py-16">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-foreground">{t("home.astrologersTitle")}</h2>
                <p className="mt-1 text-sm text-foreground-muted">{t("home.astrologersSubtitle")}</p>
              </div>
              <Link href="/astrologers" className="text-sm text-primary hover:text-primary-hover">
                {t("home.viewAll")}
              </Link>
            </div>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featuredAstrologers.map((astrologer) => (
                <AstrologerCard key={astrologer.id} astrologer={astrologer} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto w-full max-w-5xl px-6 py-16">
        <h2 className="text-2xl font-semibold text-foreground">{t("home.howItWorksTitle")}</h2>
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS.map((item) => (
            <div key={item.step} className="flex flex-col gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-muted text-sm font-semibold text-primary">
                {item.step}
              </div>
              <h3 className="font-medium text-foreground">{item.title}</h3>
              <p className="text-sm text-foreground-muted">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {reviews.length > 0 && (
        <section className="border-t border-border">
          <div className="mx-auto w-full max-w-5xl px-6 py-16">
            <h2 className="text-2xl font-semibold text-foreground">{t("home.testimonialsTitle")}</h2>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {reviews.map((review) => (
                <Card key={review.id}>
                  <CardContent className="flex flex-col gap-2 pt-5">
                    <StarRating value={review.rating} readOnly />
                    {review.comment && (
                      <p className="text-sm text-foreground">{review.comment}</p>
                    )}
                    <p className="text-xs text-foreground-muted">
                      {review.booking.client.name} · on {review.booking.astrologer.user.name}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="border-t border-border bg-background-surface/40">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-start gap-4 px-6 py-16 sm:items-center sm:text-center">
          {locale === "en" ? (
            <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">
              Ready to find your <span className="text-gradient-gold">answers</span>?
            </h2>
          ) : (
            <h2 className="text-2xl font-semibold text-gradient-gold sm:text-3xl">
              {t("home.finalCtaTitle")}
            </h2>
          )}
          <p className="max-w-md text-sm text-foreground-muted">{t("home.finalCtaSubtitle")}</p>
          <Link href="/astrologers">
            <Button size="lg">{t("nav.findAstrologer")}</Button>
          </Link>
        </div>
      </section>
    </main>
  );
}
