import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge, Card, CardContent, CardHeader, CardTitle, StarRating } from "@/components/ui";
import { ChatPanel } from "@/components/booking/ChatPanel";
import { VideoCallPanel } from "@/components/booking/VideoCallPanel";
import { BookingStatusActions } from "@/components/booking/BookingStatusActions";
import { ReviewForm } from "@/components/booking/ReviewForm";
import { DisputeForm } from "@/components/booking/DisputeForm";
import { PayWithWalletButton } from "@/components/booking/PayWithWalletButton";
import type { IntakeSchema } from "@/lib/services/intake-schema";
import { formatDateTimeLong } from "@/lib/dateFormat";
import { getOrCreateWallet } from "@/lib/wallet";

const MODE_LABELS: Record<string, string> = {
  IN_PERSON: "In-person",
  CHAT: "Chat",
  PHONE_CALL: "Phone call",
  VIDEO_CALL: "Video call",
};

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect(`/login?callbackUrl=/bookings/${id}`);
  }

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      client: true,
      astrologer: { include: { user: true } },
      serviceOffering: { include: { service: true } },
      slot: true,
      intakeSubmission: true,
      paymentLink: true,
      review: true,
      dispute: true,
    },
  });

  if (!booking) notFound();

  const isClientViewer = booking.clientId === session.user.id;
  const isAstrologerViewer =
    session.user.role === "ASTROLOGER" && booking.astrologer.userId === session.user.id;
  const isAdminViewer = session.user.role === "ADMIN";

  if (!isClientViewer && !isAstrologerViewer && !isAdminViewer) {
    notFound();
  }

  const intakeSchema = booking.serviceOffering.service.intakeSchema as unknown as IntakeSchema;
  const intakeData = (booking.intakeSubmission?.data ?? {}) as Record<string, string>;

  const wallet = isClientViewer ? await getOrCreateWallet(session.user.id) : null;
  const canPayFromWallet =
    isClientViewer &&
    booking.paymentLink?.status === "CREATED" &&
    (wallet?.balance ?? 0) >= booking.paymentLink.amount;

  // Chat/phone/video are paid upfront -- the session itself (chat window,
  // video join, phone number reveal) is gated behind that payment. In-person
  // is unaffected: it's still paid after the session via the banner below.
  const isLiveMode = booking.mode !== "IN_PERSON";
  const isPaidForLiveSession = !isLiveMode || booking.paymentLink?.status === "PAID";

  const paymentPrompt = booking.paymentLink ? (
    <div className="flex flex-col gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
      <p className="text-foreground">
        {isClientViewer
          ? `Payment of ₹${booking.paymentLink.amount} is required before this session can start.`
          : "Waiting for the client to complete payment before this session can start."}
      </p>
      {isClientViewer && (
        <div className="flex flex-wrap items-center gap-2">
          {canPayFromWallet && <PayWithWalletButton bookingId={booking.id} />}
          <a
            href={booking.paymentLink.shortUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-black hover:bg-primary-hover"
          >
            Pay Now
          </a>
        </div>
      )}
    </div>
  ) : (
    <p className="text-sm text-danger">
      We couldn&apos;t set up payment for this session. Please contact support.
    </p>
  );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-16">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{booking.serviceOffering.service.name}</CardTitle>
          <Badge variant="primary">{booking.status.replace(/_/g, " ")}</Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-foreground-muted">
                {isClientViewer ? "Astrologer" : "Client"}
              </dt>
              <dd className="text-foreground">
                {isClientViewer ? booking.astrologer.user.name : booking.client.name}
              </dd>
            </div>
            <div>
              <dt className="text-foreground-muted">Mode</dt>
              <dd className="text-foreground">{MODE_LABELS[booking.mode] ?? booking.mode}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-foreground-muted">Scheduled for</dt>
              <dd className="text-foreground">{formatDateTimeLong(booking.slot.startAt)}</dd>
            </div>
          </dl>

          {booking.mode === "IN_PERSON" && booking.addressRevealedAt && (
            <div className="rounded-lg border border-border bg-background-elevated p-3 text-sm">
              <p className="text-foreground-muted">Address</p>
              <p className="text-foreground">
                {booking.astrologer.address || "Address not set by astrologer yet."}
              </p>
            </div>
          )}

          {booking.mode === "PHONE_CALL" &&
            (isPaidForLiveSession || isClientViewer ? (
              <div className="rounded-lg border border-border bg-background-elevated p-3 text-sm">
                <p className="text-foreground-muted">Phone number</p>
                <p className="text-foreground">{booking.clientPhone}</p>
              </div>
            ) : (
              paymentPrompt
            ))}

          {booking.mode === "CHAT" &&
            (isPaidForLiveSession ? (
              <ChatPanel
                bookingId={booking.id}
                windowStart={new Date(booking.slot.startAt.getTime() - 5 * 60 * 1000).toISOString()}
                windowEnd={new Date(booking.slot.endAt.getTime() + 10 * 60 * 1000).toISOString()}
                currentUserId={session.user.id}
              />
            ) : (
              paymentPrompt
            ))}

          {booking.mode === "VIDEO_CALL" &&
            (!isPaidForLiveSession ? (
              paymentPrompt
            ) : booking.dailyRoomUrl ? (
              <VideoCallPanel
                bookingId={booking.id}
                windowStart={new Date(booking.slot.startAt.getTime() - 5 * 60 * 1000).toISOString()}
                windowEnd={new Date(booking.slot.endAt.getTime() + 10 * 60 * 1000).toISOString()}
              />
            ) : (
              <p className="text-sm text-danger">
                We couldn&apos;t set up the video room for this session. Please contact support.
              </p>
            ))}

          {isAstrologerViewer && (booking.status === "CONFIRMED" || booking.status === "IN_PROGRESS") && (
            <BookingStatusActions bookingId={booking.id} />
          )}

          {isClientViewer && booking.status === "PAYMENT_LINK_SENT" && booking.paymentLink && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
              <p className="text-foreground">
                Payment of ₹{booking.paymentLink.amount} is due for this session.
              </p>
              <div className="flex shrink-0 items-center gap-2">
                {canPayFromWallet && <PayWithWalletButton bookingId={booking.id} />}
                <a
                  href={booking.paymentLink.shortUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-black hover:bg-primary-hover"
                >
                  Pay Now
                </a>
              </div>
            </div>
          )}

          {(booking.status === "PAID" || booking.status === "RATED") && (
            <div className="rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-foreground">
              Payment received. Thank you!
            </div>
          )}

          {isClientViewer && booking.status === "PAID" && !booking.review && (
            <ReviewForm bookingId={booking.id} />
          )}

          {booking.review && (
            <div className="flex flex-col gap-1 rounded-lg border border-border bg-background-elevated p-3">
              <p className="text-sm font-medium text-foreground">Your review</p>
              <StarRating value={booking.review.rating} readOnly />
              {booking.review.comment && (
                <p className="text-sm text-foreground-muted">{booking.review.comment}</p>
              )}
            </div>
          )}

          {booking.dispute ? (
            <div className="flex flex-col gap-1 rounded-lg border border-border bg-background-elevated p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Dispute: {booking.dispute.reason}</p>
                <Badge
                  variant={
                    booking.dispute.status === "RESOLVED"
                      ? "success"
                      : booking.dispute.status === "REJECTED"
                        ? "danger"
                        : "warning"
                  }
                >
                  {booking.dispute.status.replace(/_/g, " ")}
                </Badge>
              </div>
              <p className="text-sm text-foreground-muted">{booking.dispute.description}</p>
              {booking.dispute.resolutionNote && (
                <p className="text-sm text-foreground">
                  Admin response: {booking.dispute.resolutionNote}
                </p>
              )}
            </div>
          ) : (
            (isClientViewer || isAstrologerViewer) &&
            booking.status !== "CANCELLED" && <DisputeForm bookingId={booking.id} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Intake Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            {intakeSchema.map((field) => {
              const value = intakeData[field.key];
              if (!value) return null;
              return (
                <div key={field.key}>
                  <dt className="text-foreground-muted">{field.label}</dt>
                  {field.type === "photo" ? (
                    booking.intakeSubmission?.attachmentsHidden && !isAdminViewer ? (
                      <p className="mt-1 text-xs text-foreground-muted">
                        This photo has been hidden by moderation.
                      </p>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element -- user-uploaded Cloudinary URL
                      <img
                        src={value}
                        alt={field.label}
                        className="mt-1 h-24 w-24 rounded-lg border border-border object-cover"
                      />
                    )
                  ) : (
                    <dd className="text-foreground">{value}</dd>
                  )}
                </div>
              );
            })}
          </dl>
        </CardContent>
      </Card>
    </main>
  );
}
