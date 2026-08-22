import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pusherServer } from "@/lib/chat/pusher";

async function getBookingForParticipant(bookingId: string, userId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { astrologer: true, slot: true, paymentLink: true },
  });
  if (!booking) return null;
  const isParticipant = booking.clientId === userId || booking.astrologer.userId === userId;
  return isParticipant ? booking : null;
}

export async function GET(
  _request: Request,
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

  const messages = await prisma.chatMessage.findMany({
    where: { bookingId: id },
    orderBy: { sentAt: "asc" },
  });

  return NextResponse.json({ messages });
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
  if (booking.mode !== "CHAT") {
    return NextResponse.json(
      { error: "This booking isn't a chat consultation." },
      { status: 400 },
    );
  }
  if (booking.paymentLink?.status !== "PAID") {
    return NextResponse.json(
      { error: "Please complete payment before you can start chatting." },
      { status: 402 },
    );
  }

  const windowStart = new Date(booking.slot.startAt.getTime() - 5 * 60 * 1000);
  const windowEnd = new Date(booking.slot.endAt.getTime() + 10 * 60 * 1000);
  const now = new Date();
  if (now < windowStart || now > windowEnd) {
    return NextResponse.json(
      { error: "Chat is only open shortly before and during your scheduled session." },
      { status: 403 },
    );
  }

  const payload = await request.json().catch(() => null);
  const text = typeof payload?.body === "string" ? payload.body.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Message body is required." }, { status: 400 });
  }

  const message = await prisma.chatMessage.create({
    data: { bookingId: id, senderId: session.user.id, body: text },
  });

  try {
    await pusherServer.trigger(`private-booking-${id}`, "new-message", message);
  } catch (error) {
    console.error("Failed to publish chat message via Pusher", error);
  }

  return NextResponse.json({ message }, { status: 201 });
}
