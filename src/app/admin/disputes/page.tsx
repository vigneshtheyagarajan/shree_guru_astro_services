import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { ResolveDisputeForm } from "@/components/admin/ResolveDisputeForm";
import { formatDateTimeShort } from "@/lib/dateFormat";

const STATUS_VARIANT: Record<string, "warning" | "success" | "danger"> = {
  OPEN: "warning",
  UNDER_REVIEW: "warning",
  RESOLVED: "success",
  REJECTED: "danger",
};

export default async function AdminDisputesPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/disputes");
  }
  if (session.user.role !== "ADMIN") {
    redirect("/");
  }

  const disputes = await prisma.dispute.findMany({
    include: {
      raisedBy: true,
      booking: {
        include: {
          client: true,
          astrologer: { include: { user: true } },
          serviceOffering: { include: { service: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const open = disputes.filter((d) => d.status === "OPEN" || d.status === "UNDER_REVIEW");
  const closed = disputes.filter((d) => d.status === "RESOLVED" || d.status === "REJECTED");

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-16">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Disputes</h1>
        <p className="text-sm text-foreground-muted">
          Review and resolve complaints raised by clients or astrologers.
        </p>
      </header>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">Open</h2>
        {open.length === 0 ? (
          <p className="text-sm text-foreground-muted">No open disputes.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {open.map((dispute) => (
              <Card key={dispute.id}>
                <CardHeader className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle>{dispute.reason}</CardTitle>
                  <Badge variant={STATUS_VARIANT[dispute.status]}>{dispute.status}</Badge>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="text-sm">
                    <p className="text-foreground">
                      {dispute.booking.serviceOffering.service.name} · raised by {dispute.raisedBy.name}{" "}
                      ({formatDateTimeShort(dispute.createdAt)})
                    </p>
                    <p className="text-foreground-muted">
                      Client: {dispute.booking.client.name} · Astrologer:{" "}
                      {dispute.booking.astrologer.user.name}
                    </p>
                    <p className="mt-2 text-foreground">{dispute.description}</p>
                  </div>
                  <a
                    href={`/bookings/${dispute.bookingId}`}
                    className="text-sm text-primary hover:text-primary-hover"
                  >
                    View booking
                  </a>
                  <ResolveDisputeForm disputeId={dispute.id} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">Closed</h2>
        {closed.length === 0 ? (
          <p className="text-sm text-foreground-muted">No closed disputes yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {closed.map((dispute) => (
              <Card key={dispute.id}>
                <CardHeader className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle>{dispute.reason}</CardTitle>
                  <Badge variant={STATUS_VARIANT[dispute.status]}>{dispute.status}</Badge>
                </CardHeader>
                <CardContent className="text-sm">
                  <p className="text-foreground-muted">
                    {dispute.booking.serviceOffering.service.name} · raised by {dispute.raisedBy.name}
                  </p>
                  {dispute.resolutionNote && (
                    <p className="mt-1 text-foreground">Resolution: {dispute.resolutionNote}</p>
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
