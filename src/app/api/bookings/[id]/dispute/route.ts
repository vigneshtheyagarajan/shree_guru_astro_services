import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NotificationService } from "@/lib/notifications/NotificationService";

const REASONS = [
  "Service not as described",
  "Astrologer no-show",
  "Client no-show",
  "Payment issue",
  "Other",
];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { astrologer: true, dispute: true, serviceOffering: { include: { service: true } } },
  });
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const isClient = booking.clientId === session.user.id;
  const isAstrologer = booking.astrologer.userId === session.user.id;
  if (!isClient && !isAstrologer) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (booking.dispute) {
    return NextResponse.json({ error: "A dispute already exists for this booking." }, { status: 400 });
  }
  if (booking.status === "CANCELLED") {
    return NextResponse.json(
      { error: "Disputes can't be raised for cancelled bookings." },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => null);
  const reason = typeof body?.reason === "string" ? body.reason : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";

  if (!REASONS.includes(reason)) {
    return NextResponse.json({ error: "Please select a valid reason." }, { status: 400 });
  }
  if (!description) {
    return NextResponse.json({ error: "Please describe the issue." }, { status: 400 });
  }

  const dispute = await prisma.dispute.create({
    data: { bookingId: booking.id, raisedById: session.user.id, reason, description },
  });

  const admins = await prisma.user.findMany({ where: { role: "ADMIN" } });
  await Promise.all(
    admins.map((admin) =>
      NotificationService.send(admin.id, "DISPUTE_RAISED", {
        title: "New dispute raised",
        message: `${session.user.name} raised a dispute on a ${booking.serviceOffering.service.name} booking: ${reason}.`,
        url: `/admin/disputes`,
      }),
    ),
  );

  return NextResponse.json({ ok: true, dispute });
}
