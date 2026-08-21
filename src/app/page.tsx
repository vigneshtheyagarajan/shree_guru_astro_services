import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge, Button, Card, CardContent, StarRating } from "@/components/ui";
import { AstrologerCard, type AstrologerCardData } from "@/components/astrologers/AstrologerCard";

const CATEGORY_ICONS: Record<string, string> = {
  "Vedic Astrology": "🕉️",
  "Tamil Astrology": "🪔",
  Tarot: "🔮",
  Numerology: "🔢",
  Matching: "💞",
  "Western Astrology": "✨",
};

const HOW_IT_WORKS = [
  { step: "1", title: "Pick a service", body: "Vedic, Jaamakol, Tarot, and more." },
  { step: "2", title: "Choose your astrologer", body: "Browse by language, price, and rating." },
  { step: "3", title: "Book a slot", body: "Chat, call, or meet in person." },
  { step: "4", title: "Pay after your session", body: "No upfront payment — pay once you're done." },
];

export default async function HomePage() {
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
    };
  });

  return (
    <main className="flex flex-1 flex-col">
      <section className="bg-starfield relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,122,26,0.16),_transparent_60%)]" />
        <div className="relative mx-auto flex w-full max-w-5xl flex-col items-start gap-6 px-6 py-20 sm:py-28">
          {approvedProfiles.length > 0 && (
            <Badge variant="primary">
              {approvedProfiles.length} verified astrologer
              {approvedProfiles.length === 1 ? "" : "s"} ready to help
            </Badge>
          )}
          <h1 className="max-w-2xl text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
            Find clarity with <span className="text-gradient-gold">trusted astrologers</span>
          </h1>
          <p className="max-w-xl text-base text-foreground-muted sm:text-lg">
            Vedic Astrology, Jaamakol, Tarot, and more — book a verified astrologer, have your
            session, and pay only after you&apos;re done.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/astrologers">
              <Button size="lg">Find an Astrologer</Button>
            </Link>
            <Link href="/apply-astrologer">
              <Button size="lg" variant="secondary">
                Apply as an Astrologer
              </Button>
            </Link>
          </div>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-foreground-muted">
            <li>✓ Verified astrologers</li>
            <li>✓ Pay only after your session</li>
            <li>✓ Chat, call, or in-person</li>
          </ul>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-6 py-16">
        <h2 className="text-2xl font-semibold text-foreground">Explore our services</h2>
        <p className="mt-1 text-sm text-foreground-muted">
          Pick a service, then choose the astrologer who&apos;s right for you.
        </p>
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
                <h2 className="text-2xl font-semibold text-foreground">Meet our astrologers</h2>
                <p className="mt-1 text-sm text-foreground-muted">
                  Every astrologer is reviewed by our team before they can take bookings.
                </p>
              </div>
              <Link href="/astrologers" className="text-sm text-primary hover:text-primary-hover">
                View all →
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
        <h2 className="text-2xl font-semibold text-foreground">How it works</h2>
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
            <h2 className="text-2xl font-semibold text-foreground">What clients are saying</h2>
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
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">
            Ready to find your <span className="text-gradient-gold">answers</span>?
          </h2>
          <p className="max-w-md text-sm text-foreground-muted">
            Book your first session today — verified astrologers, real conversations, pay after
            you&apos;re done.
          </p>
          <Link href="/astrologers">
            <Button size="lg">Find an Astrologer</Button>
          </Link>
        </div>
      </section>
    </main>
  );
}
