import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createMeetingToken } from "@/lib/video/daily";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { astrologer: true, slot: true },
  });
  if (!booking) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isClient = booking.clientId === session.user.id;
  const isAstrologer = booking.astrologer.userId === session.user.id;
  if (!isClient && !isAstrologer) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (booking.mode !== "VIDEO_CALL" || !booking.dailyRoomName) {
    return NextResponse.json({ error: "This booking has no video room." }, { status: 400 });
  }

  const windowStart = new Date(booking.slot.startAt.getTime() - 5 * 60 * 1000);
  const windowEnd = new Date(booking.slot.endAt.getTime() + 10 * 60 * 1000);
  const now = new Date();
  if (now < windowStart || now > windowEnd) {
    return NextResponse.json(
      { error: "The video call is only open shortly before and during your scheduled session." },
      { status: 403 },
    );
  }

  try {
    const token = await createMeetingToken(
      booking.dailyRoomName,
      session.user.name ?? "Guest",
      isAstrologer,
      windowEnd,
    );
    return NextResponse.json({ token, roomUrl: booking.dailyRoomUrl });
  } catch (error) {
    console.error("Failed to create Daily.co meeting token", error);
    return NextResponse.json({ error: "Failed to start the video call." }, { status: 502 });
  }
}
