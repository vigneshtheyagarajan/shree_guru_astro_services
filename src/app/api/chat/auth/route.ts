import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pusherServer } from "@/lib/chat/pusher";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const socketId = formData.get("socket_id")?.toString();
  const channelName = formData.get("channel_name")?.toString();

  if (!socketId || !channelName) {
    return NextResponse.json({ error: "Missing socket_id or channel_name" }, { status: 400 });
  }

  const match = channelName.match(/^private-booking-(.+)$/);
  if (!match) {
    return NextResponse.json({ error: "Invalid channel" }, { status: 403 });
  }
  const bookingId = match[1];

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { astrologer: true },
  });
  if (!booking) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isParticipant =
    booking.clientId === session.user.id || booking.astrologer.userId === session.user.id;
  if (!isParticipant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const authResponse = pusherServer.authorizeChannel(socketId, channelName);
  return NextResponse.json(authResponse);
}
