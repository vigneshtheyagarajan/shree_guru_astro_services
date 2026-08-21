import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge, Card, CardContent } from "@/components/ui";
import { formatDateTimeShort } from "@/lib/dateFormat";

const STATUS_VARIANT: Record<string, "warning" | "success" | "danger" | "default" | "primary"> = {
  PENDING: "warning",
  CONFIRMED: "primary",
  IN_PROGRESS: "primary",
  COMPLETED: "default",
  PAYMENT_LINK_SENT: "warning",
  PAID: "success",
  RATED: "success",
  CANCELLED: "danger",
  NO_SHOW: "danger",
};

export default async function BookingsListPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/bookings");
  }

  let bookings;
  if (session.user.role === "CLIENT") {
    bookings = await prisma.booking.findMany({
      where: { clientId: session.user.id },
      include: { astrologer: { include: { user: true } }, serviceOffering: { include: { service: true } }, slot: true },
      orderBy: { createdAt: "desc" },
    });
  } else if (session.user.role === "ASTROLOGER") {
    const profile = await prisma.astrologerProfile.findUnique({
      where: { userId: session.user.id },
    });
    bookings = profile
      ? await prisma.booking.findMany({
          where: { astrologerId: profile.id },
          include: { client: true, serviceOffering: { include: { service: true } }, slot: true },
          orderBy: { createdAt: "desc" },
        })
      : [];
  } else {
    redirect("/");
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-16">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">My Bookings</h1>
      </header>

      {bookings.length === 0 ? (
        <p className="text-sm text-foreground-muted">No bookings yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {bookings.map((booking) => {
            const counterpartName =
              session.user.role === "CLIENT"
                ? "astrologer" in booking
                  ? booking.astrologer.user.name
                  : ""
                : "client" in booking
                  ? booking.client.name
                  : "";
            return (
              <Link key={booking.id} href={`/bookings/${booking.id}`}>
                <Card className="transition-colors hover:border-primary">
                  <CardContent className="flex items-center justify-between py-4">
                    <div>
                      <p className="font-medium text-foreground">
                        {booking.serviceOffering.service.name} with {counterpartName}
                      </p>
                      <p className="text-sm text-foreground-muted">
                        {formatDateTimeShort(booking.slot.startAt)}
                      </p>
                    </div>
                    <Badge variant={STATUS_VARIANT[booking.status] ?? "default"}>
                      {booking.status.replace(/_/g, " ")}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
