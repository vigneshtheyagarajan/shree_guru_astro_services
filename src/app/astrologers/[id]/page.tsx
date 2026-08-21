import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  StarRating,
} from "@/components/ui";
import { formatDateShort } from "@/lib/dateFormat";

const MODE_LABELS: Record<string, string> = {
  IN_PERSON: "In-person",
  CHAT: "Chat",
  PHONE_CALL: "Phone call",
};

export default async function AstrologerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const profile = await prisma.astrologerProfile.findUnique({
    where: { id },
    include: {
      user: true,
      services: { include: { service: true }, orderBy: { pricePerSession: "asc" } },
    },
  });

  if (!profile || profile.approvalStatus !== "APPROVED") {
    notFound();
  }

  const reviews = await prisma.review.findMany({
    where: { astrologerId: profile.id },
    include: { booking: { include: { client: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-16">
      <Card>
        <CardContent className="flex flex-col gap-4 pt-5">
          <div className="flex items-start gap-4">
            <Avatar name={profile.user.name} photoUrl={profile.photoUrl} className="h-16 w-16" />
            <div>
              <h1 className="text-xl font-semibold text-foreground">{profile.user.name}</h1>
              <p className="text-sm text-foreground-muted">
                {profile.languages.join(", ") || "Languages not listed"}
                {profile.experienceYears != null && ` · ${profile.experienceYears} yrs experience`}
              </p>
              <p className="mt-1 flex items-center gap-1 text-sm text-foreground-muted">
                <span aria-hidden>★</span>
                {profile.ratingCount > 0
                  ? `${profile.ratingAvg.toFixed(1)} (${profile.ratingCount} reviews)`
                  : "No reviews yet"}
              </p>
            </div>
          </div>
          {profile.bio && <p className="text-sm text-foreground">{profile.bio}</p>}
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">Services</h2>
        {profile.services.length === 0 ? (
          <p className="text-sm text-foreground-muted">
            This astrologer hasn&apos;t set up any services yet.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {profile.services.map((offering) => (
              <Card key={offering.id}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>{offering.service.name}</CardTitle>
                  <span className="text-sm font-medium text-foreground">
                    ₹{offering.pricePerSession} / {offering.durationMinutes} min
                  </span>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <p className="text-sm text-foreground-muted">
                    {offering.service.description}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {offering.modes.map((mode) => (
                      <Badge key={mode} variant="primary">
                        {MODE_LABELS[mode] ?? mode}
                      </Badge>
                    ))}
                  </div>
                  <Link href={`/book/${offering.id}`}>
                    <Button size="sm" className="self-start">
                      Book Now
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">Reviews</h2>
        {reviews.length === 0 ? (
          <p className="text-sm text-foreground-muted">No reviews yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {reviews.map((review) => (
              <Card key={review.id}>
                <CardContent className="flex flex-col gap-1.5 pt-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      {review.booking.client.name}
                    </span>
                    <span className="text-xs text-foreground-muted">
                      {formatDateShort(review.createdAt)}
                    </span>
                  </div>
                  <StarRating value={review.rating} readOnly />
                  {review.comment && (
                    <p className="text-sm text-foreground-muted">{review.comment}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
