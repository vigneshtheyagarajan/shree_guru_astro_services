import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { PayoutDetailsForm } from "@/components/astrologer/PayoutDetailsForm";
import { formatDateShort } from "@/lib/dateFormat";

const PAYOUT_STATUS_VARIANT: Record<string, "warning" | "success" | "danger"> = {
  PENDING: "warning",
  PROCESSING: "warning",
  PROCESSED: "success",
  FAILED: "danger",
  REVERSED: "danger",
};

export default async function AstrologerPayoutsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/astrologer/payouts");
  }
  if (session.user.role !== "ASTROLOGER") {
    redirect("/");
  }

  const profile = await prisma.astrologerProfile.findUnique({
    where: { userId: session.user.id },
  });
  if (!profile) {
    redirect("/apply-astrologer");
  }

  const payouts = await prisma.payout.findMany({
    where: { astrologerId: profile.id },
    include: { booking: { include: { serviceOffering: { include: { service: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-16">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Payouts</h1>
        <p className="text-sm text-foreground-muted">
          Add your bank details so the admin can pay you out for completed sessions.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Bank Details</CardTitle>
        </CardHeader>
        <CardContent>
          <PayoutDetailsForm
            initialAccountHolderName={profile.payoutAccountHolderName ?? ""}
            initialAccountNumber={profile.payoutAccountNumber ?? ""}
            initialIfscCode={profile.payoutIfscCode ?? ""}
          />
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">Payout History</h2>
        {payouts.length === 0 ? (
          <p className="text-sm text-foreground-muted">No payouts yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {payouts.map((payout) => (
              <Card key={payout.id}>
                <CardContent className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {payout.booking.serviceOffering.service.name} · ₹{payout.amount}
                    </p>
                    <p className="text-sm text-foreground-muted">
                      {formatDateShort(payout.createdAt)}
                      {payout.status === "FAILED" && payout.failureReason
                        ? ` · ${payout.failureReason}`
                        : ""}
                    </p>
                  </div>
                  <Badge variant={PAYOUT_STATUS_VARIANT[payout.status] ?? "warning"}>
                    {payout.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
