import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BookingFlow } from "@/components/booking/BookingFlow";
import type { IntakeSchema } from "@/lib/services/intake-schema";

export default async function BookOfferingPage({
  params,
}: {
  params: Promise<{ offeringId: string }>;
}) {
  const { offeringId } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect(`/login?callbackUrl=/book/${offeringId}`);
  }
  if (session.user.role !== "CLIENT") {
    redirect("/");
  }

  const offering = await prisma.serviceOffering.findUnique({
    where: { id: offeringId },
    include: { service: true, astrologer: { include: { user: true } } },
  });

  if (!offering || offering.astrologer.approvalStatus !== "APPROVED") {
    notFound();
  }

  const slots = await prisma.slot.findMany({
    where: { astrologerId: offering.astrologerId, status: "OPEN", startAt: { gte: new Date() } },
    orderBy: { startAt: "asc" },
  });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-16">
      <BookingFlow
        offering={{
          id: offering.id,
          pricePerSession: offering.pricePerSession,
          durationMinutes: offering.durationMinutes,
          modes: offering.modes,
          service: {
            name: offering.service.name,
            intakeSchema: offering.service.intakeSchema as unknown as IntakeSchema,
          },
          astrologer: {
            name: offering.astrologer.user.name,
          },
        }}
        slots={slots.map((slot) => ({
          id: slot.id,
          startAt: slot.startAt.toISOString(),
          endAt: slot.endAt.toISOString(),
        }))}
      />
    </main>
  );
}
