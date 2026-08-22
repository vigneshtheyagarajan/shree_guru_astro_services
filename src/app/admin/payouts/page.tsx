import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { CreatePayoutButton } from "@/components/admin/CreatePayoutButton";
import { hasPayoutDetails } from "@/lib/payments/razorpayPayouts";
import { getEffectiveCommissionPercent } from "@/lib/platformSettings";
import { formatDateTimeShort } from "@/lib/dateFormat";

const PAYOUT_STATUS_VARIANT: Record<string, "warning" | "success" | "danger"> = {
  PENDING: "warning",
  PROCESSING: "warning",
  PROCESSED: "success",
  FAILED: "danger",
  REVERSED: "danger",
};

export default async function AdminPayoutsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/payouts");
  }
  if (session.user.role !== "ADMIN") {
    redirect("/");
  }

  const [pendingBookingsRaw, payouts] = await Promise.all([
    prisma.booking.findMany({
      where: { status: { in: ["PAID", "RATED"] }, payout: null },
      include: {
        client: true,
        astrologer: true,
        serviceOffering: { include: { service: true } },
      },
      orderBy: { completedAt: "desc" },
    }),
    prisma.payout.findMany({
      include: {
        astrologer: true,
        booking: { include: { serviceOffering: { include: { service: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const pendingBookings = await Promise.all(
    pendingBookingsRaw.map(async (booking) => {
      const commissionPercent = await getEffectiveCommissionPercent(
        booking.astrologer.commissionPercent,
      );
      const gross = booking.serviceOffering.pricePerSession;
      const net = Math.round(gross * (1 - commissionPercent / 100));
      return { booking, commissionPercent, gross, net };
    }),
  );

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-16">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Payouts</h1>
        <p className="text-sm text-foreground-muted">
          Pay astrologers out for their paid sessions via RazorpayX.
        </p>
      </header>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">Awaiting payout</h2>
        {pendingBookings.length === 0 ? (
          <p className="text-sm text-foreground-muted">None. Everything is paid out.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {pendingBookings.map(({ booking, commissionPercent, gross, net }) => {
              const eligible = hasPayoutDetails(booking.astrologer);
              return (
                <Card key={booking.id}>
                  <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {booking.serviceOffering.service.name} · ₹{gross} gross · ₹{net} payout (
                        {commissionPercent}% commission)
                      </p>
                      <p className="truncate text-sm text-foreground-muted">
                        {booking.astrologer.payoutAccountHolderName ?? "Astrologer"} · client{" "}
                        {booking.client.name}
                      </p>
                      {!eligible && (
                        <p className="text-xs text-warning">
                          Astrologer hasn&apos;t added payout bank details yet.
                        </p>
                      )}
                    </div>
                    {eligible ? (
                      <CreatePayoutButton bookingId={booking.id} />
                    ) : (
                      <Badge variant="warning">Blocked</Badge>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">Payout history</h2>
        {payouts.length === 0 ? (
          <p className="text-sm text-foreground-muted">No payouts yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {payouts.map((payout) => (
              <Card key={payout.id}>
                <CardHeader className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle>{payout.booking.serviceOffering.service.name}</CardTitle>
                  <Badge variant={PAYOUT_STATUS_VARIANT[payout.status] ?? "warning"}>
                    {payout.status}
                  </Badge>
                </CardHeader>
                <CardContent className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-foreground">
                      {payout.astrologer.payoutAccountHolderName ?? "Astrologer"} · ₹{payout.amount}{" "}
                      payout ({payout.commissionPercent}% commission)
                    </p>
                    <p className="text-foreground-muted">
                      created {formatDateTimeShort(payout.createdAt)}
                      {payout.status === "FAILED" && payout.failureReason
                        ? ` · ${payout.failureReason}`
                        : ""}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
