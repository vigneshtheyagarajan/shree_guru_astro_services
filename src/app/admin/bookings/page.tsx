import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge, Card, CardContent } from "@/components/ui";
import { BookingFilterBar } from "@/components/admin/BookingFilterBar";
import { BookingStatusSelect } from "@/components/admin/BookingStatusSelect";
import { formatDateTimeShort } from "@/lib/dateFormat";
import type { Prisma, BookingStatus } from "@/generated/prisma/client";

const VALID_STATUSES: BookingStatus[] = [
  "PENDING",
  "CONFIRMED",
  "IN_PROGRESS",
  "PAID",
  "RATED",
  "CANCELLED",
  "NO_SHOW",
];

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/bookings");
  }
  if (session.user.role !== "ADMIN") {
    redirect("/");
  }

  const { status } = await searchParams;
  const statusFilter = VALID_STATUSES.find((value) => value === status);

  const where: Prisma.BookingWhereInput = statusFilter ? { status: statusFilter } : {};

  const bookings = await prisma.booking.findMany({
    where,
    include: {
      client: true,
      astrologer: { include: { user: true } },
      serviceOffering: { include: { service: true } },
      slot: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-16">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Bookings</h1>
        <p className="text-sm text-foreground-muted">
          Oversee bookings across the platform. Showing the most recent 100.
        </p>
      </header>

      <BookingFilterBar />

      {bookings.length === 0 ? (
        <p className="text-sm text-foreground-muted">No bookings match this filter.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {bookings.map((booking) => (
            <Card key={booking.id}>
              <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    {booking.serviceOffering.service.name}
                  </p>
                  <p className="truncate text-sm text-foreground-muted">
                    {booking.client.name} · {booking.astrologer.user.name}
                  </p>
                  <p className="text-xs text-foreground-muted">
                    {formatDateTimeShort(booking.slot.startAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="primary">{booking.status.replace(/_/g, " ")}</Badge>
                  <BookingStatusSelect bookingId={booking.id} currentStatus={booking.status} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
