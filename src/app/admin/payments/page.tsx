import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { formatDateTimeShort } from "@/lib/dateFormat";

const PAYMENT_STATUS_VARIANT: Record<string, "warning" | "success" | "danger"> = {
  CREATED: "warning",
  PAID: "success",
  EXPIRED: "danger",
  CANCELLED: "danger",
};

export default async function AdminPaymentsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/payments");
  }
  if (session.user.role !== "ADMIN") {
    redirect("/");
  }

  const paymentLinks = await prisma.paymentLink.findMany({
    include: {
      booking: {
        include: {
          client: true,
          astrologer: { include: { user: true } },
          serviceOffering: { include: { service: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-16">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Payments</h1>
        <p className="text-sm text-foreground-muted">
          Every booking is paid upfront before the session unlocks -- this is a read-only
          reconciliation log.
        </p>
      </header>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">All payment links</h2>
        {paymentLinks.length === 0 ? (
          <p className="text-sm text-foreground-muted">No payment links yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {paymentLinks.map((link) => (
              <Card key={link.id}>
                <CardHeader className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle>{link.booking.serviceOffering.service.name}</CardTitle>
                  <Badge variant={PAYMENT_STATUS_VARIANT[link.status] ?? "warning"}>
                    {link.status}
                  </Badge>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-foreground">
                      {link.booking.client.name} · {link.booking.astrologer.user.name}
                    </p>
                    <p className="text-foreground-muted">
                      ₹{link.amount} · created {formatDateTimeShort(link.createdAt)}
                    </p>
                  </div>
                  <a
                    href={`/bookings/${link.bookingId}`}
                    className="shrink-0 text-primary hover:text-primary-hover"
                  >
                    View booking
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
