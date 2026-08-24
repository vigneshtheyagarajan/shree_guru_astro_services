import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pusherServer } from "@/lib/chat/pusher";

const VALID_TYPES = ["ready", "offer", "answer", "ice-candidate", "hangup"] as const;

async function getBookingForParticipant(bookingId: string, userId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { astrologer: true, slot: true, paymentLink: true },
  });
  if (!booking) return null;
  const isParticipant = booking.clientId === userId || booking.astrologer.userId === userId;
  return isParticipant ? booking : null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const booking = await getBookingForParticipant(id, session.user.id);
  if (!booking) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (booking.mode !== "CALL") {
    return NextResponse.json({ error: "This booking isn't a call consultation." }, { status: 400 });
  }
  if (booking.paymentLink?.status !== "PAID") {
    return NextResponse.json(
      { error: "Please complete payment before you can start the call." },
      { status: 402 },
    );
  }

  const windowStart = new Date(booking.slot.startAt.getTime() - 5 * 60 * 1000);
  const windowEnd = new Date(booking.slot.endAt.getTime() + 10 * 60 * 1000);
  const now = new Date();
  if (now < windowStart || now > windowEnd) {
    return NextResponse.json(
      { error: "The call is only open shortly before and during your scheduled session." },
      { status: 403 },
    );
  }

  const payload = await request.json().catch(() => null);
  const type = payload?.type;
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "Invalid signal type." }, { status: 400 });
  }

  try {
    await pusherServer.trigger(`private-booking-${id}`, "call-signal", {
      type,
      payload: payload?.payload ?? null,
      fromUserId: session.user.id,
    });
  } catch (error) {
    console.error("Failed to publish call signal via Pusher", error);
    return NextResponse.json({ error: "Failed to send signal." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
