import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteBookingEvent } from "@/lib/integrations/googleCalendar";

const VALID_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "PAYMENT_LINK_SENT",
  "PAID",
  "RATED",
  "CANCELLED",
  "NO_SHOW",
] as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const status = body?.status;
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { slot: true, astrologer: true },
  });
  if (!booking) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id },
      data: {
        status,
        cancelledAt: status === "CANCELLED" ? new Date() : booking.cancelledAt,
      },
    });

    if (status === "CANCELLED" && booking.slot.startAt > new Date()) {
      await tx.slot.update({ where: { id: booking.slotId }, data: { status: "OPEN" } });
    }
  });

  if (status === "CANCELLED" && booking.googleEventId) {
    try {
      await deleteBookingEvent(booking.astrologer, booking.googleEventId);
    } catch (error) {
      console.error("Failed to delete Google Calendar event", error);
    }
  }

  return NextResponse.json({ ok: true });
}
