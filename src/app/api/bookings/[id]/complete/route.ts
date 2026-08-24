import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { matchNextInQueue } from "@/lib/chat/chatQueue";
import { NotificationService } from "@/lib/notifications/NotificationService";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (session?.user.role !== "ASTROLOGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      astrologer: { include: { user: true } },
      serviceOffering: { include: { service: true } },
      paymentLink: true,
    },
  });
  if (!booking || booking.astrologer.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (booking.status !== "CONFIRMED" && booking.status !== "IN_PROGRESS") {
    return NextResponse.json(
      { error: "Only confirmed or in-progress bookings can be marked complete." },
      { status: 400 },
    );
  }

  // Chat and call are both paid upfront, before the session could even start
  // (see /api/bookings/route.ts + the payment gates on messages/call signal
  // routes) -- "complete" always finalizes straight to PAID and fires the
  // review request.
  if (booking.paymentLink?.status !== "PAID") {
    return NextResponse.json(
      { error: "This booking hasn't been paid for yet." },
      { status: 400 },
    );
  }

  await prisma.booking.update({
    where: { id },
    data: { status: "PAID", completedAt: new Date() },
  });

  await NotificationService.send(booking.clientId, "REVIEW_REQUEST", {
    title: "How was your session?",
    message: `Leave a rating for your ${booking.serviceOffering.service.name} session with ${booking.astrologer.user.name}.`,
    url: `/bookings/${booking.id}`,
  });

  if (booking.isInstant) {
    try {
      await matchNextInQueue(booking.astrologerId);
    } catch (error) {
      console.error("Failed to match next chat-now queue entry", error);
    }
  }

  const updated = await prisma.booking.findUnique({ where: { id } });
  return NextResponse.json({ ok: true, booking: updated });
}
