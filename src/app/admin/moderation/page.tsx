import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge, Card, CardContent, StarRating } from "@/components/ui";
import { ReviewHideToggle } from "@/components/admin/ReviewHideToggle";
import { AttachmentsHideToggle } from "@/components/admin/AttachmentsHideToggle";
import { formatDateShort } from "@/lib/dateFormat";

export default async function AdminModerationPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/moderation");
  }
  if (session.user.role !== "ADMIN") {
    redirect("/");
  }

  const [reviews, submissionsWithPhotos] = await Promise.all([
    prisma.review.findMany({
      include: { booking: { include: { client: true, astrologer: { include: { user: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.intakeSubmission.findMany({
      where: { attachments: { isEmpty: false } },
      include: {
        booking: {
          include: { client: true, astrologer: { include: { user: true } }, serviceOffering: { include: { service: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-10 px-6 py-16">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Moderation</h1>
        <p className="text-sm text-foreground-muted">
          Hide abusive reviews or inappropriate photo attachments. Hiding a review also excludes
          it from the astrologer&apos;s public rating.
        </p>
      </header>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">Reviews</h2>
        {reviews.length === 0 ? (
          <p className="text-sm text-foreground-muted">No reviews yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {reviews.map((review) => (
              <Card key={review.id}>
                <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StarRating value={review.rating} readOnly />
                      {review.hidden && <Badge variant="danger">Hidden</Badge>}
                    </div>
                    {review.comment && (
                      <p className="mt-1 text-sm text-foreground">{review.comment}</p>
                    )}
                    <p className="mt-1 text-xs text-foreground-muted">
                      {review.booking.client.name} · on {review.booking.astrologer.user.name} ·{" "}
                      {formatDateShort(review.createdAt)}
                    </p>
                  </div>
                  <ReviewHideToggle reviewId={review.id} hidden={review.hidden} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">Photo Attachments</h2>
        {submissionsWithPhotos.length === 0 ? (
          <p className="text-sm text-foreground-muted">No photo attachments yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {submissionsWithPhotos.map((submission) => (
              <Card key={submission.id}>
                <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {submission.booking.serviceOffering.service.name}
                      </span>
                      {submission.attachmentsHidden && <Badge variant="danger">Hidden</Badge>}
                    </div>
                    <p className="text-xs text-foreground-muted">
                      {submission.booking.client.name} · on{" "}
                      {submission.booking.astrologer.user.name} ·{" "}
                      {formatDateShort(submission.createdAt)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {submission.attachments.map((url) => (
                        // eslint-disable-next-line @next/next/no-img-element -- user-uploaded Cloudinary URL
                        <img
                          key={url}
                          src={url}
                          alt="Attachment"
                          className="h-20 w-20 rounded-lg border border-border object-cover"
                        />
                      ))}
                    </div>
                  </div>
                  <AttachmentsHideToggle
                    submissionId={submission.id}
                    hidden={submission.attachmentsHidden}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
