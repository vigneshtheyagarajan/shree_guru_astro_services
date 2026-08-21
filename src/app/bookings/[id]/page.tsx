import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { ChatPanel } from "@/components/booking/ChatPanel";
import { BookingStatusActions } from "@/components/booking/BookingStatusActions";
import type { IntakeSchema } from "@/lib/services/intake-schema";
import { formatDateTimeLong } from "@/lib/dateFormat";

const MODE_LABELS: Record<string, string> = {
  IN_PERSON: "In-person",
  CHAT: "Chat",
  PHONE_CALL: "Phone call",
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

          {booking.mode === "PHONE_CALL" && (
            <div className="rounded-lg border border-border bg-background-elevated p-3 text-sm">
              <p className="text-foreground-muted">Phone number</p>
              <p className="text-foreground">{booking.clientPhone}</p>
            </div>
          )}

          {booking.mode === "CHAT" && (
            <ChatPanel
              bookingId={booking.id}
              windowStart={new Date(booking.slot.startAt.getTime() - 5 * 60 * 1000).toISOString()}
              windowEnd={new Date(booking.slot.endAt.getTime() + 10 * 60 * 1000).toISOString()}
              currentUserId={session.user.id}
            />
          )}

          {isAstrologerViewer && (booking.status === "CONFIRMED" || booking.status === "IN_PROGRESS") && (
            <BookingStatusActions bookingId={booking.id} />
          )}

          {isClientViewer && booking.status === "PAYMENT_LINK_SENT" && booking.paymentLink && (
            <div className="flex items-center justify-between rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
              <p className="text-foreground">
                Payment of ₹{booking.paymentLink.amount} is due for this session.
              </p>
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

          {(booking.status === "PAID" || booking.status === "RATED") && (
            <div className="rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-foreground">
              Payment received. Thank you!
            </div>
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
                  <dd className="text-foreground">{value}</dd>
                </div>
              );
            })}
          </dl>
        </CardContent>
      </Card>
    </main>
  );
}
